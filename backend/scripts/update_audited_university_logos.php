<?php

declare(strict_types=1);

require_once __DIR__ . '/../db_connection.php';

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script may only be run from the command line.\n");
    exit(1);
}

/**
 * Current primary university marks verified during the August 2026 logo audit.
 *
 * The source URL stored with each manual override points to the university's
 * current identity guidance. Rasterized copies are kept locally so profiles
 * do not depend on a third-party request at render time.
 *
 * @var array<string, array{
 *     asset_url: string,
 *     source_url: string,
 *     extension?: string,
 *     mime_type?: string,
 *     license_name?: string,
 *     license_url?: string
 * }>
 */
$logos = [
    'Binghamton University' => [
        'asset_url' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Binghamton_University_logo.svg/960px-Binghamton_University_logo.svg.png',
        'source_url' => 'https://www.binghamton.edu/communications-and-marketing/branding/logotype.html',
    ],
    'Albert Einstein College of Medicine' => [
        'asset_url' => 'https://mma.prnewswire.com/media/2056974/5296098/Montefiore_Albert_Einstein_Logo.jpg',
        'source_url' => 'https://einsteinmed.edu/administration/communications-public-affairs/creative-services',
        'extension' => 'jpg',
        'mime_type' => 'image/jpeg',
        'license_name' => 'Copyrighted institutional logo',
        'license_url' => 'https://einsteinmed.edu/administration/communications-public-affairs/creative-services',
    ],
    'Amherst College' => [
        'asset_url' => 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Amherst_College_logo.png',
        'source_url' => 'https://commweb.sites.amherst.edu/',
    ],
    'Boston College' => [
        'asset_url' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Boston_College_Logotype.svg/960px-Boston_College_Logotype.svg.png',
        'source_url' => 'https://www.bc.edu/content/bc-web/offices/office-of-university-communications.html',
    ],
    'Boston University' => [
        'asset_url' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Boston_University_wordmark.svg/960px-Boston_University_wordmark.svg.png',
        'source_url' => 'https://www.bu.edu/brand/guidelines/logos/',
    ],
    'Brandeis University' => [
        'asset_url' => 'https://upload.wikimedia.org/wikipedia/commons/1/15/Brandeis_University_Logo.png',
        'source_url' => 'https://www.brandeis.edu/brand/visual-identity-system/logo/',
    ],
    'Brigham Young University' => [
        'asset_url' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Brigham_Young_University_logo.svg/960px-Brigham_Young_University_logo.svg.png',
        'source_url' => 'https://brand.byu.edu/logos-marks',
    ],
    'Brown University' => [
        'asset_url' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Brown_University_logo.svg/960px-Brown_University_logo.svg.png',
        'source_url' => 'https://ouc.brown.edu/logos-identity',
    ],
    'California Institute of Technology' => [
        'asset_url' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Caltech_Logo.svg/960px-Caltech_Logo.svg.png',
        'source_url' => 'https://identity.caltech.edu/officiallogomarks',
    ],
    'Carnegie Mellon University' => [
        'asset_url' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Carnegie_Mellon_University_wordmark.svg/960px-Carnegie_Mellon_University_wordmark.svg.png',
        'source_url' => 'https://brand.cmu.edu/visual-identity',
    ],
    'Temple University' => [
        'asset_url' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Temple_University_Logo.svg/960px-Temple_University_Logo.svg.png',
        'source_url' => 'https://finance.temple.edu/business-operations/trademark-licensing',
    ],
];

