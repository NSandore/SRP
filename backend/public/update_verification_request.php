<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../includes/roles.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$roleId = (int)($_SESSION['role_id'] ?? 0);
if ($roleId !== ROLE_SUPER_ADMIN) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid payload']);
    exit;
}

$requestId = normalizeId($payload['request_id'] ?? '');
$decision = trim((string)($payload['decision'] ?? ''));
if ($requestId === '' || !in_array($decision, ['approve', 'reject'], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid request']);
    exit;
}

try {
    $db = getDB();

    $stmt = $db->prepare("SELECT * FROM user_verification_requests WHERE request_id = :rid LIMIT 1");
    $stmt->execute([':rid' => $requestId]);
    $request = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$request) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Request not found']);
        exit;
    }

    $status = $decision === 'approve' ? 'approved' : 'rejected';

    $update = $db->prepare("
        UPDATE user_verification_requests
        SET status = :status, reviewed_by = :reviewed_by, reviewed_at = NOW()
        WHERE request_id = :rid
    ");
    $update->execute([
        ':status' => $status,
        ':reviewed_by' => normalizeId($_SESSION['user_id']),
        ':rid' => $requestId,
    ]);

    if ($decision === 'approve') {
        $communityId = normalizeId($request['community_id'] ?? '');
        $updateUser = $db->prepare("
            UPDATE users
            SET verified = 1, verified_community_id = :cid
            WHERE user_id = :uid
        ");
        $updateUser->execute([
            ':cid' => $communityId !== '' ? $communityId : null,
            ':uid' => normalizeId($request['user_id']),
        ]);
    }

    $recipientId = normalizeId($request['user_id'] ?? '');
    $communityId = normalizeId($request['community_id'] ?? '');
    $communityName = '';
    if ($communityId !== '') {
        $cStmt = $db->prepare("SELECT name FROM communities WHERE id = :cid LIMIT 1");
        $cStmt->execute([':cid' => $communityId]);
        $communityName = (string)($cStmt->fetchColumn() ?: '');
    }

    $recipientStmt = $db->prepare("SELECT first_name, last_name, email FROM users WHERE user_id = :uid LIMIT 1");
    $recipientStmt->execute([':uid' => $recipientId]);
    $recipient = $recipientStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $decisionLabel = $decision === 'approve' ? 'approved' : 'rejected';
    $suffix = $communityName !== '' ? " for {$communityName}" : '';
    $message = "Your verification request{$suffix} was {$decisionLabel}.";

    if ($recipientId !== '') {
        $notifStmt = $db->prepare("
            INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message)
            VALUES (:nid, :rid, :aid, 'verification_result', :ref, :message)
        ");
        $notifStmt->execute([
            ':nid' => generateUniqueId($db, 'notifications'),
            ':rid' => $recipientId,
            ':aid' => normalizeId($_SESSION['user_id']),
            ':ref' => $requestId,
            ':message' => $message,
        ]);
    }

    $apiKey = getenv('MAILERSEND_API_KEY');
    $fromEmail = getenv('MAILERSEND_FROM_EMAIL');
    $fromName = getenv('MAILERSEND_FROM_NAME') ?: 'StudentSphere';
    if (!empty($recipient['email']) && class_exists(\MailerSend\MailerSend::class) && $apiKey && $fromEmail) {
        try {
            $toName = trim(($recipient['first_name'] ?? '') . ' ' . ($recipient['last_name'] ?? ''));
            if ($toName === '') {
                $toName = $recipient['email'];
            }
            $mailersend = new \MailerSend\MailerSend(['api_key' => $apiKey]);
            $recipients = [new \MailerSend\Helpers\Builder\Recipient($recipient['email'], $toName)];
            $subject = "Your verification request was {$decisionLabel}";
            $textBody = $message . " You can continue using StudentSphere in the meantime.";
            $htmlBody = "<p>{$message}</p><p>You can continue using StudentSphere in the meantime.</p>";
            $emailParams = (new \MailerSend\Helpers\Builder\EmailParams())
                ->setFrom($fromEmail)
                ->setFromName($fromName)
                ->setRecipients($recipients)
                ->setSubject($subject)
                ->setText($textBody)
                ->setHtml($htmlBody);
            $mailersend->email->send($emailParams);
        } catch (Throwable $e) {
            error_log('Verification email send failed: ' . $e->getMessage());
        }
    }

    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    error_log('update_verification_request error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to update verification request']);
}
