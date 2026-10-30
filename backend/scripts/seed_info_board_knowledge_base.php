<?php

declare(strict_types=1);

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/info_board_article_content.php';
require_once __DIR__ . '/../includes/sanitize.php';

/*
 * Replaces the legacy Information Board forums with a navigable hierarchy of
 * guide, section, article, and megathread nodes. Threads remain attached to one
 * invisible system forum only because the legacy schema requires forum_id.
 */

$db = getDB();
$communityId = 'c57b7fd6c45b9d57b';
$containerForumId = 'finfoknowledgebase01';
$publishedAt = '2026-08-15 00:00:00';
$authoredContentByTitle = srp_info_board_article_content();

function kb_node(string $title, array $children = [], ?string $body = null): array {
    return ['title' => $title, 'children' => $children, 'body' => $body];
}

function kb_section(string $title, array $children): array {
    return kb_node($title, $children);
}

$guides = [
    kb_node('START HERE — Student Guide', [
        kb_section('Understanding College', [
            kb_node('College Terminology Explained: Credits, Majors, Minors, Prerequisites & More', [
                kb_node('Public vs. Private Institutions'),
                kb_node('Community College vs. College vs. University'),
                kb_node('Undergraduate vs. Graduate Education'),
            ]),
            kb_node('What Is a Credit Hour?'),
            kb_node('Full-Time vs. Part-Time Student Status'),
            kb_node('Undergraduate vs. Graduate vs. Professional Programs'),
            kb_node("Associate's vs. Bachelor's vs. Master's Degrees"),
            kb_node('CLEP Exams Explained'),
            kb_node('Dual Enrollment Explained'),
        ]),
        kb_section('Applying & Enrolling', [
            kb_node('College Application Process: Start Here'),
            kb_node('Early Action vs. Early Decision vs. Regular Decision'),
            kb_node('What Colleges Look for in Applicants'),
            kb_node('Application Essays: General Advice'),
            kb_node('Letters of Recommendation Explained'),
            kb_node('SAT/ACT: When Are They Actually Needed?'),
            kb_node('Acceptance vs. Waitlist vs. Deferral'),
            kb_node('How to Compare College Offers'),
            kb_node('Choosing Between Colleges Megathread'),
        ]),
        kb_section("You've Been Accepted — Now What?", [
            kb_node("What to Do After You're Accepted"),
            kb_node('How College Enrollment Deposits Work'),
            kb_node('Placement Tests Explained'),
            kb_node('New Student Orientation: What to Expect'),
            kb_node('Registering for Your First Semester'),
            kb_node('What to Expect During Your First Week of College'),
            kb_node('First-Year Student Survival Guide'),
            kb_node('First-Year Student Questions Megathread'),
        ]),
    ], '<p>Start here if you are new to college, applying to college, or still learning how the process works. This guide combines the new-student, first-semester, and choosing-a-college paths in one place.</p>'),

    kb_node('Academic Success Guide', [
        kb_section('Classes & Coursework', [
            kb_node('What Is a Syllabus and How Should You Use It?', [
                kb_node('Using Office Hours'),
                kb_node('Adding Exams and Deadlines to Your Calendar in Advance'),
            ]),
            kb_node('Understanding Add/Drop, Withdrawal, and Incomplete Grades'),
            kb_node('What Happens If You Fail a Class?'),
        ]),
        kb_section('Academic Standing', [
            kb_node('What Does "Good Academic Standing" Mean?'),
            kb_node('How College Grading Systems Work'),
            kb_node('How to Calculate Your GPA'),
            kb_node('Academic Probation Explained'),
            kb_node('How to Read and Use Your Degree Audit/Evaluation'),
            kb_node("Dean's List & Honor Roll Explained"),
            kb_node('Benefits of Academic Honors', [
                kb_node('Scholarships and Grants'),
                kb_node('Graduate School Opportunities'),
                kb_node('Career Opportunities'),
                kb_node('Academic Recognition'),
            ]),
        ]),
        kb_section('Study & Organization Skills', [
            kb_node('Using Office Hours Effectively'),
            kb_node('Planning Your Semester Before Classes Begin'),
            kb_node('Note-Taking Strategies'),
            kb_node('Academic Organization & Time Management'),
        ]),
        kb_section('Academic Integrity', [
            kb_node('Academic Integrity & Plagiarism Explained'),
            kb_node('Using AI Responsibly for Schoolwork'),
            kb_node('AI and Academic Integrity'),
        ]),
    ], '<p>Use this guide to stay on track academically, understand your standing, organize coursework, and make responsible choices in class.</p>'),

    kb_node('Financial Aid Guide', [
        kb_section('Financial Aid Basics', [
            kb_node("FAFSA: Complete Beginner's Guide"),
            kb_node('Grants vs. Scholarships vs. Loans'),
            kb_node('Understanding the Student Aid Index'),
            kb_node('Understanding Your Financial Aid Award Letter'),
            kb_node('Tuition, Fees, Room & Board Explained'),
        ]),
        kb_section('Student Loans', [
            kb_node('Federal Student Loans Explained'),
            kb_node('Subsidized vs. Unsubsidized Loans'),
            kb_node('Student Loan Repayment Basics'),
        ]),
        kb_section('Receiving Financial Aid', [
            kb_node('When Does Financial Aid Get Disbursed?'),
            kb_node('What Is a Financial Aid Refund?'),
            kb_node('What Happens to Financial Aid If You Drop a Class?'),
        ]),
        kb_section('Work & Financial Aid', [
            kb_node('How Federal Work-Study Works'),
            kb_node('Federal Work-Study Jobs'),
            kb_node('Employee Tuition Assistance Programs'),
        ]),
        kb_section('Scholarships', [
            kb_node('Scholarship Search Resources'),
            kb_node('Common Financial Aid Scams to Avoid'),
        ]),
        kb_section('Eligibility & Special Situations', [
            kb_node('Full-Time vs. Part-Time Status and Financial Aid'),
            kb_node('Transfer Student Financial Aid'),
            kb_node('How Legal Status Impacts Financial Aid for Students and Parents'),
            kb_node('Paying for Study Abroad'),
        ]),
        kb_section('Help', [
            kb_node('Financial Aid Questions Megathread'),
        ]),
    ], '<p>Start here to understand college costs, financial aid, student loans, work-study, scholarships, eligibility, and special funding situations.</p>'),

    kb_node('Planning Ahead Guide', [
        kb_section('Planning Your Degree', [
            kb_node('How Many Credits Should You Take?', [
                kb_node('Graduating on Time'),
                kb_node('Working While Attending School'),
                kb_node('Graduate School Plans'),
                kb_node('Financial Aid Considerations'),
            ]),
            kb_node('How to Choose a Major'),
            kb_node('Changing Your Major: What to Consider'),
            kb_node('Major vs. Minor vs. Concentration'),
            kb_node('Do You Need a Minor?'),
            kb_node('Choosing Between Two Majors'),
            kb_node('Should You Double Major?'),
            kb_node('When Is It Too Late to Change Your Major?'),
            kb_node('Declaring a Major'),
            kb_node('Undeclared Students: Where to Start'),
            kb_node('What Can I Do With My Major?'),
            kb_node('Should I Choose This Major? Megathread'),
            kb_node('What Can I Do With This Major? Megathread'),
        ]),
        kb_section('Special Degree Pathways', [
            kb_node('3+1 Programs Explained'),
            kb_node('Minors'),
            kb_node('Dual Majors / Double Majors'),
            kb_node('Undergraduate vs. Graduate vs. Professional Programs'),
        ]),
        kb_section('Transferring', [
            kb_node('Complete Guide to Transferring Colleges'),
            kb_node('How Transfer Credits Work'),
            kb_node('Will My Credits Transfer?'),
            kb_node('Community College → University Transfer Guide'),
            kb_node('When Is the Best Time to Transfer?'),
            kb_node('How to Read a Transfer Credit Evaluation'),
            kb_node('What Is an Articulation Agreement?'),
            kb_node('Transferring With a Low GPA'),
            kb_node('Starting Over at a New School'),
            kb_node('Transfer Questions Megathread'),
        ]),
        kb_section('Internships & Career Preparation', [
            kb_node('When Should You Start Looking for Internships?'),
            kb_node('Getting Your First Internship With No Experience'),
            kb_node("How to Build a Resume While You're Still in School"),
            kb_node('Career Fairs: What to Expect'),
            kb_node('Networking for College Students'),
            kb_node('LinkedIn for College Students'),
            kb_node('How to Ask a Professor for a Recommendation'),
            kb_node('Internship vs. Part-Time Job'),
            kb_node('Paid vs. Unpaid Internships'),
            kb_node('How to Find Research Opportunities'),
            kb_node('Preparing for Your First Professional Interview'),
            kb_node('Finding Your First Job After Graduation'),
        ]),
        kb_section('Working While in School', [
            kb_node('Balancing a Job and College'),
            kb_node('How Many Hours Should You Work While in School?'),
            kb_node('On-Campus Jobs Explained'),
            kb_node('Internships vs. Part-Time Jobs'),
            kb_node('How to Ask Your Employer for a School-Friendly Schedule'),
            kb_node('Building Work Experience Before Graduation'),
            kb_node('Working Full-Time While Attending School'),
            kb_node('Working Students Megathread'),
        ]),
        kb_section('Study Abroad', [
            kb_node('Study Abroad: Where to Start'),
            kb_node('Choosing a Study Abroad Program'),
            kb_node('How Study Abroad Credits Work'),
            kb_node('Paying for Study Abroad'),
            kb_node('Passports & Visas for Study Abroad'),
            kb_node('Study Abroad Questions Megathread'),
        ]),
        kb_section('Graduate School & Life After College', [
            kb_node('Is Graduate School Worth It?'),
            kb_node("Master's vs. Doctoral Programs"),
            kb_node('Choosing a Graduate Program'),
            kb_node('Applying to Graduate School'),
            kb_node('Graduate School Funding Basics'),
            kb_node('Assistantships Explained'),
            kb_node('Asking for Graduate School Recommendations'),
            kb_node('Taking a Gap Year Before Graduate School'),
            kb_node('Returning to School as an Adult'),
            kb_node('Graduate School Questions Megathread'),
        ]),
        kb_section('Graduation', [
            kb_node('Graduation Checklist', [
                kb_node('Checking Your Degree Audit Before Graduation'),
                kb_node('Preparing for Employment After Graduation'),
                kb_node('Preparing for Graduate School'),
                kb_node('Student Loan Repayment Preparation'),
            ]),
        ]),
    ], '<p>Use this guide to make decisions now that support your degree, transfer, work, study-abroad, graduation, career, and graduate-school goals.</p>'),

    kb_node('Extracurriculars', [
        kb_section('Getting Involved', [
            kb_node('Joining Clubs & Student Organizations'),
            kb_node('Getting Involved on Campus'),
            kb_node('What Is Student Government?'),
            kb_node('Greek Life Explained'),
        ]),
        kb_section('Social Life', [
            kb_node('Making Friends in College'),
            kb_node('Balancing School, Work & a Social Life'),
        ]),
        kb_section('Different College Experiences', [
            kb_node('Commuter Student Survival Guide'),
        ]),
    ], '<p>Explore ways to get involved, build community, and have a life outside class while keeping school, work, and social commitments in balance.</p>'),

    kb_node('Resources', [
        kb_section('Housing', [
            kb_node('On-Campus vs. Off-Campus Housing'),
            kb_node('Living on Campus vs. Commuting'),
            kb_node('Dorm Life: What to Expect'),
            kb_node('Finding Your First College Apartment'),
            kb_node('Understanding a Lease as a Student'),
            kb_node('Security Deposits Explained'),
            kb_node('Avoiding Student Housing Scams'),
            kb_node('Living With Roommates'),
            kb_node('Roommate Agreements: What to Include'),
            kb_node('Housing & Roommate Questions Megathread'),
        ]),
        kb_section('Food & Transportation', [
            kb_node('How College Meal Plans Work'),
            kb_node('Eating on a Student Budget'),
            kb_node('Commuting to College'),
            kb_node('Do You Need a Car in College?'),
        ]),
        kb_section('Technology', [
            kb_node('Essential Technology for College Students'),
            kb_node('Choosing a Laptop for School'),
            kb_node('Microsoft 365 for Students'),
            kb_node('Google Workspace for Students'),
            kb_node('How Learning Management Systems Work'),
            kb_node('Canvas, Blackboard, Brightspace & Moodle Basics'),
            kb_node('Keeping Your Student Accounts Secure'),
            kb_node('Avoiding Phishing Emails Targeting Students'),
            kb_node('Backing Up Your Schoolwork'),
            kb_node('Online Class Survival Guide'),
            kb_node('Free & Discounted Software for Students'),
            kb_node('Using AI Tools Responsibly'),
            kb_node('Note-Taking Apps', [
                kb_node('OneNote'),
                kb_node('Notion'),
                kb_node('Goodnotes'),
                kb_node('Other Note-Taking Apps'),
            ]),
            kb_node('Time Management & Calendar Apps', [
                kb_node('TimeTree'),
                kb_node('Other Time Management & Calendar Apps'),
            ]),
        ]),
        kb_section('Student Rights & School Policies', [
            kb_node('Know Your Rights as a Student'),
            kb_node('FERPA Explained'),
            kb_node('Title IX Basics'),
            kb_node('Academic Appeals: How They Work'),
            kb_node('Grade Appeals Explained'),
            kb_node('Academic Misconduct Hearings'),
            kb_node('Student Conduct Processes'),
            kb_node('Disability Accommodations: How They Work'),
            kb_node('Requesting Academic Accommodations'),
            kb_node('Medical Leave / Leave of Absence Explained'),
            kb_node('Withdrawing From College'),
            kb_node('How to File a Complaint With Your School'),
            kb_node("Understanding Your School's Student Handbook"),
            kb_node("Where to Go When You Don't Know Who Can Help"),
        ]),
        kb_section('International Student Resources', [
            kb_node('Studying in the U.S. as an International Student'),
            kb_node('F-1 Student Basics'),
            kb_node('Working in the U.S. as an International Student'),
            kb_node('CPT vs. OPT'),
            kb_node('Passports & Visa Information'),
            kb_node('International Student Questions Megathread'),
        ]),
        kb_section('Resources for Different Student Populations', [
            kb_node('Tips for First-Generation College Students'),
            kb_node('Tips for Nontraditional Students'),
            kb_node('Health Insurance for College Students'),
        ]),
        kb_section('Practical Financial/Employment Resources', [
            kb_node('Taxes for College Students: The Basics'),
            kb_node('Employee Tuition Assistance Programs'),
        ]),
    ], '<p>Find practical help, services, policies, and tools for housing, transportation, technology, student rights, international students, and different student populations.</p>'),
];

