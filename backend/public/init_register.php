<?php
require_once __DIR__ . '/../db_connection.php';
require __DIR__ . '/../vendor/autoload.php';

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

use Mailgun\Mailgun;

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$inputData = json_decode(file_get_contents('php://input'), true);

$required = ['firstName', 'lastName', 'email', 'phone', 'password'];
foreach ($required as $field) {
    if (empty($inputData[$field])) {
        http_response_code(400);
        echo json_encode(['error' => "$field is required"]);
        exit;
    }
}

$firstName = trim($inputData['firstName']);
$lastName = trim($inputData['lastName']);
$email = trim($inputData['email']);
$phone = trim($inputData['phone']);
$password = password_hash($inputData['password'], PASSWORD_BCRYPT);
// $method = strtolower($inputData['method']);
$verificationCode = random_int(100000, 999999);
$defaultAvatar = 'DefaultAvatar.png';
$defaultBanner = 'DefaultBanner.jpeg';

try {
    $db = getDB();
    $db->beginTransaction();
    $userId = generateUniqueId($db, 'users');

    // Default all new users to the "member" role.
    $roleStmt = $db->prepare("
        SELECT role_id
        FROM roles
        WHERE LOWER(role_name) = 'member'
        LIMIT 1
    ");
    $roleStmt->execute();
    $roleIdRow = $roleStmt->fetch();
    if (!$roleIdRow || !isset($roleIdRow['role_id'])) {
        http_response_code(500);
        echo json_encode(['error' => 'Default role not found. Please seed the roles table with a \"member\" role.']);
        exit;
    }
    $roleId = $roleIdRow['role_id'];

    // Prevent duplicate registration
    $checkStmt = $db->prepare("SELECT user_id FROM users WHERE email = :email");
    $checkStmt->execute([':email' => $email]);
    if ($checkStmt->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'Email already registered']);
        exit;
    }

    // Save user WITH verification_code
    $stmt = $db->prepare("
        INSERT INTO users (user_id, role_id, first_name, last_name, email, phone, password_hash, verification_code, is_verified, avatar_path, banner_path)
        VALUES (:user_id, :role_id, :first_name, :last_name, :email, :phone, :password_hash, :verification_code, 0, :avatar_path, :banner_path)
    ");
    $stmt->execute([
        ':user_id' => $userId,
        ':role_id' => $roleId,
        ':first_name' => $firstName,
        ':last_name' => $lastName,
        ':email' => $email,
        ':phone' => $phone,
        ':password_hash' => $password,
        ':verification_code' => $verificationCode,
        ':avatar_path' => $defaultAvatar,
        ':banner_path' => $defaultBanner
    ]);

    // Send verification email via Mailgun
    $mailgunApiKey = getenv('MAILGUN_API_KEY');

    if (!$mailgunApiKey) {
        error_log('MAILGUN_API_KEY not set');
        http_response_code(500);
        echo 'Mail service is not configured. Please try again later.';
        exit;
    }

    $mailgunDomain = getenv('MAILGUN_DOMAIN') ?: 'sandbox4223236740f0414e949fd59ca1a63257.mailgun.org';
    $fromEmail = "StudentSphere <postmaster@{$mailgunDomain}>";

    try {
        $mg = Mailgun::create($mailgunApiKey);
        $mg->messages()->send($mailgunDomain, [
            'from' => $fromEmail,
            'to' => "{$firstName} {$lastName} <{$email}>",
            'subject' => 'Verify your email for StudentSphere',
            'text' => "Welcome to StudentSphere! Your verification code is {$verificationCode}. Enter this code to verify your email.",
            'html' => "<p>Welcome to StudentSphere!</p><p>Your verification code is <strong>{$verificationCode}</strong>.</p><p>Enter this code in the app to verify your email.</p>"
        ]);
    } catch (\Throwable $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Could not send verification email. Please try again later.']);
        exit;
    }

    $db->commit();

    http_response_code(201);
    echo json_encode([
        'message' => 'User created. Verification email sent.',
        'user_id' => $userId,
        'email' => $email
    ]);

} catch (PDOException $e) {
    if (isset($db) && $db instanceof PDO && $db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
