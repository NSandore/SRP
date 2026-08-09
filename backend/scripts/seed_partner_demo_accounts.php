<?php

declare(strict_types=1);

require_once __DIR__ . '/../db_connection.php';

/*
 * Idempotent fictional partner-demo accounts and interaction fixture.
 *
 * Required environment variables:
 *   DEMO_MEMBER_PASSWORD
 *   DEMO_AMBASSADOR_PASSWORD
 *   DEMO_ADMIN_PASSWORD
 *   DEMO_PROSPECT_PASSWORD
 *
 * Recommended order when rebuilding from an empty database:
 *   1. Run this script once to create the fictional users.
 *   2. Run seed_uhart_profile_demo.php to create UHart content using them.
 *   3. Run this script again to attach saves, votes, RSVP, reports, and a poll.
 *
 * No real email addresses or identity documents are used.
 */

$db = getDB();

$communityStmt = $db->prepare("
    SELECT id
    FROM communities
    WHERE name = :name AND community_type = 'university'
    LIMIT 1
");
$communityStmt->execute([':name' => 'University of Hartford']);
$universityId = normalizeId($communityStmt->fetchColumn());

if ($universityId === '') {
    fwrite(STDERR, "University of Hartford was not found; no demo accounts were written.\n");
    exit(1);
}

$passwordEnv = [
    'member' => 'DEMO_MEMBER_PASSWORD',
    'ambassador' => 'DEMO_AMBASSADOR_PASSWORD',
    'admin' => 'DEMO_ADMIN_PASSWORD',
    'prospect' => 'DEMO_PROSPECT_PASSWORD',
];

$passwords = [];
foreach ($passwordEnv as $key => $envName) {
    $password = (string)(getenv($envName) ?: '');
    if (strlen($password) < 12) {
        fwrite(STDERR, "{$envName} is required and must be at least 12 characters.\n");
        exit(1);
    }
    $passwords[$key] = $password;
}

$ids = [
    'member' => 'udemo2026member01',
    'ambassador' => 'udemo2026ambass01',
    'admin' => 'udemo2026admin001',
    'prospect' => 'udemo2026prospect',
    'ambassador_row' => 'ambuhartadmin001',
    'member_education' => 'eddemo2026member',
    'ambassador_education' => 'eddemo2026ambass',
    'member_experience' => 'exdemo2026member',
    'ambassador_experience' => 'exdemo2026ambass',
    'connection_member_ambassador' => 'xdemo2026accepted',
    'connection_prospect_member' => 'xdemo2026incoming',
    'connection_member_admin' => 'xdemo2026outgoing',
    'message_one' => 'mdemo2026welcome1',
    'message_two' => 'mdemo2026welcome2',
    'message_three' => 'mdemo2026welcome3',
    'poll' => 'pldemo2026priorities',
    'poll_option_community' => 'podemo2026community',
    'poll_option_funding' => 'podemo2026funding',
    'poll_option_events' => 'podemo2026events',
    'poll_option_mentors' => 'podemo2026mentors',
    'poll_vote_ambassador' => 'pvdemo2026ambass',
    'poll_vote_prospect' => 'pvdemo2026prospect',
    'report' => 'rpdemo2026review',
    'request' => 'rdemo2026groupreq',
    'verification_request' => 'vrdemo2026prospect',
];

$accounts = [
    'member' => [
        'user_id' => $ids['member'],
        'role_id' => 1,
        'first_name' => 'Maya',
        'last_name' => 'Bennett',
        'email' => 'demo.member@studentsphere.example.com',
        'education_status' => 'Student',
        'headline' => 'Digital Media student exploring campus life and creative opportunities',
        'about' => 'I am interested in design, student organizations, financial-aid resources, and meeting people across campus. Fictional profile created for the StudentSphere partner demo.',
        'skills' => 'Visual Design, Student Leadership, Content Strategy, Research',
        'verified' => 1,
        'verified_community_id' => $universityId,
        'is_ambassador' => 0,
        'primary_color' => '#7C3AED',
        'secondary_color' => '#4C1D95',
    ],
    'ambassador' => [
        'user_id' => $ids['ambassador'],
        'role_id' => 1,
        'first_name' => 'Jordan',
        'last_name' => 'Ellis',
        'email' => 'demo.ambassador@studentsphere.example.com',
        'education_status' => 'Staff / Representative',
        'headline' => 'Student Success Ambassador · University of Hartford',
        'about' => 'I help students find campus resources, connect with the right offices, and get practical answers about university life. Fictional profile created for the StudentSphere partner demo.',
        'skills' => 'Student Success, Academic Advising, Community Building, Event Planning',
        'verified' => 1,
        'verified_community_id' => $universityId,
        'is_ambassador' => 1,
        'primary_color' => '#C02427',
        'secondary_color' => '#7F1D1D',
    ],
    'admin' => [
        'user_id' => $ids['admin'],
        'role_id' => 5,
        'first_name' => 'Avery',
        'last_name' => 'Morgan',
        'email' => 'demo.admin@studentsphere.example.com',
        'education_status' => 'Staff / Representative',
        'headline' => 'StudentSphere Platform Administrator',
        'about' => 'I oversee platform safety, community operations, and verification review. Fictional profile created for the StudentSphere partner demo.',
        'skills' => 'Platform Operations, Trust & Safety, Community Governance',
        'verified' => 0,
        'verified_community_id' => null,
        'is_ambassador' => 0,
        'primary_color' => '#0F766E',
        'secondary_color' => '#134E4A',
    ],
    'prospect' => [
        'user_id' => $ids['prospect'],
        'role_id' => 1,
        'first_name' => 'Riley',
        'last_name' => 'Chen',
        'email' => 'demo.prospect@studentsphere.example.com',
        'education_status' => 'Prospect',
        'headline' => 'Prospective student comparing creative programs and campus communities',
        'about' => 'I am researching programs, scholarships, student life, and the questions I should ask before applying. Fictional profile created for the StudentSphere partner demo.',
        'skills' => 'Photography, Writing, Research',
        'verified' => 0,
        'verified_community_id' => null,
        'is_ambassador' => 0,
        'primary_color' => '#2563EB',
        'secondary_color' => '#1E3A8A',
    ],
];

$fixtureIds = [
    'forum_campus' => 'fuhartcampus001',
    'forum_academics' => 'fuhartacademics1',
    'thread_hjg' => 'tuharthjg000001',
    'thread_advising' => 'tuhartadvising01',
    'post_hjg_question' => 'puharthjgq00001',
    'post_hjg_answer' => 'puharthjga00001',
    'post_advising_question' => 'puhartadvq00001',
    'post_advising_answer' => 'puhartadva00001',
    'event_showcase' => 'evuhartshowcase1',
    'event_welcome' => 'evuhartwelcome01',
];

$db->beginTransaction();

try {
    $userUpsert = $db->prepare("
        INSERT INTO users (
            user_id, role_id, recent_university_id, first_name, last_name, email,
            password_hash, education_status, is_over_18, headline, about, skills,
            avatar_path, banner_path, primary_color, secondary_color, verified,
            verified_community_id, is_ambassador, login_count, is_verified, is_public,
            created_at, updated_at
        ) VALUES (
            :user_id, :role_id, :recent_university_id, :first_name, :last_name, :email,
            :password_hash, :education_status, 1, :headline, :about, :skills,
            '/uploads/avatars/DefaultAvatar.png', '/uploads/banners/DefaultBanner.jpeg',
            :primary_color, :secondary_color, :verified, :verified_community_id,
            :is_ambassador, 3, 1, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()
        )
        ON DUPLICATE KEY UPDATE
            role_id = VALUES(role_id),
            recent_university_id = VALUES(recent_university_id),
            first_name = VALUES(first_name),
            last_name = VALUES(last_name),
            email = VALUES(email),
            password_hash = VALUES(password_hash),
            education_status = VALUES(education_status),
            is_over_18 = 1,
            headline = VALUES(headline),
            about = VALUES(about),
            skills = VALUES(skills),
            primary_color = VALUES(primary_color),
            secondary_color = VALUES(secondary_color),
            verified = VALUES(verified),
            verified_community_id = VALUES(verified_community_id),
            is_ambassador = VALUES(is_ambassador),
            login_count = 3,
            is_verified = 1,
            is_public = 1,
            updated_at = UTC_TIMESTAMP()
    ");

    foreach ($accounts as $key => $account) {
        $userUpsert->execute([
            ':user_id' => $account['user_id'],
            ':role_id' => $account['role_id'],
            ':recent_university_id' => $key === 'admin' ? null : $universityId,
            ':first_name' => $account['first_name'],
            ':last_name' => $account['last_name'],
            ':email' => $account['email'],
            ':password_hash' => password_hash($passwords[$key], PASSWORD_DEFAULT),
            ':education_status' => $account['education_status'],
            ':headline' => $account['headline'],
            ':about' => $account['about'],
            ':skills' => $account['skills'],
            ':primary_color' => $account['primary_color'],
            ':secondary_color' => $account['secondary_color'],
            ':verified' => $account['verified'],
            ':verified_community_id' => $account['verified_community_id'],
            ':is_ambassador' => $account['is_ambassador'],
        ]);
    }

    $settingsUpsert = $db->prepare("
        INSERT INTO account_settings (
            user_id, profile_visibility, show_online, allow_messages_from,
            show_email, discoverable, notif_in_app, notif_email, notif_replies,
            notif_messages, security_2fa, session_timeout_minutes, default_feed,
            auto_join_campus, extras
        ) VALUES (
            :user_id, :profile_visibility, 1, 'everyone', 0, 1, 1, 1, 1, 1,
            0, 60, :default_feed, 1, :extras
        )
        ON DUPLICATE KEY UPDATE
            profile_visibility = VALUES(profile_visibility),
            show_online = 1,
            allow_messages_from = 'everyone',
            show_email = 0,
            discoverable = 1,
            notif_in_app = 1,
            notif_email = 1,
            notif_replies = 1,
            notif_messages = 1,
            security_2fa = 0,
            session_timeout_minutes = 60,
            default_feed = VALUES(default_feed),
            auto_join_campus = 1,
            extras = VALUES(extras)
    ");

    foreach ($accounts as $key => $account) {
        $extras = [
            'allow_messages_from' => 'everyone',
            'notify_replies' => true,
            'notify_votes' => true,
            'notify_events' => true,
            'onboarding' => [
                'status' => 'completed',
                'current_step' => 9,
                'completed_steps' => [1, 2, 3, 4, 5, 6, 7, 9],
                'interests_selected' => true,
                'verification_skipped' => $account['verified'] !== 1,
            ],
        ];
        $settingsUpsert->execute([
            ':user_id' => $account['user_id'],
            ':profile_visibility' => $key === 'admin' ? 'private' : 'network',
            ':default_feed' => $key === 'member' ? 'yourFeed' : 'explore',
            ':extras' => json_encode($extras, JSON_THROW_ON_ERROR),
        ]);
    }

    $ambassadorUpsert = $db->prepare("
        INSERT INTO ambassadors (id, user_id, community_id, community_role, added_at)
        VALUES (:id, :user_id, :community_id, 'admin', UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            community_id = VALUES(community_id),
            community_role = 'admin'
    ");
    $ambassadorUpsert->execute([
        ':id' => $ids['ambassador_row'],
        ':user_id' => $ids['ambassador'],
        ':community_id' => $universityId,
    ]);

    // Keep the original UHart fixture IDs, but ensure they belong only to fictional demo users.
    $db->prepare("UPDATE ambassadors SET user_id = :uid, community_role = 'admin' WHERE id = 'ambuhartadmin001'")
        ->execute([':uid' => $ids['ambassador']]);
    $db->prepare("UPDATE forums SET created_by = :uid WHERE forum_id IN ('fuhartcampus001','fuhartacademics1','fuhartarts000001')")
        ->execute([':uid' => $ids['ambassador']]);
    $db->prepare("UPDATE threads SET user_id = :uid WHERE thread_id IN ('tuharthjg000001','tuhartadvising01','tuharthartt0001')")
        ->execute([':uid' => $ids['member']]);
    $db->prepare("UPDATE posts SET user_id = :uid WHERE post_id IN ('puharthjgq00001','puhartadvq00001','puhartharttq001')")
        ->execute([':uid' => $ids['member']]);
    $db->prepare("
        UPDATE posts
        SET user_id = :uid, verified_by = CASE WHEN verified = 1 THEN :uid ELSE verified_by END
        WHERE post_id IN ('puharthjga00001','puhartadva00001','puharthartta001')
    ")->execute([':uid' => $ids['ambassador']]);
    $db->prepare("UPDATE group_questions SET user_id = :member, approved_by = :ambassador WHERE question_id IN ('quhartparking001','quhartlibrary001')")
        ->execute([':member' => $ids['member'], ':ambassador' => $ids['ambassador']]);
    $db->prepare("UPDATE group_question_answers SET ambassador_id = :uid WHERE answer_id IN ('auhartparking001','auhartlibrary001')")
        ->execute([':uid' => $ids['ambassador']]);
    $db->prepare("UPDATE events SET created_by = :uid WHERE event_id IN ('evuhartshowcase1','evuhartwelcome01')")
        ->execute([':uid' => $ids['ambassador']]);

    $educationUpsert = $db->prepare("
        INSERT INTO user_education (
            education_id, user_id, degree, field_of_study, honors,
            activities_societies, institution, start_date, end_date, duration
        ) VALUES (
            :education_id, :user_id, :degree, :field_of_study, :honors,
            :activities_societies, :institution, :start_date, :end_date, :duration
        )
        ON DUPLICATE KEY UPDATE
            degree = VALUES(degree),
            field_of_study = VALUES(field_of_study),
            honors = VALUES(honors),
            activities_societies = VALUES(activities_societies),
            institution = VALUES(institution),
            start_date = VALUES(start_date),
            end_date = VALUES(end_date),
            duration = VALUES(duration)
    ");
    $educationUpsert->execute([
        ':education_id' => $ids['member_education'],
        ':user_id' => $ids['member'],
        ':degree' => 'Bachelor of Fine Arts',
        ':field_of_study' => 'Visual Communication Design',
        ':honors' => 'Dean\'s List',
        ':activities_societies' => 'Design Collective, Student Media',
        ':institution' => 'University of Hartford',
        ':start_date' => '2024-08-26',
        ':end_date' => '2028-05-15',
        ':duration' => '2024 – 2028 (expected)',
    ]);
    $educationUpsert->execute([
        ':education_id' => $ids['ambassador_education'],
        ':user_id' => $ids['ambassador'],
        ':degree' => 'Master of Education',
        ':field_of_study' => 'Student Affairs Administration',
        ':honors' => '',
        ':activities_societies' => 'Graduate Student Council',
        ':institution' => 'University of Hartford',
        ':start_date' => '2020-08-24',
        ':end_date' => '2022-05-15',
        ':duration' => '2020 – 2022',
    ]);

    $experienceUpsert = $db->prepare("
        INSERT INTO user_experience (
            experience_id, user_id, title, company, industry, employment_type,
            start_date, end_date, location_city, location_state, location_country,
            duration, description, responsibilities
        ) VALUES (
            :experience_id, :user_id, :title, :company, :industry, :employment_type,
            :start_date, :end_date, :location_city, :location_state, 'United States',
            :duration, :description, :responsibilities
        )
        ON DUPLICATE KEY UPDATE
            title = VALUES(title), company = VALUES(company), industry = VALUES(industry),
            employment_type = VALUES(employment_type), start_date = VALUES(start_date),
            end_date = VALUES(end_date), location_city = VALUES(location_city),
            location_state = VALUES(location_state), duration = VALUES(duration),
            description = VALUES(description), responsibilities = VALUES(responsibilities)
    ");
    $experienceUpsert->execute([
        ':experience_id' => $ids['member_experience'],
        ':user_id' => $ids['member'],
        ':title' => 'Student Communications Assistant',
        ':company' => 'Campus Arts Collective',
        ':industry' => 'Higher Education',
        ':employment_type' => 'Part-time',
        ':start_date' => '2025-09-01',
        ':end_date' => null,
        ':location_city' => 'West Hartford',
        ':location_state' => 'Connecticut',
        ':duration' => 'September 2025 – Present',
        ':description' => 'Creates student-facing event and community content.',
        ':responsibilities' => json_encode(['Event promotion', 'Student interviews', 'Visual content']),
    ]);
    $experienceUpsert->execute([
        ':experience_id' => $ids['ambassador_experience'],
        ':user_id' => $ids['ambassador'],
        ':title' => 'Student Success Ambassador',
        ':company' => 'University of Hartford',
        ':industry' => 'Higher Education',
        ':employment_type' => 'Full-time',
        ':start_date' => '2022-07-01',
        ':end_date' => null,
        ':location_city' => 'West Hartford',
        ':location_state' => 'Connecticut',
        ':duration' => 'July 2022 – Present',
        ':description' => 'Connects students with academic, campus-life, and support resources.',
        ':responsibilities' => json_encode(['Community Q&A', 'Student referrals', 'Campus events']),
    ]);

    $followUpsert = $db->prepare("
        INSERT INTO followed_communities (id, user_id, community_id, created_at)
        VALUES (:id, :user_id, :community_id, UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE community_id = VALUES(community_id)
    ");
    foreach ([$ids['member'], $ids['ambassador'], $ids['prospect']] as $index => $userId) {
        $followUpsert->execute([
            ':id' => 'ldemo2026uhart' . ($index + 1),
            ':user_id' => $userId,
            ':community_id' => $universityId,
        ]);
    }
    foreach ([$ids['member'], $ids['prospect']] as $index => $userId) {
        $followUpsert->execute([
            ':id' => 'ldemo2026hartt' . ($index + 1),
            ':user_id' => $userId,
            ':community_id' => 'cuharthartt0001',
        ]);
    }

    $interestInsert = $db->prepare("
        INSERT IGNORE INTO user_interests (id, user_id, tag_id)
        SELECT :id, :user_id, tag_id FROM tags WHERE slug = :slug LIMIT 1
    ");
    $interestSets = [
        'member' => ['campus-life', 'financial-aid', 'scholarships', 'academics'],
        'ambassador' => ['campus-life', 'academics', 'career-services', 'mental-health-&-wellness'],
        'prospect' => ['admissions', 'applications', 'financial-aid', 'campus-life'],
        'admin' => ['academics', 'diversity-&-inclusion'],
    ];
    foreach ($interestSets as $accountKey => $slugs) {
        foreach ($slugs as $index => $slug) {
            $interestInsert->execute([
                ':id' => 'uidemo' . substr($accountKey, 0, 3) . str_pad((string)$index, 2, '0', STR_PAD_LEFT),
                ':user_id' => $ids[$accountKey],
                ':slug' => $slug,
            ]);
        }
    }

    $userFollowUpsert = $db->prepare("
        INSERT INTO user_follows (id, follower_id, followed_user_id, followed_at)
        VALUES (:id, :follower_id, :followed_user_id, UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE followed_at = VALUES(followed_at)
    ");
    $userFollows = [
        ['fdemo2026memberamb', $ids['member'], $ids['ambassador']],
        ['fdemo2026ambmember', $ids['ambassador'], $ids['member']],
        ['fdemo2026promember', $ids['prospect'], $ids['member']],
    ];
    foreach ($userFollows as [$id, $follower, $followed]) {
        $userFollowUpsert->execute([':id' => $id, ':follower_id' => $follower, ':followed_user_id' => $followed]);
    }

    $connectionUpsert = $db->prepare("
        INSERT INTO connections (
            connection_id, user_id1, user_id2, status, requested_at, accepted_at
        ) VALUES (
            :connection_id, :user_id1, :user_id2, :status,
            DATE_SUB(UTC_TIMESTAMP(), INTERVAL :days DAY),
            CASE WHEN :status = 'accepted' THEN DATE_SUB(UTC_TIMESTAMP(), INTERVAL :accepted_days DAY) ELSE NULL END
        )
        ON DUPLICATE KEY UPDATE
            user_id1 = VALUES(user_id1), user_id2 = VALUES(user_id2),
            status = VALUES(status), requested_at = VALUES(requested_at),
            accepted_at = VALUES(accepted_at)
    ");
    $connections = [
        [$ids['connection_member_ambassador'], $ids['member'], $ids['ambassador'], 'accepted', 18, 17],
        [$ids['connection_prospect_member'], $ids['prospect'], $ids['member'], 'pending', 2, 0],
        [$ids['connection_member_admin'], $ids['member'], $ids['admin'], 'pending', 1, 0],
    ];
    foreach ($connections as [$id, $user1, $user2, $status, $days, $acceptedDays]) {
        $connectionUpsert->execute([
            ':connection_id' => $id,
            ':user_id1' => $user1,
            ':user_id2' => $user2,
            ':status' => $status,
            ':days' => $days,
            ':accepted_days' => $acceptedDays,
        ]);
    }

    $conversationStmt = $db->prepare("
        SELECT conversation_id FROM messages
        WHERE message_id IN (:m1, :m2, :m3) AND conversation_id IS NOT NULL
        LIMIT 1
    ");
    $conversationStmt->execute([
        ':m1' => $ids['message_one'],
        ':m2' => $ids['message_two'],
        ':m3' => $ids['message_three'],
    ]);
    $conversationId = (int)($conversationStmt->fetchColumn() ?: 0);
    if ($conversationId <= 0) {
        $conversationId = (int)$db->query("SELECT COALESCE(MAX(conversation_id), 0) + 1 FROM messages")->fetchColumn();
    }

    $messageUpsert = $db->prepare("
        INSERT INTO messages (
            message_id, sender_id, recipient_id, conversation_id, content,
            created_at, updated_at, is_read
        ) VALUES (
            :message_id, :sender_id, :recipient_id, :conversation_id, :content,
            DATE_SUB(UTC_TIMESTAMP(), INTERVAL :minutes MINUTE),
            DATE_SUB(UTC_TIMESTAMP(), INTERVAL :minutes MINUTE), :is_read
        )
        ON DUPLICATE KEY UPDATE
            sender_id = VALUES(sender_id), recipient_id = VALUES(recipient_id),
            conversation_id = VALUES(conversation_id), content = VALUES(content),
            created_at = VALUES(created_at), updated_at = VALUES(updated_at),
            is_read = VALUES(is_read)
    ");
    $messages = [
        [$ids['message_one'], $ids['member'], $ids['ambassador'], 'Hi Jordan — I am putting together a list of campus resources for new students. Where would you start?', 180, 1],
        [$ids['message_two'], $ids['ambassador'], $ids['member'], 'Great idea. Start with academic support, student organizations, counseling, and the campus events calendar. I can also point you to the right offices.', 165, 1],
        [$ids['message_three'], $ids['ambassador'], $ids['member'], 'I just pinned the campus-life guide to the UHart community. Let me know what still feels hard to find.', 12, 0],
    ];
    foreach ($messages as [$messageId, $sender, $recipient, $content, $minutes, $isRead]) {
        $messageUpsert->execute([
            ':message_id' => $messageId,
            ':sender_id' => $sender,
            ':recipient_id' => $recipient,
            ':conversation_id' => $conversationId,
            ':content' => $content,
            ':minutes' => $minutes,
            ':is_read' => $isRead,
        ]);
    }

    $existingFixture = static function (PDO $db, string $table, string $column, string $id): bool {
        $stmt = $db->prepare("SELECT 1 FROM {$table} WHERE {$column} = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        return (bool)$stmt->fetchColumn();
    };

    $savedCount = 0;
    $saveSpecs = [
        ['saved_forums', 'sdemo2026forum', 'forum_id', $fixtureIds['forum_campus']],
        ['saved_threads', 'sdemo2026thread', 'thread_id', $fixtureIds['thread_advising']],
        ['saved_posts', 'sdemo2026post', 'post_id', $fixtureIds['post_advising_answer']],
    ];
    foreach ($saveSpecs as [$table, $saveId, $itemColumn, $itemId]) {
        $sourceTable = $table === 'saved_forums' ? 'forums' : ($table === 'saved_threads' ? 'threads' : 'posts');
        $sourcePk = $table === 'saved_forums' ? 'forum_id' : ($table === 'saved_threads' ? 'thread_id' : 'post_id');
        if (!$existingFixture($db, $sourceTable, $sourcePk, $itemId)) continue;
        $stmt = $db->prepare("
            INSERT INTO {$table} (id, user_id, {$itemColumn}, saved_at)
            VALUES (:id, :user_id, :item_id, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY))
            ON DUPLICATE KEY UPDATE saved_at = VALUES(saved_at)
        ");
        $stmt->execute([':id' => $saveId, ':user_id' => $ids['member'], ':item_id' => $itemId]);
        $savedCount++;
    }

    $voteSpecs = [
        ['forum_votes', 'vdemo2026forum', 'forum_id', $fixtureIds['forum_campus']],
        ['thread_votes', 'vdemo2026thread', 'thread_id', $fixtureIds['thread_hjg']],
        ['post_votes', 'vdemo2026post', 'post_id', $fixtureIds['post_hjg_answer']],
    ];
    foreach ($voteSpecs as [$table, $voteId, $itemColumn, $itemId]) {
        $sourceTable = $table === 'forum_votes' ? 'forums' : ($table === 'thread_votes' ? 'threads' : 'posts');
        $sourcePk = $itemColumn;
        if (!$existingFixture($db, $sourceTable, $sourcePk, $itemId)) continue;
        $stmt = $db->prepare("
            INSERT INTO {$table} (id, {$itemColumn}, user_id, vote_type, created_at)
            VALUES (:id, :item_id, :user_id, 'up', UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE vote_type = 'up', created_at = VALUES(created_at)
        ");
        $stmt->execute([':id' => $voteId, ':item_id' => $itemId, ':user_id' => $ids['member']]);
    }

    $rsvpCount = 0;
    foreach ([$fixtureIds['event_showcase'], $fixtureIds['event_welcome']] as $index => $eventId) {
        if (!$existingFixture($db, 'events', 'event_id', $eventId)) continue;
        $stmt = $db->prepare("
            INSERT INTO event_registrations (id, event_id, user_id, status, registered_at)
            VALUES (:id, :event_id, :user_id, 'registered', DATE_SUB(UTC_TIMESTAMP(), INTERVAL :days DAY))
            ON DUPLICATE KEY UPDATE status = 'registered', registered_at = VALUES(registered_at)
        ");
        $stmt->execute([
            ':id' => 'erdemo2026event' . ($index + 1),
            ':event_id' => $eventId,
            ':user_id' => $ids['member'],
            ':days' => 3 - $index,
        ]);
        $rsvpCount++;
    }

    $pollUpsert = $db->prepare("
        INSERT INTO polls (
            poll_id, community_id, created_by, question, description,
            is_anonymous, allow_multiple_choices, opens_at, closes_at
        ) VALUES (
            :poll_id, :community_id, :created_by, :question, :description,
            0, 0, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 21 DAY)
        )
        ON DUPLICATE KEY UPDATE
            community_id = VALUES(community_id), created_by = VALUES(created_by),
            question = VALUES(question), description = VALUES(description),
            is_anonymous = 0, allow_multiple_choices = 0,
            opens_at = UTC_TIMESTAMP(), closes_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 21 DAY)
    ");
    $pollUpsert->execute([
        ':poll_id' => $ids['poll'],
        ':community_id' => $universityId,
        ':created_by' => $ids['ambassador'],
        ':question' => 'Which StudentSphere resource would help you most this semester?',
        ':description' => 'A fictional demo poll for gathering partner feedback on product priorities.',
    ]);

    $pollOptionUpsert = $db->prepare("
        INSERT INTO poll_options (option_id, poll_id, option_text, position)
        VALUES (:option_id, :poll_id, :option_text, :position)
        ON DUPLICATE KEY UPDATE option_text = VALUES(option_text), position = VALUES(position)
    ");
    $pollOptions = [
        [$ids['poll_option_community'], 'A clearer campus community directory', 0],
        [$ids['poll_option_funding'], 'Scholarship and funding matches', 1],
        [$ids['poll_option_events'], 'More events and workshops', 2],
        [$ids['poll_option_mentors'], 'Student and alumni mentors', 3],
    ];
    foreach ($pollOptions as [$optionId, $text, $position]) {
        $pollOptionUpsert->execute([
            ':option_id' => $optionId,
            ':poll_id' => $ids['poll'],
            ':option_text' => $text,
            ':position' => $position,
        ]);
    }

    $pollVoteUpsert = $db->prepare("
        INSERT INTO poll_votes (vote_id, poll_id, option_id, user_id, created_at)
        VALUES (:vote_id, :poll_id, :option_id, :user_id, UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE option_id = VALUES(option_id), created_at = VALUES(created_at)
    ");
    $pollVoteUpsert->execute([
        ':vote_id' => $ids['poll_vote_ambassador'],
        ':poll_id' => $ids['poll'],
        ':option_id' => $ids['poll_option_community'],
        ':user_id' => $ids['ambassador'],
    ]);
    $pollVoteUpsert->execute([
        ':vote_id' => $ids['poll_vote_prospect'],
        ':poll_id' => $ids['poll'],
        ':option_id' => $ids['poll_option_funding'],
        ':user_id' => $ids['prospect'],
    ]);

    $reportCreated = false;
    if ($existingFixture($db, 'posts', 'post_id', $fixtureIds['post_advising_answer'])) {
        $reportUpsert = $db->prepare("
            INSERT INTO reports (
                report_id, item_type, item_id, forum_id, thread_id, community_id,
                reported_by, reason, details, item_context, status, severity,
                reason_code, reason_text, created_at, updated_at
            ) VALUES (
                :report_id, 'post', :item_id, :forum_id, :thread_id, :community_id,
                :reported_by, 'Potentially outdated information',
                'Demo report: please confirm whether the advising guidance is still current.',
                'Start during your first planning conversation if possible.',
                'pending', 'low', 'other', 'Potentially outdated information',
                DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 HOUR), UTC_TIMESTAMP()
            )
            ON DUPLICATE KEY UPDATE
                status = 'pending', resolution_notes = NULL, resolved_by = NULL,
                resolved_at = NULL, updated_at = UTC_TIMESTAMP()
        ");
        $reportUpsert->execute([
            ':report_id' => $ids['report'],
            ':item_id' => $fixtureIds['post_advising_answer'],
            ':forum_id' => $fixtureIds['forum_academics'],
            ':thread_id' => $fixtureIds['thread_advising'],
            ':community_id' => $universityId,
            ':reported_by' => $ids['member'],
        ]);
        $reportCreated = true;
    }

    $requestUpsert = $db->prepare("
        INSERT INTO community_creation_requests (
            id, user_email, name, community_type, parent_community_id,
            description, status, created_at, tagline, location, website,
            primary_color, secondary_color
        ) VALUES (
            :id, :email, 'First-Generation Student Network', 'group', :parent_id,
            'A fictional requested group for peer support, campus navigation, and shared resources.',
            'pending', UTC_TIMESTAMP(), 'Navigating college together',
            'West Hartford, Connecticut', '', '#2563EB', '#DBEAFE'
        )
        ON DUPLICATE KEY UPDATE
            user_email = VALUES(user_email), description = VALUES(description),
            status = 'pending', created_at = UTC_TIMESTAMP()
    ");
    $requestUpsert->execute([
        ':id' => $ids['request'],
        ':email' => $accounts['member']['email'],
        ':parent_id' => $universityId,
    ]);

    $verificationRequestUpsert = $db->prepare("
        INSERT INTO user_verification_requests (
            request_id, user_id, community_id, verification_type,
            verification_method, notes, status, reviewed_by, reviewed_at,
            created_at, updated_at, selfie_path, id_front_path, supporting_doc_path
        ) VALUES (
            :request_id, :user_id, :community_id, 'student',
            'manual_review', :notes, 'pending', NULL, NULL,
            DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY), UTC_TIMESTAMP(), NULL, NULL, NULL
        )
        ON DUPLICATE KEY UPDATE
            community_id = VALUES(community_id), verification_type = 'student',
            verification_method = 'manual_review', notes = VALUES(notes),
            status = 'pending', reviewed_by = NULL, reviewed_at = NULL,
            updated_at = UTC_TIMESTAMP(), selfie_path = NULL,
            id_front_path = NULL, supporting_doc_path = NULL
    ");
    $verificationRequestUpsert->execute([
        ':request_id' => $ids['verification_request'],
        ':user_id' => $ids['prospect'],
        ':community_id' => $universityId,
        ':notes' => 'Fictional manual-review request for the partner demo. No identity documents are attached.',
    ]);

    $notificationUpsert = $db->prepare("
        INSERT INTO notifications (
            notification_id, recipient_user_id, actor_user_id,
            notification_type, reference_id, message, is_read, created_at
        ) VALUES (
            :notification_id, :recipient_id, :actor_id,
            :notification_type, :reference_id, :message, :is_read,
            DATE_SUB(UTC_TIMESTAMP(), INTERVAL :minutes MINUTE)
        )
        ON DUPLICATE KEY UPDATE
            recipient_user_id = VALUES(recipient_user_id), actor_user_id = VALUES(actor_user_id),
            notification_type = VALUES(notification_type), reference_id = VALUES(reference_id),
            message = VALUES(message), is_read = VALUES(is_read), created_at = VALUES(created_at)
    ");
    $notifications = [
        ['ndemo2026connection', $ids['member'], $ids['prospect'], 'connection', null, "Riley C. sent you a <a href='/user/{$ids['prospect']}'>connection request</a>.", 0, 35],
        ['ndemo2026reply', $ids['member'], $ids['ambassador'], 'reply', $fixtureIds['post_hjg_answer'], "Jordan E. replied with a verified answer in <a href='/info/forum/{$fixtureIds['forum_campus']}/thread/{$fixtureIds['thread_hjg']}'>Campus Life at UHart</a>.", 0, 18],
        ['ndemo2026event', $ids['member'], $ids['ambassador'], 'event', $fixtureIds['event_welcome'], "Reminder: <a href='/events-feed?event={$fixtureIds['event_welcome']}'>UHart Community Welcome & Campus Q+A</a> is coming up.", 1, 90],
    ];
    foreach ($notifications as [$notificationId, $recipientId, $actorId, $type, $referenceId, $message, $isRead, $minutes]) {
        $notificationUpsert->execute([
            ':notification_id' => $notificationId,
            ':recipient_id' => $recipientId,
            ':actor_id' => $actorId,
            ':notification_type' => $type,
            ':reference_id' => $referenceId,
            ':message' => $message,
            ':is_read' => $isRead,
            ':minutes' => $minutes,
        ]);
    }

    // Keep denormalized counts aligned with the relationships created above.
    $db->prepare("
        UPDATE users u
        SET follower_count = (SELECT COUNT(*) FROM user_follows f WHERE f.followed_user_id = u.user_id),
            following_count = (SELECT COUNT(*) FROM user_follows f WHERE f.follower_id = u.user_id)
        WHERE u.user_id IN (:member, :ambassador, :admin, :prospect)
    ")->execute([
        ':member' => $ids['member'],
        ':ambassador' => $ids['ambassador'],
        ':admin' => $ids['admin'],
        ':prospect' => $ids['prospect'],
    ]);

    $db->commit();

    echo json_encode([
        'success' => true,
        'community_id' => $universityId,
        'accounts' => array_map(
            static fn(array $account): array => [
                'user_id' => $account['user_id'],
                'email' => $account['email'],
                'role_id' => $account['role_id'],
            ],
            $accounts
        ),
        'accepted_connections' => 1,
        'pending_connections' => 2,
        'messages' => count($messages),
        'saved_items' => $savedCount,
        'rsvps' => $rsvpCount,
        'poll_id' => $ids['poll'],
        'pending_report' => $reportCreated,
        'pending_verification_request' => $ids['verification_request'],
    ], JSON_PRETTY_PRINT) . PHP_EOL;
} catch (Throwable $error) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    fwrite(STDERR, "Unable to seed partner demo accounts: {$error->getMessage()}\n");
    exit(1);
}
