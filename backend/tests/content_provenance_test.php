<?php

require_once __DIR__ . '/../includes/content_provenance.php';

$failures = 0;

function expect_same($expected, $actual, string $label): void
{
    global $failures;
    if ($expected !== $actual) {
        $failures++;
        fwrite(STDERR, "FAIL - {$label}: expected " . var_export($expected, true) . ', got ' . var_export($actual, true) . "\n");
        return;
    }
    fwrite(STDOUT, "  ok  - {$label}\n");
}

expect_same('student_experience', srp_derive_perspective_type(['education_status' => 'Student']), 'student perspective is derived');
expect_same('alumni_experience', srp_derive_perspective_type(['education_status' => 'Alumni']), 'alumni perspective is derived');
expect_same('professional_guidance', srp_derive_perspective_type(['education_status' => 'Staff']), 'staff perspective is professional, not official');
expect_same('community_suggestion', srp_derive_perspective_type([]), 'unknown audience stays a community suggestion');
expect_same('official_institutional', srp_derive_perspective_type([
    'education_status' => 'Student',
    'perspective_type' => 'official_institutional',
]), 'explicit reviewed perspective wins');
expect_same(null, srp_normalize_perspective_type('not-a-real-type'), 'unknown perspective is rejected');

$reviewed = srp_attach_trust_context([[
    'education_status' => 'Staff',
    'reviewed_at' => '2026-11-02 12:00:00',
    'review_due_at' => '2099-01-01 00:00:00',
    'applicable_community_name' => 'Information Board',
]])[0];
expect_same('reviewed', $reviewed['review_status'], 'reviewed content is marked reviewed');
expect_same('StudentSphere Guides & Answers', $reviewed['applicable_community_name'], 'internal information-board label is not exposed');

$stale = srp_attach_trust_context([[
    'perspective_type' => 'student_experience',
    'reviewed_at' => '2020-01-01 00:00:00',
    'review_due_at' => '2020-06-01 00:00:00',
]])[0];
expect_same('stale', $stale['review_status'], 'expired review is marked stale');

if ($failures > 0) {
    fwrite(STDERR, "\n{$failures} provenance test(s) failed.\n");
    exit(1);
}

fwrite(STDOUT, "\nAll provenance tests passed.\n");
