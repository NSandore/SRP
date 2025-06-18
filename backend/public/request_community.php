<?php
require_once __DIR__ . '/../db_connection.php';
require __DIR__ . '/../vendor/autoload.php';
use Mailgun\Mailgun;

header('Content-Type: application/json');
$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['user_id']) || empty($input['name']) || empty($input['type']) || empty($input['description'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

$user_id = (int)$input['user_id'];
$name = trim($input['name']);
$type = trim($input['type']);
$description = trim($input['description']);

try {
    $db = getDB();
    $stmt = $db->prepare("INSERT INTO community_creation_requests (user_id, name, type, description, status, created_at, updated_at) VALUES (:uid, :name, :type, :descr, 'pending', NOW(), NOW())");
    $stmt->execute([
        ':uid' => $user_id,
        ':name' => $name,
        ':type' => $type,
        ':descr' => $description
    ]);
    $request_id = $db->lastInsertId();

    $uStmt = $db->prepare("SELECT email, first_name FROM users WHERE user_id = ?");
    $uStmt->execute([$user_id]);
    $user = $uStmt->fetch(PDO::FETCH_ASSOC);
    $email = $user ? $user['email'] : '';
    $first = $user ? $user['first_name'] : '';

    $mg = Mailgun::create('dba41dc21198fcc4ba525015085cc266-7c5e3295-2c874436');
    $domain = 'sandboxe67f4501277d44af9f736a2154a5b6cb.mailgun.org';
    $mg->messages()->send($domain, [
        'from' => 'StudentSphere <no-reply@studentsphere.com>',
        'to'   => 'n.sandore5140@gmail.com',
        'subject' => 'New Community Request',
        'text' => "Request from $first <$email>\nName: $name\nType: $type\nDescription: $description"
    ]);

    echo json_encode(['success' => true, 'request_id' => $request_id]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
