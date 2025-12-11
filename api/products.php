<?php
header('Content-Type: application/json');
require 'db.php';
session_start();

$method = $_SERVER['REQUEST_METHOD'];
// Use simple path parsing or query params. Here using query params for simplicity on minimal server config.
// ?id=1 or POST (multipart)

if ($method === 'GET') {
    // List products
    $id = $_GET['id'] ?? null;
    if ($id) {
        $stmt = $pdo->prepare("SELECT p.*, u.username as seller_name FROM products p JOIN users u ON p.seller_id = u.id WHERE p.id = ?");
        $stmt->execute([$id]);
        $product = $stmt->fetch();
        if ($product) {
            echo json_encode($product);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found']);
        }
    } else {
        $search = $_GET['search'] ?? null;
        $sort = $_GET['sort'] ?? 'newest';

        $sql = "SELECT p.*, u.username as seller_name FROM products p JOIN users u ON p.seller_id = u.id WHERE p.status = 'available'";
        $params = [];

        if ($search) {
            $sql .= " AND (p.title LIKE ? OR p.description LIKE ?)";
            $searchTerm = "%$search%";
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }

        switch ($sort) {
            case 'price_asc':
                $sql .= " ORDER BY p.price ASC";
                break;
            case 'price_desc':
                $sql .= " ORDER BY p.price DESC";
                break;
            case 'sales_desc':
                $sql .= " ORDER BY p.sold_quantity DESC";
                break;
            case 'condition_best':
                $sql .= " ORDER BY CASE p.item_condition 
                    WHEN 'New' THEN 1 
                    WHEN 'Like New' THEN 2 
                    WHEN 'Used - Good' THEN 3 
                    WHEN 'Used - Fair' THEN 4 
                    WHEN 'Used - Poor' THEN 5 
                    ELSE 6 END ASC";
                break;
            case 'condition_worst':
                $sql .= " ORDER BY CASE p.item_condition 
                    WHEN 'New' THEN 1 
                    WHEN 'Like New' THEN 2 
                    WHEN 'Used - Good' THEN 3 
                    WHEN 'Used - Fair' THEN 4 
                    WHEN 'Used - Poor' THEN 5 
                    ELSE 6 END DESC";
                break;
            case 'usage_low':
                $sql .= " ORDER BY p.usage_days ASC";
                break;
            case 'usage_high':
                $sql .= " ORDER BY p.usage_days DESC";
                break;
            case 'newest':
            default:
                $sql .= " ORDER BY p.created_at DESC";
                break;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        echo json_encode($stmt->fetchAll());
    }
} elseif ($method === 'POST') {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $action = $_POST['action'] ?? '';

    if ($action === 'buy') {
        $productId = $_POST['product_id'] ?? null;
        if ($productId) {
            $stmt = $pdo->prepare("UPDATE products SET status = 'sold' WHERE id = ? AND status = 'available'");
            $stmt->execute([$productId]);
            if ($stmt->rowCount() > 0) {
                echo json_encode(['success' => true, 'message' => 'Product purchased']);
            } else {
                echo json_encode(['error' => 'Product unavailable']);
            }
        }
    } else {
        // Create product
        // Handle file upload
        $title = $_POST['title'] ?? '';
        $description = $_POST['description'] ?? '';
        $price = $_POST['price'] ?? 0;

        $imageUrl = '';
        if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $uploadDir = 'uploads/';
            // Ensure unique name
            $fileName = uniqid() . '_' . basename($_FILES['image']['name']);
            $targetPath = __DIR__ . '/' . $uploadDir . $fileName; // Absolute path for move_uploaded_file
            $targetPath = str_replace('\\', '/', $targetPath); // Fix windows paths

            if (move_uploaded_file($_FILES['image']['tmp_name'], $targetPath)) {
                $imageUrl = 'api/' . $uploadDir . $fileName; // Relative web path
            }
        }

        if (!$title || !$price) {
            echo json_encode(['error' => 'Title and Price are required']);
            exit;
        }

        $quantity = $_POST['quantity'] ?? 1;
        $isUnlimited = isset($_POST['is_unlimited']) ? 1 : 0;
        $itemCondition = $_POST['item_condition'] ?? '';
        $usageDuration = $_POST['usage_duration'] ?? '';
        $usageDays = $_POST['usage_days'] ?? 0;

        $stmt = $pdo->prepare("INSERT INTO products (seller_id, title, description, price, image_url, quantity, is_unlimited, item_condition, usage_duration, usage_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$_SESSION['user_id'], $title, $description, $price, $imageUrl, $quantity, $isUnlimited, $itemCondition, $usageDuration, $usageDays]);
        echo json_encode(['success' => true, 'message' => 'Product listed']);
    }
}
?>