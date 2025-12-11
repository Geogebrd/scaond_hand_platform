<?php
header('Content-Type: application/json');
require 'db.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$userId = $_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->prepare("SELECT username, email, real_name, phone, address FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    echo json_encode($user);
} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    $realName = trim($input['real_name'] ?? '');
    $phone = trim($input['phone'] ?? '');
    $address = trim($input['address'] ?? '');

    if (!$realName || !$phone || !$address) {
        echo json_encode(['error' => 'All fields are required']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE users SET real_name = ?, phone = ?, address = ? WHERE id = ?");
    if ($stmt->execute([$realName, $phone, $address, $userId])) {
        echo json_encode(['success' => true, 'message' => 'Profile updated']);
    } else {
        echo json_encode(['error' => 'Update failed']);
    }
}
?>