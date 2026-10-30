<?php

declare(strict_types=1);

/**
 * Curated cross-navigation from the Funding hub to maintained Information Board
 * content. Titles resolve to existing threads; no article body is duplicated.
 *
 * @return array<int, array{key: string, title: string, description: string, articles: array<int, string>}>
 */
function srp_info_board_funding_collection(): array {
    return [
        [
            'key' => 'aid-basics',
            'title' => 'Financial aid essentials',
            'description' => 'Start with the FAFSA, college costs, aid offers, and how funds reach your account.',
            'articles' => [
                'FAFSA: Complete Beginner\'s Guide',
                'Understanding the Student Aid Index',
                'Understanding Your Financial Aid Award Letter',
                'Tuition, Fees, Room & Board Explained',
                'When Does Financial Aid Get Disbursed?',
                'What Is a Financial Aid Refund?',
                'How to Compare College Offers',
            ],
        ],
        [
            'key' => 'grants-scholarships',
            'title' => 'Grants and scholarships',
            'description' => 'Understand gift aid, find credible opportunities, and avoid common scams.',
            'articles' => [
                'Grants vs. Scholarships vs. Loans',
                'Scholarship Search Resources',
                'Common Financial Aid Scams to Avoid',
            ],
        ],
        [
            'key' => 'student-loans',
            'title' => 'Student loans',
            'description' => 'Compare federal loan types, borrowing costs, and repayment responsibilities.',
            'articles' => [
                'Federal Student Loans Explained',
                'Subsidized vs. Unsubsidized Loans',
                'Student Loan Repayment Basics',
            ],
        ],
        [
            'key' => 'work-employer-support',
            'title' => 'Work and employer support',
            'description' => 'Learn how work-study jobs and employer tuition programs contribute to a funding plan.',
            'articles' => [
                'How Federal Work-Study Works',
                'Federal Work-Study Jobs',
                'Employee Tuition Assistance Programs',
            ],
        ],
        [
            'key' => 'eligibility-enrollment',
            'title' => 'Eligibility and enrollment changes',
            'description' => 'Check how enrollment, transfer, legal status, and course changes can affect aid.',
            'articles' => [
                'Financial Aid Considerations',
                'Full-Time vs. Part-Time Status and Financial Aid',
                'What Happens to Financial Aid If You Drop a Class?',
                'Transfer Student Financial Aid',
                'How Legal Status Impacts Financial Aid for Students and Parents',
            ],
        ],
        [
            'key' => 'specialized-funding',
            'title' => 'Study abroad and graduate funding',
            'description' => 'Explore program-specific costs, graduate funding packages, and assistantships.',
            'articles' => [
                'Paying for Study Abroad',
                'Graduate School Funding Basics',
                'Assistantships Explained',
                'Financial Aid Questions Megathread',
            ],
        ],
    ];
}

/** @return array<int, string> */
function srp_info_board_funding_titles(): array {
    $titles = [];
    foreach (srp_info_board_funding_collection() as $group) {
        foreach ($group['articles'] as $title) {
            $titles[] = $title;
        }
    }
    return $titles;
}
