<?php

declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../includes/institution_data/AdminReview.php';
require_once __DIR__ . '/../includes/institution_data/PublicProjection.php';
require_once __DIR__ . '/../session_bootstrap.php';

ini_set('display_errors', '0');
error_reporting(E_ALL);
header('Content-Type: application/json');

startSession();

/**
 * @param array<string, mixed> $payload
 */
function srp_university_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

/**
 * @return list<string>|null
 */
function srp_university_aliases(mixed $raw): ?array
{
    if ($raw === null || $raw === '') {
        return null;
    }
    if (is_string($raw)) {
        $trimmed = trim($raw);
        if ($trimmed === '') {
            return null;
        }
        if (str_starts_with($trimmed, '[')) {
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded)) {
                $raw = $decoded;
            } else {
                throw new InvalidArgumentException('Aliases must be a valid JSON list or comma-separated text.');
            }
        } else {
            $raw = preg_split('/\s*,\s*/', $trimmed) ?: [];
        }
    }
    if (!is_array($raw)) {
        throw new InvalidArgumentException('Aliases must be a list.');
    }

    $aliases = [];
    $seen = [];
    foreach ($raw as $alias) {
        if (is_array($alias) || is_object($alias) || is_resource($alias)) {
            throw new InvalidArgumentException('Each alias must be plain text.');
        }
        $alias = trim((string)$alias);
        if ($alias === '') {
            continue;
        }
        if (strlen($alias) > 255) {
            throw new InvalidArgumentException('Aliases must be 255 characters or fewer.');
        }
        $identity = mb_strtolower($alias, 'UTF-8');
        if (!isset($seen[$identity])) {
            $seen[$identity] = true;
            $aliases[] = $alias;
        }
        if (count($aliases) >= 50) {
            break;
        }
    }
    return $aliases ?: null;
}

/**
 * Validate and move one optional community image.
 *
 * @param array<string, string> $allowedMimeToExtension
 * @return array{public_path: string, disk_path: string}|null
 */
