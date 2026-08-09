<?php

declare(strict_types=1);

require_once __DIR__ . '/../db_connection.php';

/*
 * Idempotent University of Hartford profile fixture.
 *
 * Institutional names, address, phone, and campus locations are based on
 * public UHart information. Conversations and event details are illustrative.
 */

$db = getDB();
$universityName = 'University of Hartford';

$universityStmt = $db->prepare("
    SELECT id
    FROM communities
    WHERE name = :name AND community_type = 'university'
    LIMIT 1
");
$universityStmt->execute([':name' => $universityName]);
$universityId = normalizeId($universityStmt->fetchColumn());

if ($universityId === '') {
    fwrite(STDERR, "University of Hartford was not found; no demo data was written.\n");
    exit(1);
}

$preferredAmbassadorEmail = getenv('SRP_DEMO_AMBASSADOR_EMAIL') ?: 'demo.ambassador@studentsphere.example.com';
$preferredMemberEmail = getenv('SRP_DEMO_MEMBER_EMAIL') ?: 'demo.member@studentsphere.example.com';

$preferredUserStmt = $db->prepare("SELECT user_id FROM users WHERE email = :email LIMIT 1");
$preferredUserStmt->execute([':email' => $preferredAmbassadorEmail]);
$adminUserId = normalizeId($preferredUserStmt->fetchColumn());

if ($adminUserId === '') {
    $userStmt = $db->query("
        SELECT user_id
        FROM users
        ORDER BY CASE WHEN role_id = 5 THEN 0 ELSE 1 END, created_at ASC
        LIMIT 1
    ");
    $adminUserId = normalizeId($userStmt->fetchColumn());
}

$preferredUserStmt->execute([':email' => $preferredMemberEmail]);
$studentUserId = normalizeId($preferredUserStmt->fetchColumn());

if ($studentUserId === '') {
    $studentStmt = $db->prepare("
        SELECT user_id
        FROM users
        WHERE user_id <> :admin_id
        ORDER BY CASE WHEN role_id = 1 THEN 0 ELSE 1 END, created_at ASC
        LIMIT 1
    ");
    $studentStmt->execute([':admin_id' => $adminUserId]);
    $studentUserId = normalizeId($studentStmt->fetchColumn());
}

if ($adminUserId === '' || $studentUserId === '') {
    fwrite(STDERR, "Two existing users are required to seed realistic conversations.\n");
    exit(1);
}

$ids = [
    'barney' => 'cuhartbarney001',
    'ceta' => 'cuhartceta00001',
    'hartt' => 'cuharthartt0001',
    'forum_campus' => 'fuhartcampus001',
    'forum_academics' => 'fuhartacademics1',
    'forum_arts' => 'fuhartarts000001',
    'thread_hjg' => 'tuharthjg000001',
    'thread_advising' => 'tuhartadvising01',
    'thread_hartt' => 'tuharthartt0001',
    'post_hjg_question' => 'puharthjgq00001',
    'post_hjg_answer' => 'puharthjga00001',
    'post_advising_question' => 'puhartadvq00001',
    'post_advising_answer' => 'puhartadva00001',
    'post_hartt_question' => 'puhartharttq001',
    'post_hartt_answer' => 'puharthartta001',
    'pin_forum' => 'piuhartforum001',
    'pin_thread' => 'piuhartthread01',
    'question_parking' => 'quhartparking001',
    'question_library' => 'quhartlibrary001',
    'answer_parking' => 'auhartparking001',
    'answer_library' => 'auhartlibrary001',
    'ambassador' => 'ambuhartadmin001',
    'event_showcase' => 'evuhartshowcase1',
    'event_welcome' => 'evuhartwelcome01',
];

$db->beginTransaction();

try {
    $updateUniversity = $db->prepare("
        UPDATE communities
        SET
            location = :location,
            website = :website,
            phone = :phone,
            tagline = :tagline
        WHERE id = :id
    ");
    $updateUniversity->execute([
        ':location' => '200 Bloomfield Avenue, West Hartford, CT 06117',
        ':website' => 'https://www.hartford.edu/',
        ':phone' => '860.768.4100',
        ':tagline' => 'A diverse, comprehensive learning community spanning the arts, sciences, business, engineering, and health professions.',
        ':id' => $universityId,
    ]);

    $communityUpsert = $db->prepare("
        INSERT INTO communities (
            id, community_type, parent_community_id, name, location, website,
            phone, tagline, aliases, logo_path, primary_color, secondary_color,
            banner_path, created_at, updated_at
        )
        VALUES (
            :id, 'group', :parent_id, :name, :location, :website,
            :phone, :tagline, :aliases, :logo_path, :primary_color, :secondary_color,
            :banner_path, UTC_TIMESTAMP(), UTC_TIMESTAMP()
        )
        ON DUPLICATE KEY UPDATE
            parent_community_id = VALUES(parent_community_id),
            location = VALUES(location),
            website = VALUES(website),
            phone = VALUES(phone),
            tagline = VALUES(tagline),
            aliases = VALUES(aliases),
            logo_path = VALUES(logo_path),
            primary_color = VALUES(primary_color),
            secondary_color = VALUES(secondary_color),
            banner_path = VALUES(banner_path),
            updated_at = UTC_TIMESTAMP()
    ");

    $subcommunities = [
        [
            'id' => $ids['barney'],
            'name' => 'Barney School of Business',
            'website' => 'https://www.hartford.edu/academics/schools-colleges/barney/',
            'phone' => '860.768.4242',
            'tagline' => 'Career-ready business education built around practical experience and an entrepreneurial mindset.',
            'aliases' => json_encode(['Barney', 'Barney School']),
        ],
        [
            'id' => $ids['ceta'],
            'name' => 'College of Engineering, Technology, and Architecture',
            'website' => 'https://www.hartford.edu/academics/schools-colleges/ceta/',
            'phone' => '860.768.4844',
            'tagline' => 'Hands-on engineering, technology, and architecture programs with close faculty mentorship.',
            'aliases' => json_encode(['CETA']),
        ],
        [
            'id' => $ids['hartt'],
            'name' => 'The Hartt School',
            'website' => 'https://www.hartford.edu/academics/schools-colleges/hartt/',
            'phone' => '860.768.4465',
            'tagline' => 'Conservatory-based training in music, dance, and theatre where students turn passion into a profession.',
            'aliases' => json_encode(['Hartt']),
        ],
    ];

    foreach ($subcommunities as $community) {
        $communityUpsert->execute([
            ':id' => $community['id'],
            ':parent_id' => $universityId,
            ':name' => $community['name'],
            ':location' => '200 Bloomfield Avenue, West Hartford, CT 06117',
            ':website' => $community['website'],
            ':phone' => $community['phone'],
            ':tagline' => $community['tagline'],
            ':aliases' => $community['aliases'],
            ':logo_path' => '/uploads/logos/School Image.png',
            ':primary_color' => '#c02427',
            ':secondary_color' => '#ffffff',
            ':banner_path' => '/uploads/banners/DefaultBanner.jpeg',
        ]);
    }

    $ambassadorUpsert = $db->prepare("
        INSERT INTO ambassadors (id, user_id, community_id, community_role, added_at)
        VALUES (:id, :user_id, :community_id, 'admin', UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE community_role = 'admin'
    ");
    $ambassadorUpsert->execute([
        ':id' => $ids['ambassador'],
        ':user_id' => $adminUserId,
        ':community_id' => $universityId,
    ]);

    $forumUpsert = $db->prepare("
        INSERT INTO forums (
            forum_id, community_id, name, description, upvotes, downvotes,
            created_at, created_by, last_activity_at, is_locked, is_pinned,
            is_hidden, banner_path
        )
        VALUES (
            :id, :community_id, :name, :description, :upvotes, 0,
            DATE_SUB(UTC_TIMESTAMP(), INTERVAL :days DAY), :created_by,
            DATE_SUB(UTC_TIMESTAMP(), INTERVAL :activity_hours HOUR), 0, :is_pinned,
            0, :banner_path
        )
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            description = VALUES(description),
            upvotes = VALUES(upvotes),
            last_activity_at = VALUES(last_activity_at),
            is_pinned = VALUES(is_pinned),
            is_hidden = 0,
            banner_path = VALUES(banner_path)
    ");

    $forums = [
        [
            'id' => $ids['forum_campus'],
            'name' => 'Campus Life at UHart',
            'description' => 'Practical questions about campus spaces, dining, transportation, organizations, and student routines.',
            'upvotes' => 18,
            'days' => 35,
            'activity_hours' => 3,
            'is_pinned' => 1,
            'banner_path' => '/uploads/banners/DefaultBanner.jpeg',
            'tags' => ['campus-life', 'housing-&-dining'],
        ],
        [
            'id' => $ids['forum_academics'],
            'name' => 'Academics & Advising',
            'description' => 'Course planning, academic support, research opportunities, and cross-school collaboration.',
            'upvotes' => 14,
            'days' => 28,
            'activity_hours' => 8,
            'is_pinned' => 0,
            'banner_path' => '/uploads/banners/DefaultBanner.jpeg',
            'tags' => ['academics', 'research-opportunities'],
        ],
        [
            'id' => $ids['forum_arts'],
            'name' => 'Arts, Music & Performances',
            'description' => 'Performances, exhibitions, auditions, and creative work across Hartt and the Hartford Art School.',
            'upvotes' => 21,
            'days' => 21,
            'activity_hours' => 16,
            'is_pinned' => 0,
            'banner_path' => '/uploads/banners/DefaultBanner.jpeg',
            'tags' => ['campus-life'],
        ],
    ];

    $forumTagInsert = $db->prepare("
        INSERT IGNORE INTO forum_tags (forum_id, tag_id)
        SELECT :forum_id, tag_id FROM tags WHERE slug = :slug LIMIT 1
    ");

    foreach ($forums as $forum) {
        $forumUpsert->execute([
            ':id' => $forum['id'],
            ':community_id' => $universityId,
            ':name' => $forum['name'],
            ':description' => $forum['description'],
            ':upvotes' => $forum['upvotes'],
            ':days' => $forum['days'],
            ':created_by' => $adminUserId,
            ':activity_hours' => $forum['activity_hours'],
            ':is_pinned' => $forum['is_pinned'],
            ':banner_path' => $forum['banner_path'],
        ]);
        foreach ($forum['tags'] as $slug) {
            $forumTagInsert->execute([':forum_id' => $forum['id'], ':slug' => $slug]);
        }
    }

    $threadUpsert = $db->prepare("
        INSERT INTO threads (
            thread_id, forum_id, user_id, title, created_at, upvotes, downvotes,
            updated_at, last_activity_at, reply_count, is_locked, status, is_hidden
        )
        VALUES (
            :id, :forum_id, :user_id, :title,
            DATE_SUB(UTC_TIMESTAMP(), INTERVAL :days DAY), :upvotes, 0,
            DATE_SUB(UTC_TIMESTAMP(), INTERVAL :activity_hours HOUR),
            DATE_SUB(UTC_TIMESTAMP(), INTERVAL :activity_hours HOUR),
            1, 0, :status, 0
        )
        ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            upvotes = VALUES(upvotes),
            updated_at = VALUES(updated_at),
            last_activity_at = VALUES(last_activity_at),
            reply_count = 1,
            status = VALUES(status),
            is_hidden = 0
    ");

    $threads = [
        [
            'id' => $ids['thread_hjg'],
            'forum_id' => $ids['forum_campus'],
            'user_id' => $studentUserId,
            'title' => 'Best quiet study spaces in the Harry Jack Gray Center?',
            'days' => 5,
            'activity_hours' => 3,
            'upvotes' => 12,
            'status' => 'resolved',
            'tags' => ['campus-life', 'academics'],
        ],
        [
            'id' => $ids['thread_advising'],
            'forum_id' => $ids['forum_academics'],
            'user_id' => $studentUserId,
            'title' => 'How early should I plan a cross-college minor?',
            'days' => 8,
            'activity_hours' => 8,
            'upvotes' => 9,
            'status' => 'open',
            'tags' => ['academics'],
        ],
        [
            'id' => $ids['thread_hartt'],
            'forum_id' => $ids['forum_arts'],
            'user_id' => $studentUserId,
            'title' => 'Where are student performances and gallery openings announced?',
            'days' => 11,
            'activity_hours' => 16,
            'upvotes' => 16,
            'status' => 'resolved',
            'tags' => ['campus-life'],
        ],
    ];

    $threadTagInsert = $db->prepare("
        INSERT IGNORE INTO thread_tags (thread_id, tag_id)
        SELECT :thread_id, tag_id FROM tags WHERE slug = :slug LIMIT 1
    ");

    foreach ($threads as $thread) {
        $threadUpsert->execute([
            ':id' => $thread['id'],
            ':forum_id' => $thread['forum_id'],
            ':user_id' => $thread['user_id'],
            ':title' => $thread['title'],
            ':days' => $thread['days'],
            ':upvotes' => $thread['upvotes'],
            ':activity_hours' => $thread['activity_hours'],
            ':status' => $thread['status'],
        ]);
        foreach ($thread['tags'] as $slug) {
            $threadTagInsert->execute([':thread_id' => $thread['id'], ':slug' => $slug]);
        }
    }

    $postUpsert = $db->prepare("
        INSERT INTO posts (
            post_id, thread_id, user_id, content, created_at, updated_at,
            upvotes, downvotes, reply_to, verified, verified_by, verified_at, is_hidden
        )
        VALUES (
            :id, :thread_id, :user_id, :content,
            DATE_SUB(UTC_TIMESTAMP(), INTERVAL :hours HOUR),
            DATE_SUB(UTC_TIMESTAMP(), INTERVAL :hours HOUR),
            :upvotes, 0, :reply_to, :verified, :verified_by,
            CASE WHEN :verified = 1 THEN DATE_SUB(UTC_TIMESTAMP(), INTERVAL :hours HOUR) ELSE NULL END,
            0
        )
        ON DUPLICATE KEY UPDATE
            content = VALUES(content),
            upvotes = VALUES(upvotes),
            reply_to = VALUES(reply_to),
            verified = VALUES(verified),
            verified_by = VALUES(verified_by),
            verified_at = VALUES(verified_at),
            is_hidden = 0
    ");

    $posts = [
        [$ids['post_hjg_question'], $ids['thread_hjg'], $studentUserId, 'I have a gap between classes and need a quiet place with outlets. Which areas tend to work best?', 124, 5, null, 0],
        [$ids['post_hjg_answer'], $ids['thread_hjg'], $adminUserId, 'Mortensen Library is in the Harry Jack Gray Center. The upper levels are generally a good fit for focused work; reserveable and collaborative spaces may have different noise expectations.', 3, 14, $ids['post_hjg_question'], 1],
        [$ids['post_advising_question'], $ids['thread_advising'], $studentUserId, 'I am considering a minor outside my home college. When should I start comparing requirements with my advisor?', 196, 4, null, 0],
        [$ids['post_advising_answer'], $ids['thread_advising'], $adminUserId, 'Start during your first planning conversation if possible. Bring the minor requirements and a draft semester plan so your advisor can identify prerequisites and courses that may satisfy more than one requirement.', 8, 11, $ids['post_advising_question'], 1],
        [$ids['post_hartt_question'], $ids['thread_hartt'], $studentUserId, 'Is there one place to find public Hartt performances and Hartford Art School exhibitions?', 268, 7, null, 0],
        [$ids['post_hartt_answer'], $ids['thread_hartt'], $adminUserId, 'Start with the university events listings and the individual school calendars. Venue details matter: Wilde Auditorium is in the Harry Jack Gray Center, while other performances may use Lincoln Theater or the Handel Performing Arts Center.', 16, 18, $ids['post_hartt_question'], 1],
    ];

    foreach ($posts as [$id, $threadId, $userId, $content, $hours, $upvotes, $replyTo, $verified]) {
        $postUpsert->execute([
            ':id' => $id,
            ':thread_id' => $threadId,
            ':user_id' => $userId,
            ':content' => $content,
            ':hours' => $hours,
            ':upvotes' => $upvotes,
            ':reply_to' => $replyTo,
            ':verified' => $verified,
            ':verified_by' => $verified ? $adminUserId : null,
        ]);
    }

    $pinUpsert = $db->prepare("
        INSERT INTO pinned_items (id, community_id, item_type, item_id, pinned_at)
        VALUES (:id, :community_id, :item_type, :item_id, DATE_SUB(UTC_TIMESTAMP(), INTERVAL :days DAY))
        ON DUPLICATE KEY UPDATE
            item_type = VALUES(item_type),
            item_id = VALUES(item_id),
            pinned_at = VALUES(pinned_at)
    ");
    $pinUpsert->execute([
        ':id' => $ids['pin_forum'],
        ':community_id' => $universityId,
        ':item_type' => 'forum',
        ':item_id' => $ids['forum_campus'],
        ':days' => 14,
    ]);
    $pinUpsert->execute([
        ':id' => $ids['pin_thread'],
        ':community_id' => $universityId,
        ':item_type' => 'thread',
        ':item_id' => $ids['thread_advising'],
        ':days' => 2,
    ]);

    $questionUpsert = $db->prepare("
        INSERT INTO group_questions (
            question_id, group_id, user_id, title, body, status,
            approved_by, approved_at, created_at, updated_at
        )
        VALUES (
            :id, :group_id, :user_id, :title, :body, 'approved',
            :approved_by, DATE_SUB(UTC_TIMESTAMP(), INTERVAL :days DAY),
            DATE_SUB(UTC_TIMESTAMP(), INTERVAL :days DAY),
            DATE_SUB(UTC_TIMESTAMP(), INTERVAL :days DAY)
        )
        ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            body = VALUES(body),
            status = 'approved',
            approved_by = VALUES(approved_by),
            approved_at = VALUES(approved_at)
    ");
    $questions = [
        [
            'id' => $ids['question_parking'],
            'title' => 'Where should visitors check parking information before coming to campus?',
            'body' => 'I am inviting family to an afternoon program and want to make sure they use the correct visitor parking areas.',
            'days' => 9,
        ],
        [
            'id' => $ids['question_library'],
            'title' => 'Which libraries are located in the Harry Jack Gray Center?',
            'body' => 'I keep seeing references to Mortensen, Allen, and Harrison Libraries and would appreciate a quick explanation.',
            'days' => 6,
        ],
    ];
    foreach ($questions as $question) {
        $questionUpsert->execute([
            ':id' => $question['id'],
            ':group_id' => $universityId,
            ':user_id' => $studentUserId,
            ':title' => $question['title'],
            ':body' => $question['body'],
            ':approved_by' => $adminUserId,
            ':days' => $question['days'],
        ]);
    }

    $answerUpsert = $db->prepare("
        INSERT INTO group_question_answers (
            answer_id, question_id, ambassador_id, body, created_at
        )
        VALUES (
            :id, :question_id, :ambassador_id, :body,
            DATE_SUB(UTC_TIMESTAMP(), INTERVAL :days DAY)
        )
        ON DUPLICATE KEY UPDATE body = VALUES(body)
    ");
    $answerUpsert->execute([
        ':id' => $ids['answer_parking'],
        ':question_id' => $ids['question_parking'],
        ':ambassador_id' => $adminUserId,
        ':body' => 'Use the university map and transportation pages before arriving. Visitors should follow current campus signage and use spaces designated for visitors.',
        ':days' => 8,
    ]);
    $answerUpsert->execute([
        ':id' => $ids['answer_library'],
        ':question_id' => $ids['question_library'],
        ':ambassador_id' => $adminUserId,
        ':body' => 'Mortensen Library and the Allen Music and Dance Library together make up Harrison Libraries, located in the Harry Jack Gray Center.',
        ':days' => 5,
    ]);

    $eventUpsert = $db->prepare("
        INSERT INTO events (
            event_id, community_id, created_by, event_type, title, description,
            start_at, end_at, timezone, is_virtual, location, meeting_provider,
            meeting_link, capacity, requires_registration, allowed_audiences, is_hidden
        )
        VALUES (
            :id, :community_id, :created_by, 'webinar', :title, :description,
            :start_at, :end_at, 'America/New_York', 0, :location, 'other',
            :meeting_link, :capacity, 1, :allowed_audiences, 0
        )
        ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            description = VALUES(description),
            start_at = VALUES(start_at),
            end_at = VALUES(end_at),
            timezone = VALUES(timezone),
            is_virtual = 0,
            location = VALUES(location),
            meeting_provider = 'other',
            meeting_link = VALUES(meeting_link),
            capacity = VALUES(capacity),
            allowed_audiences = VALUES(allowed_audiences),
            is_hidden = 0
    ");

    $eventTimezone = new DateTimeZone('America/New_York');
    $utcTimezone = new DateTimeZone('UTC');
    $showcaseStart = (new DateTimeImmutable('+7 days 18:00', $eventTimezone))->setTimezone($utcTimezone);
    $showcaseEnd = $showcaseStart->modify('+90 minutes');
    $welcomeStart = (new DateTimeImmutable('+12 days 20:00', $eventTimezone))->setTimezone($utcTimezone);
    $welcomeEnd = $welcomeStart->modify('+60 minutes');

    $eventUpsert->execute([
        ':id' => $ids['event_showcase'],
        ':community_id' => $universityId,
        ':created_by' => $adminUserId,
        ':title' => 'Student Research & Creative Work Showcase',
        ':description' => 'An interdisciplinary evening of student research posters, design work, performances, and conversation across UHart schools and colleges.',
        ':start_at' => $showcaseStart->format('Y-m-d H:i:s'),
        ':end_at' => $showcaseEnd->format('Y-m-d H:i:s'),
        ':location' => 'Harry Jack Gray Center',
        ':meeting_link' => 'https://www.hartford.edu/about/buildings-locations/',
        ':capacity' => 120,
        ':allowed_audiences' => json_encode(['public', 'members', 'verified', 'ambassadors', 'admins']),
    ]);
    $eventUpsert->execute([
        ':id' => $ids['event_welcome'],
        ':community_id' => $universityId,
        ':created_by' => $adminUserId,
        ':title' => 'UHart Community Welcome & Campus Q+A',
        ':description' => 'A practical orientation-style session covering campus resources, student organizations, academic support, and questions from new community members.',
        ':start_at' => $welcomeStart->format('Y-m-d H:i:s'),
        ':end_at' => $welcomeEnd->format('Y-m-d H:i:s'),
        ':location' => 'Wilde Auditorium',
        ':meeting_link' => 'https://www.hartford.edu/contact.aspx',
        ':capacity' => 180,
        ':allowed_audiences' => json_encode(['public', 'members', 'verified', 'ambassadors', 'admins']),
    ]);

    $db->commit();

    echo json_encode([
        'success' => true,
        'university_id' => $universityId,
        'subcommunities' => count($subcommunities),
        'forums' => count($forums),
        'threads' => count($threads),
        'posts' => count($posts),
        'questions' => count($questions),
        'events' => 2,
    ], JSON_PRETTY_PRINT) . PHP_EOL;
} catch (Throwable $error) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    fwrite(STDERR, "Unable to seed University of Hartford demo data: {$error->getMessage()}\n");
    exit(1);
}
