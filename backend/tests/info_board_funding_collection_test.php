<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/info_board_article_content.php';
require_once __DIR__ . '/../includes/info_board_funding_collection.php';

$failures = 0;

function funding_collection_check(string $label, bool $condition): void {
    global $failures;
    if ($condition) {
        echo "  ok  - {$label}\n";
        return;
    }
    echo "FAIL  - {$label}\n";
    $failures++;
}

$groups = srp_info_board_funding_collection();
$titles = srp_info_board_funding_titles();
$maintainedArticles = srp_info_board_article_content();

funding_collection_check('defines six funding guide groups', count($groups) === 6);
funding_collection_check('includes twenty-five funding articles', count($titles) === 25);
funding_collection_check('does not repeat collection titles', count(array_unique($titles)) === count($titles));

foreach ($groups as $group) {
    funding_collection_check(
        "{$group['title']}: has a stable key",
        preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $group['key']) === 1
    );
    funding_collection_check("{$group['title']}: has explanatory copy", trim($group['description']) !== '');
    funding_collection_check("{$group['title']}: contains articles", count($group['articles']) >= 3);
}

foreach ($titles as $title) {
    funding_collection_check("{$title}: resolves to maintained content", isset($maintainedArticles[$title]));
}

echo "\n";
if ($failures > 0) {
    echo "{$failures} test(s) FAILED\n";
    exit(1);
}

echo "All Information Board funding-collection assertions passed.\n";
