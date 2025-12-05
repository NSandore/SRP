<?php
header('Content-Type: application/json');
require __DIR__ . '/../vendor/autoload.php';
use Mailgun\Mailgun;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['name']) || empty($input['email']) || empty($input['message'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

$name = trim($input['name']);
$email = trim($input['email']);
$message = trim($input['message']);

try {
    $mg = Mailgun::create('MAILGUN_API_KEY');
    $domain = 'sandboxe67f4501277d44af9f736a2154a5b6cb.mailgun.org';

    $mg->messages()->send($domain, [
        'from' => "$name <$email>",
        'to' => 'n.sandore5140@gmail.com',
        'subject' => 'StudentSphere Feedback',
        'text' => "Feedback from $name <$email>:\n\n$message"
    ]);

    echo json_encode(['success' => true, 'message' => 'Feedback sent']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Mailgun error: ' . $e->getMessage()]);
}
?>
