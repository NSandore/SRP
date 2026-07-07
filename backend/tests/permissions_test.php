<?php
/**
 * Lightweight assertion tests for the role/permission helpers.
 * Run with:  php backend/tests/permissions_test.php
 * Exits non-zero on any failure (suitable for CI).
 */

require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';

$failures = 0;
function check(string $label, bool $cond): void {
    global $failures;
    if ($cond) {
        echo "  ok  - {$label}\n";
    } else {
        echo "FAIL  - {$label}\n";
        $GLOBALS['failures']++;
    }
}

// Role constants.
check('guest is 0', ROLE_GUEST === 0);
check('member is 1', ROLE_MEMBER === 1);
check('role id 2 is unused (member<moderator gap)', ROLE_MEMBER < ROLE_MODERATOR && (ROLE_MODERATOR - ROLE_MEMBER) === 2);
check('moderator is 3', ROLE_MODERATOR === 3);
check('admin is 4', ROLE_ADMIN === 4);
check('super admin is 5', ROLE_SUPER_ADMIN === 5);

// isSuperAdmin.
check('super admin is super admin', isSuperAdmin(5) === true);
check('admin is not super admin', isSuperAdmin(4) === false);
check('string "5" is super admin', isSuperAdmin('5') === true);

// isAdmin (>= 4).
check('admin is admin', isAdmin(4) === true);
check('super admin is admin', isAdmin(5) === true);
check('moderator is not admin', isAdmin(3) === false);
check('member is not admin', isAdmin(1) === false);

// isModerator (>= 3).
check('moderator is moderator', isModerator(3) === true);
check('admin is moderator', isModerator(4) === true);
check('super admin is moderator', isModerator(5) === true);
check('member is not moderator', isModerator(1) === false);
check('guest is not moderator', isModerator(0) === false);

// Community role normalization (enum is admin/moderator; member is legacy).
check('normalize admin', normalizeCommunityRole('admin') === 'admin');
check('normalize moderator', normalizeCommunityRole('moderator') === 'moderator');
check('normalize legacy member -> moderator', normalizeCommunityRole('member') === 'moderator');
check('normalize unknown -> empty', normalizeCommunityRole('nonsense') === '');
check('normalize mixed case', normalizeCommunityRole('Admin') === 'admin');

echo "\n";
if ($failures > 0) {
    echo "{$failures} test(s) FAILED\n";
    exit(1);
}
echo "All permission tests passed.\n";
exit(0);
