<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/info_board_article_content.php';

$failures = 0;

function article_content_check(string $label, bool $condition): void {
    global $failures;
    if ($condition) {
        echo "  ok  - {$label}\n";
        return;
    }
    echo "FAIL  - {$label}\n";
    $failures++;
}

$expectedTitles = [
    'College Terminology Explained: Credits, Majors, Minors, Prerequisites & More',
    '3+1 Programs Explained',
    'Minors',
    'Dual Majors / Double Majors',
    "Associate's vs. Bachelor's vs. Master's Degrees",
    'What Is a Syllabus and How Should You Use It?',
    'Using Office Hours',
    'Adding Exams and Deadlines to Your Calendar in Advance',
    'OneNote',
    'Notion',
    'Goodnotes',
    'Other Note-Taking Apps',
    'TimeTree',
    'Other Time Management & Calendar Apps',
    'Public vs. Private Institutions',
    'Undergraduate vs. Graduate Education',
    'Community College vs. College vs. University',
    'What Is a Credit Hour?',
    'Financial Aid Considerations',
    'CLEP Exams Explained',
    'Dual Enrollment Explained',
    'Full-Time vs. Part-Time Student Status',
    'Full-Time vs. Part-Time Status and Financial Aid',
    'Health Insurance for College Students',
    'Undergraduate vs. Graduate vs. Professional Programs',
    'FAFSA: Complete Beginner\'s Guide',
    'Grants vs. Scholarships vs. Loans',
    'Federal Student Loans Explained',
    'Subsidized vs. Unsubsidized Loans',
    'Understanding Your Financial Aid Award Letter',
    'Understanding the Student Aid Index',
    'When Does Financial Aid Get Disbursed?',
    'What Is a Financial Aid Refund?',
    'How Federal Work-Study Works',
    'Tuition, Fees, Room & Board Explained',
    'What Happens to Financial Aid If You Drop a Class?',
    'Student Loan Repayment Basics',
    'Scholarship Search Resources',
    'Common Financial Aid Scams to Avoid',
    'Financial Aid Questions Megathread',
    'How Legal Status Impacts Financial Aid for Students and Parents',
    'College Application Process: Start Here',
    'Early Action vs. Early Decision vs. Regular Decision',
    'What Colleges Look for in Applicants',
    'Application Essays: General Advice',
    'Letters of Recommendation Explained',
    'SAT/ACT: When Are They Actually Needed?',
    'Acceptance vs. Waitlist vs. Deferral',
    "What to Do After You're Accepted",
    'How College Enrollment Deposits Work',
    'Placement Tests Explained',
    'New Student Orientation: What to Expect',
    'Registering for Your First Semester',
    'How to Compare College Offers',
    'Choosing Between Colleges Megathread',
    'Complete Guide to Transferring Colleges',
    'How Transfer Credits Work',
    'Will My Credits Transfer?',
    'Community College → University Transfer Guide',
    'When Is the Best Time to Transfer?',
    'Transfer Student Financial Aid',
    'How to Read a Transfer Credit Evaluation',
    'What Is an Articulation Agreement?',
    'Transferring With a Low GPA',
    'Starting Over at a New School',
    'Transfer Questions Megathread',
    'How to Choose a Major',
    'Changing Your Major: What to Consider',
    'Major vs. Minor vs. Concentration',
    'Do You Need a Minor?',
    'What Can I Do With My Major?',
    'Choosing Between Two Majors',
    'Should You Double Major?',
    'When Is It Too Late to Change Your Major?',
    'Declaring a Major',
    'Undeclared Students: Where to Start',
    'Should I Choose This Major? Megathread',
    'What Can I Do With This Major? Megathread',
    'When Should You Start Looking for Internships?',
    'Getting Your First Internship With No Experience',
    "How to Build a Resume While You're Still in School",
    'Career Fairs: What to Expect',
    'Networking for College Students',
    'LinkedIn for College Students',
    'How to Ask a Professor for a Recommendation',
    'Finding Your First Job After Graduation',
    'Internship vs. Part-Time Job',
    'Paid vs. Unpaid Internships',
    'How to Find Research Opportunities',
    'Preparing for Your First Professional Interview',
    'Studying in the U.S. as an International Student',
    'F-1 Student Basics',
    'Working in the U.S. as an International Student',
    'CPT vs. OPT',
    'International Student Questions Megathread',
    'Study Abroad: Where to Start',
    'How Study Abroad Credits Work',
    'Paying for Study Abroad',
    'Passports & Visa Information',
    'Passports & Visas for Study Abroad',
    'Choosing a Study Abroad Program',
    'Study Abroad Questions Megathread',
    'Is Graduate School Worth It?',
    "Master's vs. Doctoral Programs",
    'Choosing a Graduate Program',
    'Applying to Graduate School',
    'Graduate School Funding Basics',
    'Assistantships Explained',
    'Asking for Graduate School Recommendations',
    'Taking a Gap Year Before Graduate School',
    'Returning to School as an Adult',
    'Graduate School Questions Megathread',
    'Balancing a Job and College',
    'How Many Hours Should You Work While in School?',
    'On-Campus Jobs Explained',
    'Federal Work-Study Jobs',
    'Internships vs. Part-Time Jobs',
    'How to Ask Your Employer for a School-Friendly Schedule',
    'Building Work Experience Before Graduation',
    'Taxes for College Students: The Basics',
    'Employee Tuition Assistance Programs',
    'Working Full-Time While Attending School',
    'Working Students Megathread',
    'Essential Technology for College Students',
    'Choosing a Laptop for School',
    'Microsoft 365 for Students',
    'Google Workspace for Students',
    'How Learning Management Systems Work',
    'Canvas, Blackboard, Brightspace & Moodle Basics',
    'Keeping Your Student Accounts Secure',
    'Avoiding Phishing Emails Targeting Students',
    'Backing Up Your Schoolwork',
    'Online Class Survival Guide',
    'Free & Discounted Software for Students',
    'Using AI Tools Responsibly',
    'AI and Academic Integrity',
    'Know Your Rights as a Student',
    'FERPA Explained',
    'Title IX Basics',
    'Academic Appeals: How They Work',
    'Grade Appeals Explained',
    'Academic Misconduct Hearings',
    'Student Conduct Processes',
    'Disability Accommodations: How They Work',
    'Requesting Academic Accommodations',
    'Medical Leave / Leave of Absence Explained',
    'Withdrawing From College',
    'How to File a Complaint With Your School',
    "Understanding Your School's Student Handbook",
    "Where to Go When You Don't Know Who Can Help",
    'On-Campus vs. Off-Campus Housing',
    'Finding Your First College Apartment',
    'Understanding a Lease as a Student',
    'Security Deposits Explained',
    'Avoiding Student Housing Scams',
    'Roommate Agreements: What to Include',
    'How College Meal Plans Work',
    'Eating on a Student Budget',
    'Commuting to College',
    'Do You Need a Car in College?',
    'What to Expect During Your First Week of College',
    'First-Year Student Survival Guide',
    'Making Friends in College',
    'Joining Clubs & Student Organizations',
    'Commuter Student Survival Guide',
    'Living on Campus vs. Commuting',
    'Dorm Life: What to Expect',
    'Living With Roommates',
    'Getting Involved on Campus',
    'What Is Student Government?',
    'Greek Life Explained',
    'Balancing School, Work & a Social Life',
    'Tips for First-Generation College Students',
    'Tips for Nontraditional Students',
    'First-Year Student Questions Megathread',
];
$newTitles = array_slice($expectedTitles, 1, 13);
$financialAidTitles = array_slice($expectedTitles, 25, 16);
$admissionsTitles = array_slice($expectedTitles, 41, 14);
$transferTitles = array_slice($expectedTitles, 55, 11);
$majorTitles = array_slice($expectedTitles, 66, 12);
$careerTitles = array_slice($expectedTitles, 78, 12);
$internationalTitles = array_slice($expectedTitles, 90, 5);
$studyAbroadTitles = array_slice($expectedTitles, 95, 7);
$graduateTitles = array_slice($expectedTitles, 102, 10);
$workTitles = array_slice($expectedTitles, 112, 11);
$technologyTitles = array_slice($expectedTitles, 123, 13);
$studentRightsTitles = array_slice($expectedTitles, 136, 14);
$housingTitles = array_slice($expectedTitles, 150, 10);
$firstYearTitles = array_slice($expectedTitles, 160, 15);
$articles = srp_info_board_article_content();