function srp_university_upload(
    string $inputName,
    string $communityId,
    string $prefix,
    string $directory,
    array $allowedMimeToExtension,
    int $maximumBytes
): ?array {
    if (!isset($_FILES[$inputName])) {
        return null;
    }
    $file = $_FILES[$inputName];
    $error = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    if ($error !== UPLOAD_ERR_OK) {
        throw new InvalidArgumentException("The {$inputName} upload did not complete.");
    }
    $size = (int)($file['size'] ?? 0);
    if ($size < 1 || $size > $maximumBytes) {
        throw new InvalidArgumentException(
            sprintf(
                'The %s must be between 1 byte and %d MB.',
                $inputName,
                (int)ceil($maximumBytes / 1_048_576)
            )
        );
    }
    $temporaryPath = (string)($file['tmp_name'] ?? '');
    if ($temporaryPath === '' || !is_uploaded_file($temporaryPath)) {
        throw new InvalidArgumentException("The {$inputName} upload is invalid.");
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = (string)$finfo->file($temporaryPath);
    $extension = $allowedMimeToExtension[$mimeType] ?? null;
    if ($extension === null) {
        throw new InvalidArgumentException("The {$inputName} file type is not supported.");
    }
    if (!is_dir($directory) || !is_writable($directory)) {
        throw new RuntimeException("The {$inputName} upload directory is unavailable.");
    }

    $filename = sprintf(
        '%s_%s_%s.%s',
        $prefix,
        preg_replace('/[^A-Za-z0-9_-]/', '', $communityId),
        bin2hex(random_bytes(10)),
        $extension
    );
    $diskPath = rtrim($directory, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file($temporaryPath, $diskPath)) {
        throw new RuntimeException("The {$inputName} upload could not be stored.");
    }
    @chmod($diskPath, 0644);
    return [
        'public_path' => "/uploads/{$prefix}s/{$filename}",
        'disk_path' => $diskPath,
    ];
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    srp_university_json(['success' => false, 'error' => 'POST is required.'], 405);
}

$communityId = normalizeId($_POST['community_id'] ?? '');
if ($communityId === '') {
    srp_university_json(
        ['success' => false, 'error' => 'A valid community_id is required.'],
        400
    );
}

$sessionUserId = normalizeId($_SESSION['user_id'] ?? '');
$sessionRoleId = isset($_SESSION['role_id']) ? (int)$_SESSION['role_id'] : 0;
if ($sessionUserId === '') {
    srp_university_json(['success' => false, 'error' => 'Not authenticated.'], 401);
}

try {
    $db = getDB();
    if (!canEditCommunitySettings(
        $sessionUserId,
        $sessionRoleId,
        $communityId,
        $db
    )) {
        srp_university_json(
            ['success' => false, 'error' => 'No permission to update this community.'],
            403
        );
    }

    $targetStatement = $db->prepare(
        'SELECT id, community_type FROM communities WHERE id = :id LIMIT 1'
    );
    $targetStatement->execute([':id' => $communityId]);
    $target = $targetStatement->fetch(PDO::FETCH_ASSOC);
    if (!$target) {
        srp_university_json(['success' => false, 'error' => 'Community not found.'], 404);
    }

    $limits = [
        'name' => 100,
        'tagline' => 150,
        'location' => 255,
        'website' => 255,
        'phone' => 50,
    ];
    $changes = [];
    $manualValues = [];
    foreach ($limits as $field => $maximumBytes) {
        if (!array_key_exists($field, $_POST)) {
            continue;
        }
        $value = trim((string)$_POST[$field]);
        if ($field === 'name' && $value === '') {
            throw new InvalidArgumentException('University or group name cannot be empty.');
        }
        if (strlen($value) > $maximumBytes) {
            throw new InvalidArgumentException(
                sprintf('%s must be %d characters or fewer.', ucfirst($field), $maximumBytes)
            );
        }
        $value = $value !== '' ? $value : null;
        $changes[$field] = $value;
        $manualValues[$field] = $value;
    }

    foreach (['primary_color', 'secondary_color'] as $field) {
        if (!array_key_exists($field, $_POST)) {
            continue;
        }
        $rawColor = trim((string)$_POST[$field]);
        if ($rawColor === '') {
            $changes[$field] = null;
            $manualValues[$field] = null;
            continue;
        }
        $normalizedColor = SrpInstitutionColor::normalize($rawColor);
        if ($normalizedColor === null) {
            throw new InvalidArgumentException(
                sprintf('%s must be a supported CSS color.', humanizeColorField($field))
            );
        }
        $changes[$field] = $normalizedColor;
        $manualValues[$field] = $normalizedColor;
    }

    if (array_key_exists('aliases', $_POST)) {
        $aliases = srp_university_aliases($_POST['aliases']);
        $changes['aliases'] = $aliases === null
            ? null
            : json_encode(
                $aliases,
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
            );
        $manualValues['aliases'] = $aliases;
    }

    $movedFiles = [];
    try {
        $logo = srp_university_upload(
            'logo',
            $communityId,
            'logo',
            __DIR__ . '/../../uploads/logos',
            [
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
                'image/gif' => 'gif',
                'image/webp' => 'webp',
            ],
            5 * 1_048_576
        );
        if ($logo !== null) {
            $changes['logo_path'] = $logo['public_path'];
            $manualValues['logo_path'] = $logo['public_path'];
            $movedFiles[] = $logo['disk_path'];
        }
        $banner = srp_university_upload(
            'banner',
            $communityId,
            'banner',
            __DIR__ . '/../../uploads/banners',
            [
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
                'image/webp' => 'webp',
            ],
            10 * 1_048_576
        );
        if ($banner !== null) {
            $changes['banner_path'] = $banner['public_path'];
            $manualValues['banner_path'] = $banner['public_path'];
            $movedFiles[] = $banner['disk_path'];
        }

        if ($changes === []) {
            throw new InvalidArgumentException('No university or group fields were submitted.');
        }

        $db->beginTransaction();
        $set = [];
        $params = [':community_id' => $communityId];
        foreach ($changes as $field => $value) {
            $set[] = "`{$field}` = :{$field}";
            $params[":{$field}"] = $value;
        }
        $set[] = 'updated_at = CURRENT_TIMESTAMP';
        $updateStatement = $db->prepare(
            'UPDATE communities SET ' . implode(', ', $set) . ' WHERE id = :community_id'
        );
        $updateStatement->execute($params);

        if (
            ($target['community_type'] ?? '') === 'university'
            && SrpInstitutionPublicProjection::hasColumn($db, 'manual_overrides_json')
        ) {
            $reviewService = new SrpInstitutionAdminReview($db);
            $reviewService->recordManualEdits(
                $communityId,
                $manualValues,
                $sessionUserId
            );
        }
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        foreach ($movedFiles as $movedFile) {
            if (is_string($movedFile) && is_file($movedFile)) {
                @unlink($movedFile);
            }
        }
        throw $error;
    }

    try {
        $auditStatement = $db->prepare(
            'INSERT INTO audit_logs (id, user_id, action, timestamp)
             VALUES (:id, :user_id, :action, NOW())'
        );
        $auditStatement->execute([
            ':id' => 'a' . bin2hex(random_bytes(15)),
            ':user_id' => $sessionUserId,
            ':action' => sprintf('community_settings_updated:%s', $communityId),
        ]);
    } catch (Throwable $auditError) {
        error_log('[update_university] audit failed: ' . $auditError->getMessage());
    }

    $projection = SrpInstitutionPublicProjection::selectList($db, 'c');
    $selectStatement = $db->prepare(
        "SELECT {$projection} FROM communities c WHERE c.id = :id LIMIT 1"
    );
    $selectStatement->execute([':id' => $communityId]);
    srp_university_json([
        'success' => true,
        'university' => $selectStatement->fetch(PDO::FETCH_ASSOC),
    ]);
} catch (InvalidArgumentException | LengthException $error) {
    srp_university_json(['success' => false, 'error' => $error->getMessage()], 400);
} catch (PDOException $error) {
    error_log('[update_university] database error: ' . $error->getMessage());
    if ((string)$error->getCode() === '23000') {
        srp_university_json(
            ['success' => false, 'error' => 'That name or value is already in use.'],
            409
        );
    }
    srp_university_json(['success' => false, 'error' => 'Unable to update this community.'], 500);
} catch (RuntimeException $error) {
    error_log('[update_university] unavailable: ' . $error->getMessage());
    srp_university_json(['success' => false, 'error' => 'Community updates are temporarily unavailable.'], 503);
} catch (Throwable $error) {
    error_log('[update_university] failed: ' . $error->getMessage());
    srp_university_json(['success' => false, 'error' => 'Unable to update this community.'], 500);
}

/**
 * Human-readable color field label for validation errors.
 */
function humanizeColorField(string $field): string
{
    return ucfirst(str_replace('_', ' ', $field));
}
