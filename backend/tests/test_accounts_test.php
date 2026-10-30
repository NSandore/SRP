<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/test_accounts.php';

$failures = 0;

function test_account_check(string $label, bool $condition): void {
    global $failures;
    if ($condition) {
        echo "  ok  - {$label}\n";
        return;
    }
    echo "FAIL  - {$label}\n";
    $failures++;
}

test_account_check('configured test account is enabled', srp_email_has_test_controls('ct.lopsan@gmail.com'));
test_account_check('email matching ignores case and whitespace', srp_email_has_test_controls(' CT.LOPSAN@gmail.com '));
test_account_check('unlisted account is not enabled', !srp_email_has_test_controls('member@example.com'));
test_account_check('empty email is not enabled', !srp_email_has_test_controls(null));

echo "\n";
if ($failures > 0) {
    echo "{$failures} test(s) FAILED\n";
    exit(1);
}

echo "All test-account assertions passed.\n";
