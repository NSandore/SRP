<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';
require __DIR__ . '/../vendor/autoload.php';

use MailerSend\MailerSend;
use MailerSend\Helpers\Builder\Recipient;
use MailerSend\Helpers\Builder\EmailParams;
use MailerSend\Exceptions\MailerSendValidationException;
use MailerSend\Exceptions\MailerSendRateLimitException;

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

$apiKey = getenv('MAILERSEND_API_KEY');
$fromEmail = getenv('MAILERSEND_FROM_EMAIL');
$fromName = getenv('MAILERSEND_FROM_NAME') ?: 'StudentSphere';

if (!class_exists(MailerSend::class)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'MailerSend SDK not installed. Run composer install in backend.']);
    exit;
}

if (!$apiKey) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'MAILERSEND_API_KEY not set']);
    exit;
}

if (!$fromEmail) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'MAILERSEND_FROM_EMAIL not set']);
    exit;
}

$userId = normalizeId($_SESSION['user_id']);

try {
    $db = getDB();
    $stmt = $db->prepare("
        SELECT first_name, last_name, email
        FROM users
        WHERE user_id = :uid
        LIMIT 1
    ");
    $stmt->execute([':uid' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error']);
    exit;
}

if (!$user || empty($user['email'])) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'User email not found']);
    exit;
}

$toName = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
if ($toName === '') {
    $toName = $user['email'];
}

try {
    $mailersend = new MailerSend(['api_key' => $apiKey]);

    $recipients = [
        new Recipient($user['email'], $toName),
    ];

    $emailParams = (new EmailParams())
        ->setFrom($fromEmail)
        ->setFromName($fromName)
        ->setRecipients($recipients)
        ->setSubject('StudentSphere test email')
        ->setText('This is a test email from StudentSphere to confirm MailerSend is configured.')
        ->setHtml('<p>This is a test email from StudentSphere to confirm MailerSend is configured.</p>');

    $mailersend->email->send($emailParams);

    echo json_encode(['success' => true, 'message' => 'Test email sent.']);
} catch (MailerSendValidationException $e) {
    error_log('MailerSend validation error: ' . $e->getMessage());
    $debug = getenv('MAILERSEND_DEBUG') === '1';
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Unable to send test email',
        'details' => $debug ? ($e->getBody() ?: $e->getMessage()) : null,
    ]);
} catch (MailerSendRateLimitException $e) {
    error_log('MailerSend rate limit: ' . $e->getMessage());
    $debug = getenv('MAILERSEND_DEBUG') === '1';
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'MailerSend rate limit',
        'details' => $debug ? $e->getMessage() : null,
    ]);
} catch (Throwable $e) {
    error_log('MailerSend test email failed: ' . $e->getMessage());
    $debug = getenv('MAILERSEND_DEBUG') === '1';
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Unable to send test email',
        'details' => $debug ? $e->getMessage() : null,
    ]);
}