function kb_placeholders(array $values): string {
    return implode(',', array_fill(0, count($values), '?'));
}

function kb_entry_kind(array $node, int $depth): string {
    if ($depth === 0) return 'guide';
    if (!empty($node['children'])) return 'section';
    return stripos($node['title'], 'Megathread') !== false ? 'megathread' : 'article';
}

function kb_default_body(string $title, string $kind, string $guideTitle): string {
    $safeTitle = htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeGuide = htmlspecialchars($guideTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    if ($kind === 'section') {
        return "<p>Browse the {$safeTitle} topics in the {$safeGuide}. Choose an article below for focused guidance.</p>";
    }
    if ($kind === 'megathread') {
        return "<p>Use this megathread for questions and shared experience about <strong>{$safeTitle}</strong>. Remove personal, financial, school-account, immigration, and travel-document details before posting. Confirm school-specific decisions with the office that has authority.</p>";
    }
    return "<p>This article introduces <strong>{$safeTitle}</strong> and the questions, deadlines, documents, and campus offices students may need to consider. Policies vary by institution, program, and location, so use this guide as a starting point and confirm the final answer with the appropriate school office.</p>";
}

$communityStmt = $db->prepare("SELECT 1 FROM communities WHERE id = :id LIMIT 1");
$communityStmt->execute([':id' => $communityId]);
if (!$communityStmt->fetchColumn()) {
    fwrite(STDERR, "Information Board community was not found; no data was written.\n");
    exit(1);
}

$requiredColumns = [
    ['threads', 'parent_thread_id'],
    ['threads', 'sort_order'],
    ['forums', 'is_system_container'],
];
foreach ($requiredColumns as [$table, $column]) {
    $columnStmt = $db->query("SHOW COLUMNS FROM `{$table}` LIKE " . $db->quote($column));
    if (!$columnStmt->fetch()) {
        fwrite(STDERR, "Run backend/scripts/run_migrations.php before this seed.\n");
        exit(1);
    }
}

$preferredAuthorEmail = getenv('SRP_KB_AUTHOR_EMAIL') ?: 'n.sandore5140@gmail.com';
$authorStmt = $db->prepare("SELECT user_id FROM users WHERE email = :email LIMIT 1");
$authorStmt->execute([':email' => $preferredAuthorEmail]);
$authorId = normalizeId($authorStmt->fetchColumn());
if ($authorId === '') {
    $authorId = normalizeId($db->query(
        "SELECT user_id FROM users ORDER BY CASE WHEN role_id = 5 THEN 0 ELSE 1 END, created_at ASC LIMIT 1"
    )->fetchColumn());
}
if ($authorId === '') {
    fwrite(STDERR, "An existing user is required to author the knowledge base.\n");
    exit(1);
}

// Preserve complete content from any matching legacy article before cleanup.
$legacyContentByTitle = [];
$legacyStmt = $db->prepare("
    SELECT t.title, p.content
    FROM threads t
    JOIN forums f ON f.forum_id = t.forum_id
    JOIN posts p ON p.thread_id = t.thread_id AND p.reply_to IS NULL
    WHERE f.community_id = :community_id
       OR f.community_id IN (SELECT id FROM communities WHERE parent_community_id = :community_id)
    ORDER BY p.created_at ASC
");
$legacyStmt->execute([':community_id' => $communityId]);
foreach ($legacyStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $legacyContentByTitle[(string)$row['title']] ??= (string)$row['content'];
}
$contentAliases = [
    'Passports & Visa Information' => 'Passports & Visas for Students',
    'Passports & Visas for Study Abroad' => 'Passports & Visas for Students',
];

$db->beginTransaction();

try {
    // Resolve every legacy forum attached to Information Board or its direct
    // child groups, while preserving this script's canonical container on rerun.
    $forumStmt = $db->prepare("
        SELECT f.forum_id
        FROM forums f
        WHERE (f.community_id = :community_id
            OR f.community_id IN (SELECT id FROM communities WHERE parent_community_id = :community_id))
          AND f.forum_id <> :container_id
    ");
    $forumStmt->execute([
        ':community_id' => $communityId,
        ':container_id' => $containerForumId,
    ]);
    $legacyForumIds = array_values(array_filter(array_map('strval', $forumStmt->fetchAll(PDO::FETCH_COLUMN))));
    $legacyThreadIds = [];
    $legacyPostIds = [];

    if ($legacyForumIds) {
        $threadStmt = $db->prepare(
            'SELECT thread_id FROM threads WHERE forum_id IN (' . kb_placeholders($legacyForumIds) . ')'
        );
        $threadStmt->execute($legacyForumIds);
        $legacyThreadIds = array_values(array_filter(array_map('strval', $threadStmt->fetchAll(PDO::FETCH_COLUMN))));
    }
    if ($legacyThreadIds) {
        $postStmt = $db->prepare(
            'SELECT post_id FROM posts WHERE thread_id IN (' . kb_placeholders($legacyThreadIds) . ')'
        );
        $postStmt->execute($legacyThreadIds);
        $legacyPostIds = array_values(array_filter(array_map('strval', $postStmt->fetchAll(PDO::FETCH_COLUMN))));
    }

    $allLegacyIds = array_values(array_unique(array_merge($legacyForumIds, $legacyThreadIds, $legacyPostIds)));
    if ($allLegacyIds) {
        $deleteReports = $db->prepare(
            'DELETE FROM reports WHERE item_id IN (' . kb_placeholders($allLegacyIds) . ')'
            . ' OR forum_id IN (' . kb_placeholders($legacyForumIds ?: ['']) . ')'
            . ' OR thread_id IN (' . kb_placeholders($legacyThreadIds ?: ['']) . ')'
        );
        $deleteReports->execute(array_merge(
            $allLegacyIds,
            $legacyForumIds ?: [''],
            $legacyThreadIds ?: ['']
        ));
        $deletePins = $db->prepare('DELETE FROM pinned_items WHERE item_id IN (' . kb_placeholders($allLegacyIds) . ')');
        $deletePins->execute($allLegacyIds);
        $deleteTranslations = $db->prepare(
            'DELETE FROM info_board_translations WHERE entity_id IN (' . kb_placeholders($allLegacyIds) . ')'
        );
        $deleteTranslations->execute($allLegacyIds);
        $deleteNotifications = $db->prepare(
            'DELETE FROM notifications WHERE reference_id IN (' . kb_placeholders($allLegacyIds) . ')'
        );
        $deleteNotifications->execute($allLegacyIds);
    }

    if ($legacyPostIds) {
        foreach (['post_votes' => 'post_id', 'saved_posts' => 'post_id'] as $table => $column) {
            $stmt = $db->prepare(
                "DELETE FROM `{$table}` WHERE `{$column}` IN (" . kb_placeholders($legacyPostIds) . ')'
            );
            $stmt->execute($legacyPostIds);
        }
        // Delete leaf replies first to satisfy the self-referencing post FK.
        do {
            $stmt = $db->prepare(
                'DELETE p FROM posts p LEFT JOIN posts child ON child.reply_to = p.post_id '
                . 'WHERE p.post_id IN (' . kb_placeholders($legacyPostIds) . ') AND child.post_id IS NULL'
            );
            $stmt->execute($legacyPostIds);
            $deletedPosts = $stmt->rowCount();
        } while ($deletedPosts > 0);
    }

    if ($legacyThreadIds) {
        foreach (['thread_votes' => 'thread_id', 'saved_threads' => 'thread_id', 'thread_tags' => 'thread_id'] as $table => $column) {
            $stmt = $db->prepare(
                "DELETE FROM `{$table}` WHERE `{$column}` IN (" . kb_placeholders($legacyThreadIds) . ')'
            );
            $stmt->execute($legacyThreadIds);
        }
        $stmt = $db->prepare('DELETE FROM threads WHERE thread_id IN (' . kb_placeholders($legacyThreadIds) . ')');
        $stmt->execute($legacyThreadIds);
    }

    if ($legacyForumIds) {
        foreach (['forum_votes' => 'forum_id', 'saved_forums' => 'forum_id', 'forum_tags' => 'forum_id'] as $table => $column) {
            $stmt = $db->prepare(
                "DELETE FROM `{$table}` WHERE `{$column}` IN (" . kb_placeholders($legacyForumIds) . ')'
            );
            $stmt->execute($legacyForumIds);
        }
        $stmt = $db->prepare('DELETE FROM forums WHERE forum_id IN (' . kb_placeholders($legacyForumIds) . ')');
        $stmt->execute($legacyForumIds);
    }

    $forumUpsert = $db->prepare("
        INSERT INTO forums (
            forum_id, community_id, name, description, created_at, created_by,
            last_activity_at, is_locked, is_pinned, is_hidden,
            is_system_container, image_layout
        ) VALUES (
            :forum_id, :community_id, 'Information Board Knowledge Base',
            'Internal storage container for the Information Board thread hierarchy.',
            :published_at, :author_id, :published_at, 0, 0, 1, 1, 'banner'
        )
        ON DUPLICATE KEY UPDATE
            community_id = VALUES(community_id),
            name = VALUES(name),
            description = VALUES(description),
            created_by = VALUES(created_by),
            created_at = VALUES(created_at),
            last_activity_at = VALUES(last_activity_at),
            is_hidden = 1,
            is_system_container = 1
    ");
    $forumUpsert->execute([
        ':forum_id' => $containerForumId,
        ':community_id' => $communityId,
        ':published_at' => $publishedAt,
        ':author_id' => $authorId,
    ]);

    $threadUpsert = $db->prepare("
        INSERT INTO threads (
            thread_id, forum_id, parent_thread_id, user_id, title, content_kind,
            sort_order, created_at, updated_at, last_activity_at, reply_count,
            is_locked, status, is_hidden
        ) VALUES (
            :thread_id, :forum_id, :parent_thread_id, :user_id, :title, :content_kind,
            :sort_order, :published_at, :published_at, :published_at, 0,
            :is_locked, 'open', 0
        )
        ON DUPLICATE KEY UPDATE
            forum_id = VALUES(forum_id),
            parent_thread_id = VALUES(parent_thread_id),
            user_id = VALUES(user_id),
            title = VALUES(title),
            content_kind = VALUES(content_kind),
            sort_order = VALUES(sort_order),
            created_at = VALUES(created_at),
            updated_at = VALUES(updated_at),
            last_activity_at = VALUES(last_activity_at),
            is_locked = VALUES(is_locked),
            status = 'open',
            is_hidden = 0
    ");
    $postUpsert = $db->prepare("
        INSERT INTO posts (
            post_id, thread_id, user_id, content, created_at, updated_at,
            reply_to, verified, verified_by, verified_at, is_hidden
        ) VALUES (
            :post_id, :thread_id, :user_id, :content, :published_at, :published_at,
            NULL, 0, NULL, NULL, 0
        )
        ON DUPLICATE KEY UPDATE
            thread_id = VALUES(thread_id),
            user_id = VALUES(user_id),
            content = VALUES(content),
            created_at = VALUES(created_at),
            updated_at = VALUES(updated_at),
            verified = 0,
            verified_by = NULL,
            verified_at = NULL,
            is_hidden = 0
    ");

    $nodeCount = 0;
    $seedNodes = function (
        array $nodes,
        ?string $parentThreadId,
        int $depth,
        string $path,
        string $guideTitle
    ) use (
        &$seedNodes,
        &$nodeCount,
        $threadUpsert,
        $postUpsert,
        $containerForumId,
        $authorId,
        $publishedAt,
        $authoredContentByTitle,
        $legacyContentByTitle,
        $contentAliases
    ): void {
        foreach ($nodes as $sortOrder => $node) {
            $nodePath = $path . '/' . $sortOrder . ':' . $node['title'];
            $threadId = 'tkb' . substr(hash('sha256', $nodePath), 0, 16);
            $postId = 'pkb' . substr(hash('sha256', $nodePath), 0, 16);
            $kind = kb_entry_kind($node, $depth);
            $nodeGuideTitle = $depth === 0 ? $node['title'] : $guideTitle;
            $articleTime = (new DateTimeImmutable($publishedAt, new DateTimeZone('UTC')))
                ->modify('+' . $nodeCount . ' minutes')
                ->format('Y-m-d H:i:s');
            $threadUpsert->execute([
                ':thread_id' => $threadId,
                ':forum_id' => $containerForumId,
                ':parent_thread_id' => $parentThreadId,
                ':user_id' => $authorId,
                ':title' => $node['title'],
                ':content_kind' => $kind,
                ':sort_order' => $sortOrder,
                ':published_at' => $articleTime,
                ':is_locked' => $kind === 'megathread' ? 0 : 1,
            ]);

            $legacyTitle = $contentAliases[$node['title']] ?? $node['title'];
            $content = $node['body']
                ?? $authoredContentByTitle[$node['title']]
                ?? $legacyContentByTitle[$legacyTitle]
                ?? kb_default_body($node['title'], $kind, $nodeGuideTitle);
            if (isset($authoredContentByTitle[$node['title']])) {
                $content = srp_sanitize_html($content);
            }
            $postUpsert->execute([
                ':post_id' => $postId,
                ':thread_id' => $threadId,
                ':user_id' => $authorId,
                ':content' => $content,
                ':published_at' => $articleTime,
            ]);
            $nodeCount++;

            if (!empty($node['children'])) {
                $seedNodes(
                    $node['children'],
                    $threadId,
                    $depth + 1,
                    $nodePath,
                    $nodeGuideTitle
                );
            }
        }
    };
    $seedNodes($guides, null, 0, 'info-board', 'Information Board');

    $db->commit();
    fwrite(STDOUT, sprintf(
        "Seeded %d Information Board knowledge-base nodes; removed %d legacy forums, %d threads, and %d posts.\n",
        $nodeCount,
        count($legacyForumIds),
        count($legacyThreadIds),
        count($legacyPostIds)
    ));
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    fwrite(STDERR, 'Information Board seed failed: ' . $e->getMessage() . "\n");
    exit(1);
}
