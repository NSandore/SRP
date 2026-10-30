<?php

declare(strict_types=1);

require_once __DIR__ . '/../db_connection.php';

/*
 * Idempotently publish StudentSphere's first public launch poll.
 *
 * The stable poll ID prevents duplicate polls if this script is rerun. Existing
 * polls are never rewritten, which also preserves the meaning of recorded votes.
 */

$db = getDB();
$pollId = 'pllaunchpriorities2026';

$existingStmt = $db->prepare('SELECT question FROM polls WHERE poll_id = :poll_id LIMIT 1');
$existingStmt->execute([':poll_id' => $pollId]);
$existingQuestion = $existingStmt->fetchColumn();

if ($existingQuestion !== false) {
    fwrite(STDOUT, "Launch poll already exists: {$pollId} ({$existingQuestion})\n");
    exit(0);
}

$ownerStmt = $db->query("
    SELECT user_id
    FROM users
    WHERE role_id = 5
    ORDER BY created_at ASC, user_id ASC
    LIMIT 1
");
$ownerId = normalizeId($ownerStmt->fetchColumn());

if ($ownerId === '') {
    fwrite(STDERR, "A super-admin account is required to publish the launch poll.\n");
    exit(1);
}

$question = 'What would you most like to use StudentSphere for?';
$description = 'Help shape what we prioritize after launch. Choose the one experience that matters most to you.';
$options = [
    'Connect with students at my school',
    'Ask or answer college questions',
    'Find communities that match my interests',
    'Discover events and opportunities',
    'Share advice from my experience',
];

$db->beginTransaction();

try {
    $pollStmt = $db->prepare("
        INSERT INTO polls (
            poll_id, community_id, created_by, question, description,
            is_anonymous, allow_multiple_choices, opens_at, closes_at
        )
        VALUES (
            :poll_id, NULL, :created_by, :question, :description,
            1, 0, UTC_TIMESTAMP(), NULL
        )
    ");
    $pollStmt->execute([
        ':poll_id' => $pollId,
        ':created_by' => $ownerId,
        ':question' => $question,
        ':description' => $description,
    ]);

    $optionStmt = $db->prepare("
        INSERT INTO poll_options (option_id, poll_id, option_text, position)
        VALUES (:option_id, :poll_id, :option_text, :position)
    ");

    foreach ($options as $position => $optionText) {
        $optionStmt->execute([
            ':option_id' => generateUniqueId($db, 'poll_options'),
            ':poll_id' => $pollId,
            ':option_text' => $optionText,
            ':position' => $position,
        ]);
    }

    $db->commit();
    fwrite(STDOUT, "Published global launch poll: {$pollId}\n");
} catch (Throwable $error) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    fwrite(STDERR, "Unable to publish launch poll: {$error->getMessage()}\n");
    exit(1);
}
