<?php

declare(strict_types=1);

/**
 * Accounts that may use the narrowly scoped UI test controls.
 *
 * This is intentionally separate from roles: a test account can exercise the
 * member experience without being granted moderation or administration access.
 */
const SRP_TEST_CONTROL_EMAILS = [
    'ct.lopsan@gmail.com',
];

function srp_normalize_test_account_email(?string $email): string {
    return strtolower(trim((string)$email));
}

function srp_email_has_test_controls(?string $email): bool {
    return in_array(
        srp_normalize_test_account_email($email),
        SRP_TEST_CONTROL_EMAILS,
        true
    );
}

/**
 * Re-read the canonical email from the database instead of trusting a client
 * value or a potentially stale session field.
 */
function srp_user_has_test_controls(PDO $db, string $userId): bool {
    $stmt = $db->prepare('SELECT email FROM users WHERE user_id = :uid LIMIT 1');
    $stmt->execute([':uid' => $userId]);
    $email = $stmt->fetchColumn();
    return is_string($email) && srp_email_has_test_controls($email);
}
