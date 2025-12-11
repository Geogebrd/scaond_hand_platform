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

    if ($action === 'update_status') {
        $orderId = $input['order_id'] ?? null;
        $status = $input['status'] ?? null;

        if (!$orderId || !in_array($status, ['pending', 'shipped'])) {
            echo json_encode(['error' => 'Invalid parameters']);
            exit;
        }

        // Verify ownership
        $check = $pdo->prepare("SELECT id FROM orders WHERE id = ? AND seller_id = ?");
        $check->execute([$orderId, $userId]);
        if (!$check->fetch()) {
            echo json_encode(['error' => 'Order not found']);
            exit;
        }

        // Update
        if ($status === 'shipped') {
            $stmt = $pdo->prepare("UPDATE orders SET shipping_status = 'shipped', shipped_at = NOW() WHERE id = ?");
        } else {
            // Revert to pending
            $stmt = $pdo->prepare("UPDATE orders SET shipping_status = 'pending', shipped_at = NULL WHERE id = ?");
        }

        if ($stmt->execute([$orderId])) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['error' => 'Update failed']);
        }
        exit;
    }
}


// Get my active listings
$stmt = $pdo->prepare("SELECT * FROM products WHERE seller_id = ? ORDER BY created_at DESC");
$stmt->execute([$userId]);
$products = $stmt->fetchAll();

// Get my sales (history)
$stmt = $pdo->prepare("
    SELECT o.id as order_id, o.created_at as sale_date, o.quantity, 
           o.unit_price, o.total_price,
           o.shipping_status, o.shipped_at, o.received_at,
           o.shipping_name, o.shipping_address, o.shipping_phone,
           p.title, p.image_url,
           u.username as buyer_name, u.email as buyer_email, u.id as buyer_id
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN users u ON o.buyer_id = u.id
    WHERE o.seller_id = ?
    ORDER BY o.created_at DESC
");
$stmt->execute([$userId]);
$sales = $stmt->fetchAll();

echo json_encode(['listings' => $products, 'sales' => $sales]);