article_content_check('contains exactly the one hundred seventy-five requested article titles', array_keys($articles) === $expectedTitles);

foreach ($expectedTitles as $title) {
    $html = $articles[$title] ?? '';
    $plainText = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5)) ?? '');
    $minimumWords = in_array($title, array_merge($majorTitles, $careerTitles, $internationalTitles, $studyAbroadTitles, $graduateTitles, $workTitles, $technologyTitles, $studentRightsTitles, $housingTitles, $firstYearTitles), true)
        ? 300
        : (in_array($title, $transferTitles, true)
        ? 400
        : (in_array($title, $admissionsTitles, true)
        ? 400
        : (in_array($title, $financialAidTitles, true)
        ? 400
        : (in_array($title, $newTitles, true) ? 650 : 700))));
    article_content_check("{$title}: is in depth", str_word_count($plainText) >= $minimumWords);
    article_content_check("{$title}: has structured sections", substr_count($html, '<h2>') >= 5);
    article_content_check("{$title}: links to neutral sources", substr_count($html, 'href="https://') >= 3);
    $reviewDate = in_array($title, array_merge($newTitles, $financialAidTitles, $admissionsTitles, $transferTitles, $majorTitles, $careerTitles, $internationalTitles, $studyAbroadTitles, $graduateTitles, $workTitles, $technologyTitles, $studentRightsTitles, $housingTitles, $firstYearTitles), true)
        ? 'August 16, 2026'
        : 'August 15, 2026';
    article_content_check("{$title}: includes review date", str_contains($html, "Last reviewed: {$reviewDate}"));
    article_content_check("{$title}: contains no scripts", !preg_match('/<(script|iframe|object|embed)\b/i', $html));
}

echo "\n";
if ($failures > 0) {
    echo "{$failures} test(s) FAILED\n";
    exit(1);
}

echo "All Information Board article-content assertions passed.\n";
