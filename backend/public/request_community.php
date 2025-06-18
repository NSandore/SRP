<?php
session_start();
require_once __DIR__ . '/../db_connection.php';
require __DIR__ . '/../vendor/autoload.php';
use Mailgun\Mailgun;

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$name = trim($input['name'] ?? '');
$type = trim($input['type'] ?? '');
$description = trim($input['description'] ?? '');

if ($name === '' || $type === '' || $description === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

$userId = (int)$_SESSION['user_id'];
$userEmail = $_SESSION['email'] ?? '';

try {
    $db = getDB();
    $stmt = $db->prepare("INSERT INTO community_creation_requests (user_email, name, community_type, description, status, created_at) VALUES (:email, :name, :type, :description, 'pending', NOW())");
    $stmt->execute([
        ':email' => $userEmail,
        ':name' => $name,
        ':type' => $type,
        ':description' => $description
    ]);

    $requestId = $db->lastInsertId();

    // send email to admin
    try {
        $mg = Mailgun::create('dba41dc21198fcc4ba525015085cc266-7c5e3295-2c874436');
        $domain = 'sandboxe67f4501277d44af9f736a2154a5b6cb.mailgun.org';
        $mg->messages()->send($domain, [
            'from' => 'noreply@studentsphere.com',
            'to' => 'n.sandore5140@gmail.com',
            'subject' => 'New Community Creation Request',
            'text' => "User $userEmail requested a new community:\nName: $name\nType: $type\nDescription: $description"
        ]);
    } catch (Exception $e) {
        // ignore mailgun errors but log if needed
    }

    echo json_encode(['success' => true, 'request_id' => $requestId]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