function downloadLogo(string $url, string $expectedMimeType): string
{
    $context = stream_context_create([
        'http' => [
            'follow_location' => 1,
            'max_redirects' => 5,
            'timeout' => 20,
            'header' => "User-Agent: StudentSphereLogoAudit/1.0 (support@thestudentsphere.com)\r\n",
        ],
        'https' => [
            'follow_location' => 1,
            'max_redirects' => 5,
            'timeout' => 20,
            'header' => "User-Agent: StudentSphereLogoAudit/1.0 (support@thestudentsphere.com)\r\n",
        ],
    ]);
    $bytes = @file_get_contents($url, false, $context);
    if (!is_string($bytes) || $bytes === '') {
        throw new RuntimeException("Unable to download {$url}");
    }
    if (strlen($bytes) > 5 * 1_048_576) {
        throw new RuntimeException("Logo exceeds the 5 MB limit: {$url}");
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    if ($finfo->buffer($bytes) !== $expectedMimeType) {
        throw new RuntimeException("Logo does not match the expected {$expectedMimeType} format: {$url}");
    }
    $dimensions = @getimagesizefromstring($bytes);
    if (!is_array($dimensions) || $dimensions[0] < 80 || $dimensions[1] < 30) {
        throw new RuntimeException("Logo dimensions are too small: {$url}");
    }

    return $bytes;
}

$db = getDB();
$find = $db->prepare(
    'SELECT id, manual_overrides_json
       FROM communities
      WHERE community_type = :community_type AND name = :name
      LIMIT 1'
);
$update = $db->prepare(
    'UPDATE communities
        SET logo_path = :logo_path,
            logo_url = :logo_url,
            logo_thumbnail_url = :logo_thumbnail_url,
            logo_type = :logo_type,
            logo_mime_type = :logo_mime_type,
            logo_license_name = :logo_license_name,
            logo_license_url = :logo_license_url,
            logo_attribution = :logo_attribution,
            logo_width = :logo_width,
            logo_height = :logo_height,
            last_logo_check_at = UTC_TIMESTAMP(),
            last_branding_refresh_at = UTC_TIMESTAMP(),
            manual_overrides_json = :manual_overrides_json
      WHERE id = :id'
);

$logoDirectory = dirname(__DIR__, 2) . '/uploads/logos';
if (!is_dir($logoDirectory) || !is_writable($logoDirectory)) {
    fwrite(STDERR, "Logo directory is unavailable: {$logoDirectory}\n");
    exit(1);
}

$updated = 0;
foreach ($logos as $name => $configuration) {
    $find->execute([
        ':community_type' => 'university',
        ':name' => $name,
    ]);
    $community = $find->fetch(PDO::FETCH_ASSOC);
    if (!is_array($community)) {
        fwrite(STDOUT, "SKIP {$name}: no matching community\n");
        continue;
    }

    try {
        $mimeType = $configuration['mime_type'] ?? 'image/png';
        $extension = $configuration['extension'] ?? 'png';
        $bytes = downloadLogo($configuration['asset_url'], $mimeType);
        $dimensions = getimagesizefromstring($bytes);
        $communityId = (string)$community['id'];
        $filename = "logo_{$communityId}_official_20260816.{$extension}";
        $diskPath = $logoDirectory . '/' . $filename;
        $temporaryPath = tempnam($logoDirectory, '.logo-audit-');
        if ($temporaryPath === false || file_put_contents($temporaryPath, $bytes, LOCK_EX) === false) {
            throw new RuntimeException("Unable to stage the logo for {$name}");
        }
        if (!@rename($temporaryPath, $diskPath)) {
            @unlink($temporaryPath);
            throw new RuntimeException("Unable to install the logo for {$name}");
        }
        @chmod($diskPath, 0644);

        $publicPath = "/uploads/logos/{$filename}";
        $overrides = json_decode(
            (string)($community['manual_overrides_json'] ?? ''),
            true
        );
        if (!is_array($overrides)) {
            $overrides = [];
        }
        $overrides['logo_path'] = [
            'value' => $publicPath,
            'source_url' => $configuration['source_url'],
            'notes' => 'Current primary mark selected during the August 2026 university logo audit.',
            'verified_by' => 'studentsphere_logo_audit',
            'verified_at' => gmdate('Y-m-d'),
        ];

        $db->beginTransaction();
        $update->execute([
            ':logo_path' => $publicPath,
            ':logo_url' => $configuration['asset_url'],
            ':logo_thumbnail_url' => $configuration['asset_url'],
            ':logo_type' => 'institutional_logo',
            ':logo_mime_type' => $mimeType,
            ':logo_license_name' => $configuration['license_name'] ?? 'Public domain',
            ':logo_license_url' => $configuration['license_url'] ?? 'https://commons.wikimedia.org/wiki/Commons:Licensing',
            ':logo_attribution' => $name,
            ':logo_width' => (int)$dimensions[0],
            ':logo_height' => (int)$dimensions[1],
            ':manual_overrides_json' => json_encode(
                $overrides,
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
            ),
            ':id' => $communityId,
        ]);
        $db->commit();
        $updated++;
        fwrite(STDOUT, "UPDATED {$name}: {$publicPath}\n");
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        fwrite(STDERR, "ERROR {$name}: {$error->getMessage()}\n");
        exit(1);
    }
}

fwrite(STDOUT, "Completed: {$updated} university logos updated.\n");
