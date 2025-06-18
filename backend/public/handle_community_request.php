<?php
require_once __DIR__ . '/../db_connection.php';
require __DIR__ . '/../vendor/autoload.php';
use Mailgun\Mailgun;
session_start();
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['request_id']) || !isset($input['action'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing fields']);
    exit;
}

$db = getDB();
$stmt = $db->prepare("SELECT email FROM users WHERE user_id = ?");
$stmt->execute([$_SESSION['user_id'] ?? 0]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$user || $user['email'] !== 'n.sandore5140@gmail.com') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

$request_id = (int)$input['request_id'];
$action = $input['action'];

$reqStmt = $db->prepare("SELECT * FROM community_creation_requests WHERE request_id = ?");
$reqStmt->execute([$request_id]);
$request = $reqStmt->fetch(PDO::FETCH_ASSOC);
if (!$request) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Request not found']);
    exit;
}

$status = '';
if ($action === 'approve') {
    $cStmt = $db->prepare("INSERT INTO communities (community_type, name, tagline) VALUES (:type, :name, :tag)");
    $cStmt->execute([
        ':type' => $request['type'],
        ':name' => $request['name'],
        ':tag'  => $request['description']
    ]);
    $community_id = $db->lastInsertId();
    $uStmt = $db->prepare("SELECT email, first_name FROM users WHERE user_id = ?");
    $uStmt->execute([$request['user_id']]);
    $u = $uStmt->fetch(PDO::FETCH_ASSOC);
    $email = $u ? $u['email'] : '';
    $first = $u ? $u['first_name'] : '';
    $adm = $db->prepare("INSERT INTO community_admins (community_id, user_email) VALUES (?, ?)");
    $adm->execute([$community_id, $email]);
    $status = 'approved';
} elseif ($action === 'decline') {
    $status = 'declined';
} else {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid action']);
    exit;
}

$up = $db->prepare("UPDATE community_creation_requests SET status = ?, updated_at = NOW() WHERE request_id = ?");
$up->execute([$status, $request_id]);

$uStmt = $db->prepare("SELECT email, first_name FROM users WHERE user_id = ?");
$uStmt->execute([$request['user_id']]);
$u = $uStmt->fetch(PDO::FETCH_ASSOC);
$email = $u ? $u['email'] : '';
$first = $u ? $u['first_name'] : '';

$mg = Mailgun::create('dba41dc21198fcc4ba525015085cc266-7c5e3295-2c874436');
$domain = 'sandboxe67f4501277d44af9f736a2154a5b6cb.mailgun.org';
if ($status === 'approved') {
    $mg->messages()->send($domain, [
        'from' => 'StudentSphere <no-reply@studentsphere.com>',
        'to'   => "$first <$email>",
        'subject' => 'Community Request Approved',
        'text' => "Your community request '{$request['name']}' has been approved."
    ]);
} else {
    $mg->messages()->send($domain, [
        'from' => 'StudentSphere <no-reply@studentsphere.com>',
        'to'   => "$first <$email>",
        'subject' => 'Community Request Declined',
        'text' => "Your community request '{$request['name']}' was declined."
    ]);
}

echo json_encode(['success' => true, 'status' => $status]);
?>
