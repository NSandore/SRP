<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true);

$forum_id = intval($data['forum_id'] ?? 0);
$user_id = intval($data['user_id'] ?? 0);
$vote_type = $data['vote_type'] ?? '';

if ($forum_id <= 0 || $user_id <= 0 || !in_array($vote_type, ['up', 'down'])) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid input"]);
    exit;
}

try {
    $db = getDB();

    // Check if user already voted
    $stmt = $db->prepare("SELECT vote_type FROM forum_votes WHERE forum_id = :forum_id AND user_id = :user_id");
    $stmt->bindParam(':forum_id', $forum_id, PDO::PARAM_INT);
    $stmt->bindParam(':user_id', $user_id, PDO::PARAM_INT);
    $stmt->execute();
    $existing_vote = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing_vote) {
        if ($existing_vote['vote_type'] === $vote_type) {
            // Remove vote if same button is clicked twice
            $stmt = $db->prepare("DELETE FROM forum_votes WHERE forum_id = :forum_id AND user_id = :user_id");
            $stmt->bindParam(':forum_id', $forum_id, PDO::PARAM_INT);
            $stmt->bindParam(':user_id', $user_id, PDO::PARAM_INT);
            $stmt->execute();
            echo json_encode(["success" => true, "message" => "Vote removed"]);
        } else {
            // Update existing vote
            $stmt = $db->prepare("UPDATE forum_votes SET vote_type = :vote_type WHERE forum_id = :forum_id AND user_id = :user_id");
            $stmt->bindParam(':vote_type', $vote_type, PDO::PARAM_STR);
            $stmt->bindParam(':forum_id', $forum_id, PDO::PARAM_INT);
            $stmt->bindParam(':user_id', $user_id, PDO::PARAM_INT);
            $stmt->execute();
            echo json_encode(["success" => true, "message" => "Vote updated"]);
        }
    } else {
        // Insert new vote
        $stmt = $db->prepare("INSERT INTO forum_votes (forum_id, user_id, vote_type) VALUES (:forum_id, :user_id, :vote_type)");
        $stmt->bindParam(':forum_id', $forum_id, PDO::PARAM_INT);
        $stmt->bindParam(':user_id', $user_id, PDO::PARAM_INT);
        $stmt->bindParam(':vote_type', $vote_type, PDO::PARAM_STR);
        $stmt->execute();
        echo json_encode(["success" => true, "message" => "Vote added"]);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database error: " . $e->getMessage()]);
}
?>
