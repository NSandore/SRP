<?php
require_once __DIR__ . '/../db_connection.php';
require __DIR__ . '/../vendor/autoload.php';

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

use Mailgun\Mailgun;
use Twilio\Rest\Client;

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$inputData = json_decode(file_get_contents('php://input'), true);

$required = ['firstName', 'lastName', 'email', 'phone', 'password', 'method'];
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
$method = strtolower($inputData['method']);
$verificationCode = rand(100000, 999999); // You control the code here

try {
    $db = getDB();

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
        INSERT INTO users (role_id, first_name, last_name, email, phone, password_hash, verification_code, is_verified)
        VALUES (2, :first_name, :last_name, :email, :phone, :password_hash, :verification_code, 0)
    ");
    $stmt->execute([
        ':first_name' => $firstName,
        ':last_name' => $lastName,
        ':email' => $email,
        ':phone' => $phone,
        ':password_hash' => $password,
        ':verification_code' => $verificationCode
    ]);

    $userId = $db->lastInsertId();

    // === EMAIL VERIFICATION (Mailgun) ===
    if ($method === 'email') {
        $mg = Mailgun::create('dba41dc21198fcc4ba525015085cc266-7c5e3295-2c874436');
        $domain = 'sandboxe67f4501277d44af9f736a2154a5b6cb.mailgun.org';
        $from = 'Mailgun Sandbox <postmaster@sandboxe67f4501277d44af9f736a2154a5b6cb.mailgun.org>';
        $to = "$firstName $lastName <$email>";
        $subject = 'Verify Your Account';
        $body = "Hi $firstName,\n\nYour verification code is: $verificationCode\n\nPlease enter this code to continue setting up your account.";

        try {
            $mg->messages()->send($domain, [
                'from' => $from,
                'to' => $to,
                'subject' => $subject,
                'text' => $body
            ]);
        } catch (Exception $mailgunError) {
            http_response_code(500);
            echo json_encode(['error' => 'Mailgun error: ' . $mailgunError->getMessage()]);
            exit;
        }
    }

    // === SMS VERIFICATION (Twilio Messaging API) ===
    elseif ($method === 'sms') {
        $twilioSid = 'ACbbebc4b6d1bde956ea1166f824a72f2d';
        $twilioToken = 'c69b03813322e88a983c93dbf193e161'; // Secure in production
        $twilioFrom = '+15167151963'; // Your Twilio sender number

        $twilio = new Client($twilioSid, $twilioToken);

        try {
            $twilio->messages->create(
                $phone,
                [
                    'from' => $twilioFrom,
                    'body' => "Hi $firstName, your PalatePilot verification code is: $verificationCode"
                ]
            );
        } catch (Exception $twilioError) {
            http_response_code(500);
            echo json_encode(['error' => 'Twilio Messaging error: ' . $twilioError->getMessage()]);
            exit;
        }
    }

    http_response_code(201);
    echo json_encode([
        'message' => 'User created. Verification code sent.',
        'user_id' => $userId
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
