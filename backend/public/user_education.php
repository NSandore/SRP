<?php
// /api/user_education.php

header('Content-Type: application/json');

// Include your database connection file
require_once '../db_connection.php';

if (!isset($_GET['user_id'])) {
  http_response_code(400);
  echo json_encode(["error" => "Missing user_id"]);
  exit;
}

$user_id = intval($_GET['user_id']);

// Query to fetch the user's education entries
$query = "SELECT degree, institution, duration FROM user_education WHERE user_id = ?";
$stmt = $db->prepare($query);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

$education = [];
while ($row = $result->fetch_assoc()) {
  $education[] = $row;
}

echo json_encode($education);
?>
