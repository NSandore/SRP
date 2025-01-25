<?php
// -------------------------------------------------------------
// edit_post.php
// -------------------------------------------------------------
//
// Description:
// Handles editing of the root post in a thread. Sanitizes
// user input using HTMLPurifier and updates the database.
//
// -------------------------------------------------------------

// **1. Enable Error Reporting for Debugging**
// **⚠️ IMPORTANT:** Disable or remove these lines in a production environment
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// **2. Start Session**
session_start(); // To access $_SESSION for user info

// **3. Include Database Connection and Composer Autoload**
require_once __DIR__ . '/../db_connection.php';

// **Ensure Composer's autoload is correctly included**
require_once __DIR__ . '/../vendor/autoload.php'; // Adjust path if necessary

// **4. Set Response Header**
header('Content-Type: application/json');

// **5. Authenticate User**
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role_id'])) {
    http_response_code(401); // Unauthorized
    echo json_encode(['error' => 'You must be logged in to edit a post.']);
    exit;
}

$user_id_session = (int)$_SESSION['user_id'];
$role_id_session = (int)$_SESSION['role_id'];

// **6. Decode JSON Input**
$data = json_decode(file_get_contents('php://input'), true);

// **7. Retrieve and Validate Inputs**
$post_id = isset($data['post_id']) ? (int)$data['post_id'] : 0;
$new_content = isset($data['content']) ? trim($data['content']) : '';

// **Basic Validation**
if ($post_id <= 0 || empty($new_content)) {
    http_response_code(400); // Bad Request
    echo json_encode(['error' => 'Invalid post_id or content.']);
    exit;
}

try {
    // **8. Establish Database Connection**
    $db = getDB();

    // **9. Fetch Post Details to Verify Permissions**
    $stmt = $db->prepare("
        SELECT user_id, reply_to 
        FROM posts 
        WHERE post_id = :post_id
    ");
    $stmt->execute([':post_id' => $post_id]);
    $postRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$postRow) {
        // **Post Not Found**
        http_response_code(404);
        echo json_encode(['error' => 'Post not found.']);
        exit;
    }

    // **10. Ensure the Post is the Root Post (not a Reply)**
    if (!is_null($postRow['reply_to'])) {
        http_response_code(403); // Forbidden
        echo json_encode(['error' => 'You cannot edit replies—only the original root post.']);
        exit;
    }

    // **11. Check User Permissions (Admin or Post Owner)**
    if ($role_id_session !== 3 && (int)$postRow['user_id'] !== $user_id_session) {
        http_response_code(403); // Forbidden
        echo json_encode(['error' => 'You do not have permission to edit this post.']);
        exit;
    }

    // **12. Configure HTMLPurifier**
    $config = HTMLPurifier_Config::createDefault();

    // **12.a. Set Cache Directory**
    // Define a cache directory outside the vendor directory for security and manageability
    $cacheDir = __DIR__ . '/../htmlpurifier-cache';

    // **12.b. Create Cache Directory if It Doesn't Exist**
    if (!file_exists($cacheDir)) {
        // Attempt to create the directory
        if (!mkdir($cacheDir, 0755, true)) {
            throw new Exception('Failed to create HTMLPurifier cache directory.');
        }
    }

    // **12.c. Set Cache Serializer Path**
    $config->set('Cache.SerializerPath', $cacheDir);

    // **12.d. (Optional) Customize HTMLPurifier Configuration**
    // For example, allow certain HTML elements or attributes
    // $config->set('HTML.Allowed', 'p,b,a[href],i,em,strong,ul,ol,li');

    // **13. Initialize HTMLPurifier**
    $purifier = new HTMLPurifier($config);

    // **14. Sanitize the New Content**
    $clean_html = $purifier->purify($new_content);

    // **15. Update the Post in the Database**
    $update = $db->prepare("
        UPDATE posts
        SET content = :content,
            updated_at = NOW()
        WHERE post_id = :post_id
    ");
    $update->execute([
        ':content' => $clean_html,
        ':post_id' => $post_id
    ]);

    // **16. Check Update Result and Respond Accordingly**
    if ($update->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Post updated successfully.']);
    } else {
        // **No Changes Made (Content Was the Same)**
        echo json_encode(['success' => false, 'message' => 'No changes made to the post.']);
    }

} catch (PDOException $e) {
    // **17. Handle Database Errors**
    http_response_code(500); // Internal Server Error
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    // **18. Handle General Errors**
    http_response_code(500); // Internal Server Error
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
}

// **19. End of Script**
?>
