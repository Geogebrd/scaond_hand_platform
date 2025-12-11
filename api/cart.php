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

if ($method === 'GET') {
    // Get cart items
    $stmt = $pdo->prepare("
        SELECT c.id as cart_id, c.quantity as cart_quantity, p.*, u.username as seller_name 
        FROM cart_items c 
        JOIN products p ON c.product_id = p.id 
        JOIN users u ON p.seller_id = u.id 
        WHERE c.user_id = ?
    ");
    $stmt->execute([$userId]);
    $items = $stmt->fetchAll();
    echo json_encode($items);

} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if ($action === 'add') {
        $productId = $input['product_id'] ?? null;
        $quantity = (int) ($input['quantity'] ?? 1);
        if ($quantity < 1)
            $quantity = 1;

        if (!$productId) {
            echo json_encode(['error' => 'Product ID required']);
            exit;
        }

        // Check if product exists and is available
        $stmt = $pdo->prepare("SELECT status, quantity as stock, sold_quantity, is_unlimited, seller_id FROM products WHERE id = ?");
        $stmt->execute([$productId]);
        $product = $stmt->fetch();

        if (!$product) {
            echo json_encode(['error' => 'Product not found']);
            exit;
        }
        if ($product['status'] !== 'available') {
            echo json_encode(['error' => 'Product is sold']);
            exit;
        }
        if ($product['seller_id'] == $userId) {
            echo json_encode(['error' => 'Cannot buy your own product']);
            exit;
        }

        // Check existing cart quantity
        $stmt = $pdo->prepare("SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?");
        $stmt->execute([$userId, $productId]);
        $existing = $stmt->fetch();
        $currentCartQty = $existing ? $existing['quantity'] : 0;

        // Check stock limit
        if (!$product['is_unlimited']) {
            $availableQty = $product['stock'] - ($product['sold_quantity'] ?? 0);
            if (($currentCartQty + $quantity) > $availableQty) {
                echo json_encode(['error' => 'Not enough stock available']);
                exit;
            }
        }

        // Add to cart or update quantity
        try {
            if ($existing) {
                $stmt = $pdo->prepare("UPDATE cart_items SET quantity = quantity + ? WHERE user_id = ? AND product_id = ?");
                $stmt->execute([$quantity, $userId, $productId]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)");
                $stmt->execute([$userId, $productId, $quantity]);
            }
            echo json_encode(['success' => true, 'message' => 'Added to cart']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error']);
        }

    } elseif ($action === 'remove') {
        $cartId = $input['cart_id'] ?? null;
        if (!$cartId) {
            echo json_encode(['error' => 'Cart ID required']);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM cart_items WHERE id = ? AND user_id = ?");
        $stmt->execute([$cartId, $userId]);
        echo json_encode(['success' => true, 'message' => 'Removed from cart']);

    } elseif ($action === 'checkout') {
        // Simple checkout: Buy all items in cart
        $shippingData = [
            'name' => $input['shipping_name'] ?? null,
            'address' => $input['shipping_address'] ?? null,
            'phone' => $input['shipping_phone'] ?? null
        ];

        if (!$shippingData['name'] || !$shippingData['address'] || !$shippingData['phone']) {
            // Check if user has saved settings
            $stmtUser = $pdo->prepare("SELECT real_name, address, phone FROM users WHERE id = ?");
            $stmtUser->execute([$userId]);
            $userMeta = $stmtUser->fetch();

            if ($userMeta && $userMeta['real_name'] && $userMeta['address'] && $userMeta['phone']) {
                $shippingData['name'] = $shippingData['name'] ?: $userMeta['real_name'];
                $shippingData['address'] = $shippingData['address'] ?: $userMeta['address'];
                $shippingData['phone'] = $shippingData['phone'] ?: $userMeta['phone'];
            } else {
                echo json_encode(['error' => 'MISSING_ADDRESS']); // Special error code for frontend redirection
                exit;
            }
        }

        $stmt = $pdo->prepare("SELECT product_id, quantity FROM cart_items WHERE user_id = ?");
        $stmt->execute([$userId]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($items)) {
            echo json_encode(['error' => 'Cart is empty']);
            exit;
        }

        $result = processCheckout($pdo, $userId, $items, $shippingData);

        if ($result['success']) {
            // Clear cart only on successful cart checkout
            $stmt = $pdo->prepare("DELETE FROM cart_items WHERE user_id = ?");
            $stmt->execute([$userId]);
            echo json_encode(['success' => true, 'message' => 'Checkout successful']);
        } else {
            echo json_encode(['error' => $result['error']]);
        }

    } elseif ($action === 'buy_now') {
        // Buy single item directly
        $productId = $input['product_id'] ?? null;
        $quantity = (int) ($input['quantity'] ?? 1);

        if (!$productId) {
            echo json_encode(['error' => 'Product ID required']);
            exit;
        }
        if ($quantity < 1)
            $quantity = 1;

        $items = [['product_id' => $productId, 'quantity' => $quantity]];

        $shippingData = [
            'name' => $input['shipping_name'] ?? null,
            'address' => $input['shipping_address'] ?? null,
            'phone' => $input['shipping_phone'] ?? null
        ];

        if (!$shippingData['name'] || !$shippingData['address'] || !$shippingData['phone']) {
            // Check if user has saved settings
            $stmtUser = $pdo->prepare("SELECT real_name, address, phone FROM users WHERE id = ?");
            $stmtUser->execute([$userId]);
            $userMeta = $stmtUser->fetch();

            if ($userMeta && $userMeta['real_name'] && $userMeta['address'] && $userMeta['phone']) {
                $shippingData['name'] = $shippingData['name'] ?: $userMeta['real_name'];
                $shippingData['address'] = $shippingData['address'] ?: $userMeta['address'];
                $shippingData['phone'] = $shippingData['phone'] ?: $userMeta['phone'];
            } else {
                $missing = [];
                if (!$userMeta || !$userMeta['real_name'])
                    $missing[] = 'Name';
                if (!$userMeta || !$userMeta['address'])
                    $missing[] = 'Address';
                if (!$userMeta || !$userMeta['phone'])
                    $missing[] = 'Phone';

                // Return detailed error for debugging, but keep code for frontend
                echo json_encode(['error' => 'MISSING_ADDRESS', 'details' => 'Missing: ' . implode(', ', $missing)]);
                exit;
            }
        }

        $result = processCheckout($pdo, $userId, $items, $shippingData);

        if ($result['success']) {
            echo json_encode(['success' => true, 'message' => 'Purchase successful']);
        } else {
            echo json_encode(['error' => $result['error']]);
        }
    }
}

// Shared Checkout Logic
function processCheckout($pdo, $userId, $items, $shippingData)
{
    $pdo->beginTransaction();
    try {
        foreach ($items as $item) {
            $productId = $item['product_id'];
            $buyQty = $item['quantity'];

            // Check availability
            $stmt = $pdo->prepare("SELECT status, quantity, sold_quantity, is_unlimited, seller_id, price FROM products WHERE id = ? FOR UPDATE");
            $stmt->execute([$productId]);
            $prod = $stmt->fetch();

            if (!$prod)
                throw new Exception("Product $productId is no longer available");

            if ($prod['seller_id'] == $userId) {
                throw new Exception("Cannot buy your own product");
            }

            // If not unlimited and qty <= 0, it's out of stock
            if (!$prod['is_unlimited']) {
                $soldQty = $prod['sold_quantity'] ?? 0;
                $available = $prod['quantity'] - $soldQty;

                if ($available < $buyQty) {
                    throw new Exception("Not enough stock for Product $productId (Available: $available, Requested: $buyQty)");
                }
            }

            if ($prod['status'] !== 'available') {
                if ($prod['status'] === 'sold') {
                    throw new Exception("Product is marked as sold");
                }
            }

            // Calculate Prices
            $unitPrice = $prod['price'];
            $totalPrice = $unitPrice * $buyQty;
            $sellerId = $prod['seller_id'];

            // Create Order with shipping info
            $insertOrder = $pdo->prepare("
                INSERT INTO orders (
                    buyer_id, product_id, quantity, unit_price, total_price, seller_id, 
                    shipping_name, shipping_address, shipping_phone, shipping_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            ");
            $insertOrder->execute([
                $userId,
                $productId,
                $buyQty,
                $unitPrice,
                $totalPrice,
                $sellerId,
                $shippingData['name'],
                $shippingData['address'],
                $shippingData['phone']
            ]);

            // Update Quantity if not unlimited
            if (!$prod['is_unlimited']) {
                $newSoldQty = ($prod['sold_quantity'] ?? 0) + $buyQty;
                $newStatus = ($newSoldQty >= $prod['quantity']) ? 'sold' : 'available';

                $update = $pdo->prepare("UPDATE products SET sold_quantity = ?, status = ? WHERE id = ?");
                $update->execute([$newSoldQty, $newStatus, $productId]);
            }
        }

        // Auto-save shipping info to user profile if provided and different
        // specific check: if we used input data (not retrieved from DB inside function), we might want to save it.
        // For simplicity, always update user profile with the latest successful shipping info.
        if ($shippingData['name'] && $shippingData['address'] && $shippingData['phone']) {
            try {
                $updateUser = $pdo->prepare("UPDATE users SET real_name = ?, address = ?, phone = ? WHERE id = ?");
                $updateUser->execute([
                    $shippingData['name'],
                    $shippingData['address'],
                    $shippingData['phone'],
                    $userId
                ]);
            } catch (Exception $e) { /* Ignore profile update errors, mostly harmless */
            }
        }

        $pdo->commit();
        return ['success' => true];

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        return ['success' => false, 'error' => $e->getMessage()];
    }
}
