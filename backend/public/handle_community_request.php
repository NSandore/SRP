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

if (!isset($_SESSION['user_id']) || $_SESSION['email'] !== 'n.sandore5140@gmail.com') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$requestId = isset($data['request_id']) ? normalizeId($data['request_id']) : '';
$action = $data['action'] ?? '';

if ($requestId === '' || !in_array($action, ['approve','decline'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid parameters']);
    exit;
}

try {
    $db = getDB();
    $stmt = $db->prepare("SELECT r.*, u.email FROM community_creation_requests r JOIN users u ON r.user_email = u.email WHERE r.id = :id");
    $stmt->execute([':id' => $requestId]);
    $request = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$request) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Request not found']);
        exit;
    }

    if ($action === 'approve') {
        // create community with provided info
        $communityId = generateUniqueId($db, 'communities');
        $defaultLogo = ($request['community_type'] === 'group') ? 'DefaultGroup.png' : 'default-logo.png';
        $defaultBanner = '/uploads/banners/DefaultBanner.jpeg';

        $stmt = $db->prepare(
            "INSERT INTO communities (id, community_type, name, tagline, location, website, primary_color, secondary_color, logo_path, banner_path) " .
            "VALUES (:id, :type, :name, :tagline, :location, :website, :primary_color, :secondary_color, :logo_path, :banner_path)"
        );
        $stmt->execute([
            ':id' => $communityId,
            ':type' => $request['community_type'],
            ':name' => $request['name'],
            ':tagline' => $request['tagline'],
            ':location' => $request['location'],
            ':website' => $request['website'],
            ':primary_color' => $request['primary_color'] ?: '#0077B5',
            ':secondary_color' => $request['secondary_color'] ?: '#005f8d',
            ':logo_path' => $defaultLogo,
            ':banner_path' => $defaultBanner
        ]);
        // add admin ambassador
        $adminId = generateUniqueId($db, 'ambassadors');
        $stmt = $db->prepare("INSERT INTO ambassadors (id, user_id, community_id, role) VALUES (:id, (SELECT user_id FROM users WHERE email = :email), :cid, 'admin')");
        $stmt->execute([':id' => $adminId, ':cid' => $communityId, ':email' => $request['email']]);
        $status = 'approved';
    } else {
        $status = 'declined';
    }

    $stmt = $db->prepare("UPDATE community_creation_requests SET status = :status WHERE id = :id");
    $stmt->execute([':status' => $status, ':id' => $requestId]);

    // send email to requester
    try {
        $mg = Mailgun::create('MAILGUN_API_KEY');
        $domain = 'sandboxe67f4501277d44af9f736a2154a5b6cb.mailgun.org';
        $subject = $status === 'approved' ? 'Community Request Approved' : 'Community Request Declined';
        $text = $status === 'approved'
            ? "Your community request '{$request['name']}' has been approved."
            : "Your community request '{$request['name']}' has been declined.";
        $mg->messages()->send($domain, [
            'from' => 'noreply@studentsphere.com',
            'to' => $request['email'],
            'subject' => $subject,
            'text' => $text
        ]);
    } catch (Exception $e) {
        // ignore mailgun errors
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
