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

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $_GET['action'] ?? '';

    if ($action === 'confirm_receipt') {
        $orderId = $input['order_id'] ?? null;

        if (!$orderId) {
            echo json_encode(['error' => 'Order ID required']);
            exit;
        }

        // Verify ownership
        $stmt = $pdo->prepare("SELECT id FROM orders WHERE id = ? AND buyer_id = ?");
        $stmt->execute([$orderId, $userId]);
        if (!$stmt->fetch()) {
            echo json_encode(['error' => 'Order not found']);
            exit;
        }

        // Update status
        $update = $pdo->prepare("UPDATE orders SET shipping_status = 'received', received_at = NOW() WHERE id = ?");
        if ($update->execute([$orderId])) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['error' => 'Update failed']);
        }
        exit;
    }
}


// Get my purchases
$stmt = $pdo->prepare("
    SELECT o.id as order_id, o.created_at as purchase_date, o.quantity, 
           o.shipping_status, o.shipped_at, o.received_at,
           p.id as product_id, p.title, p.price, p.image_url, p.seller_id,
           u.username as seller_name, u.email as seller_email
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN users u ON p.seller_id = u.id
    WHERE o.buyer_id = ?
    ORDER BY o.created_at DESC
");
$stmt->execute([$userId]);
echo json_encode($stmt->fetchAll());
