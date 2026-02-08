<?php
// Import universities from CSV into communities table.
// Usage:
//   php backend/scripts/import_university_csv.php --file=data/university_data_02-08-2025.csv
// Optional:
//   --dry-run
//   --limit=100

require_once __DIR__ . '/../db_connection.php';

function parseArgs(array $argv): array {
    $args = [
        'file' => null,
        'dry_run' => false,
        'limit' => null,
    ];
    foreach ($argv as $arg) {
        if (strpos($arg, '--file=') === 0) {
            $args['file'] = substr($arg, 7);
        } elseif ($arg === '--dry-run') {
            $args['dry_run'] = true;
        } elseif (strpos($arg, '--limit=') === 0) {
            $limit = (int)substr($arg, 8);
            $args['limit'] = $limit > 0 ? $limit : null;
        }
    }
    return $args;
}

function normalizeWebsite(?string $value): ?string {
    $trimmed = trim((string)$value);
    if ($trimmed === '') return null;
    if (strpos($trimmed, 'http://') === 0 || strpos($trimmed, 'https://') === 0) {
        return $trimmed;
    }
    return 'https://' . $trimmed;
}

function normalizeAliases(?string $raw): ?string {
    $raw = trim((string)$raw);
    if ($raw === '') return null;

    $aliases = [];
    if (preg_match('/[;,|]/', $raw) || preg_match('/\s{2,}/', $raw)) {
        $parts = preg_split('/\s{2,}|[;,|]/', $raw);
        if (is_array($parts)) {
            $aliases = $parts;
        }
    } else {
        $aliases = [$raw];
    }

    $aliases = array_values(array_unique(array_filter(array_map(static function ($item) {
        $val = trim((string)$item);
        return $val !== '' ? $val : null;
    }, $aliases))));

    if (!$aliases) return null;
    return json_encode($aliases);
}

$args = parseArgs($argv);
$file = $args['file'] ?? __DIR__ . '/../../data/university_data_02-08-2025.csv';
if (!$file || !is_readable($file)) {
    fwrite(STDERR, "CSV file not found or unreadable: {$file}\n");
    exit(1);
}

$db = getDB();
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$insertSql = "
    INSERT INTO communities (
        id, community_type, parent_community_id, name, tagline, location, website, phone,
        primary_color, secondary_color, aliases, created_at, logo_path, banner_path
    )
    VALUES (
        :id, 'university', NULL, :name, :tagline, :location, :website, :phone,
        :primary_color, :secondary_color, :aliases, NOW(), :logo_path, :banner_path
    )
    ON DUPLICATE KEY UPDATE
        location = VALUES(location),
        website = VALUES(website),
        phone = COALESCE(VALUES(phone), phone),
        aliases = COALESCE(VALUES(aliases), aliases)
";
$stmt = $db->prepare($insertSql);

$defaultLogo = 'default-logo.png';
$defaultBanner = '/uploads/banners/DefaultBanner.jpeg';
$primaryColor = '#0077B5';
$secondaryColor = '#005f8d';

$requiredColumns = [
    'INSTITUTION NAME',
    'ALIAS',
    'ADDRESS',
    'CITY',
    'STATE (ABRV)',
    'ZIP_fiveDigit',
    'TELEPHONE',
    'WEBSITE'
];

$handle = fopen($file, 'r');
if ($handle === false) {
    fwrite(STDERR, "Unable to open file: {$file}\n");
    exit(1);
}

$header = fgetcsv($handle);
if (!$header) {
    fwrite(STDERR, "CSV appears empty: {$file}\n");
    exit(1);
}

$headerMap = [];
foreach ($header as $idx => $name) {
    $headerMap[trim($name)] = $idx;
}

foreach ($requiredColumns as $col) {
    if (!array_key_exists($col, $headerMap)) {
        fwrite(STDERR, "Missing required column: {$col}\n");
        exit(1);
    }
}

$count = 0;
$skipped = 0;
$errors = 0;

while (($row = fgetcsv($handle)) !== false) {
    if ($args['limit'] !== null && $count >= $args['limit']) {
        break;
    }

    $name = trim((string)$row[$headerMap['INSTITUTION NAME']]);
    if ($name === '') {
        $skipped++;
        continue;
    }

    $aliasRaw = $row[$headerMap['ALIAS']] ?? '';
    $address = trim((string)($row[$headerMap['ADDRESS']] ?? ''));
    $city = trim((string)($row[$headerMap['CITY']] ?? ''));
    $state = trim((string)($row[$headerMap['STATE (ABRV)']] ?? ''));
    $zip = trim((string)($row[$headerMap['ZIP_fiveDigit']] ?? ''));
    $phone = trim((string)($row[$headerMap['TELEPHONE']] ?? ''));
    $website = normalizeWebsite($row[$headerMap['WEBSITE']] ?? '');

    $locationParts = array_filter([$address, $city, $state, $zip]);
    $location = implode(', ', $locationParts);
    $phone = preg_replace('/\\D+/', '', $phone);
    if ($phone !== '' && strlen($phone) === 10) {
        $phone = sprintf('(%s) %s-%s', substr($phone, 0, 3), substr($phone, 3, 3), substr($phone, 6));
    }

    $aliasesJson = normalizeAliases($aliasRaw);
    $id = generateUniqueId($db, 'communities');

    if ($args['dry_run']) {
        $count++;
        continue;
    }

    try {
        $stmt->execute([
            ':id' => $id,
            ':name' => $name,
            ':tagline' => null,
            ':location' => $location !== '' ? $location : null,
            ':website' => $website,
            ':primary_color' => $primaryColor,
            ':secondary_color' => $secondaryColor,
            ':aliases' => $aliasesJson,
            ':phone' => $phone !== '' ? $phone : null,
            ':logo_path' => $defaultLogo,
            ':banner_path' => $defaultBanner,
        ]);
        $count++;
    } catch (Throwable $e) {
        $errors++;
        fwrite(STDERR, "Error inserting '{$name}': {$e->getMessage()}\n");
    }
}

fclose($handle);

echo json_encode([
    'inserted_or_updated' => $count,
    'skipped' => $skipped,
    'errors' => $errors,
    'dry_run' => $args['dry_run']
], JSON_PRETTY_PRINT) . PHP_EOL;
