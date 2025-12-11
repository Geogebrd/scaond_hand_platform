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
$action = $_GET['action'] ?? '';

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    // Send message
    $receiverId = $input['receiver_id'] ?? null;
    $content = $input['content'] ?? '';

    if (!$receiverId || !$content) {
        echo json_encode(['error' => 'Missing fields']);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)");
    try {
        $stmt->execute([$userId, $receiverId, $content]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error']);
    }

} elseif ($method === 'GET') {
    if ($action === 'history') {
        $otherId = $_GET['user_id'] ?? null;
        if (!$otherId) {
            echo json_encode(['error' => 'User ID required']);
            exit;
        }

        $stmt = $pdo->prepare("
            SELECT m.*, u.username as sender_name 
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE (sender_id = ? AND receiver_id = ?) 
               OR (sender_id = ? AND receiver_id = ?)
            ORDER BY created_at ASC
        ");
        $stmt->execute([$userId, $otherId, $otherId, $userId]);
        echo json_encode($stmt->fetchAll());

    } else {
        // List conversations (unique users)
        // This query finds all users you have sent messages to OR received messages from
        $stmt = $pdo->prepare("
            SELECT DISTINCT u.id, u.username 
            FROM users u
            JOIN messages m ON (m.sender_id = u.id AND m.receiver_id = ?) 
                            OR (m.receiver_id = u.id AND m.sender_id = ?)
        ");
        $stmt->execute([$userId, $userId]);
        echo json_encode($stmt->fetchAll());
    }
}
