<?php
session_start();

// Destroy the session and clear all session variables
session_unset();
session_destroy();

// Send a JSON response indicating success
header('Content-Type: application/json');
echo json_encode(["success" => true]);
exit;
?>
