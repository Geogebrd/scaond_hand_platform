<?php
header('Content-Type: application/json');
require 'db.php';
session_start();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if ($action === 'register') {
        $username = $input['username'] ?? '';
        $email = $input['email'] ?? '';
        $password = $input['password'] ?? '';

        if (!$username || !$email || !$password) {
            echo json_encode(['error' => 'All fields are required']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
        $stmt->execute([$username, $email]);
        if ($stmt->fetch()) {
            echo json_encode(['error' => 'Username or Email already exists']);
            exit;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)");

        try {
            $stmt->execute([$username, $email, $hash]);
            echo json_encode(['success' => true, 'message' => 'Registration successful']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error']);
        }

    } elseif ($action === 'login') {
        $username = $input['username'] ?? '';
        $password = $input['password'] ?? '';

        $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password_hash'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            echo json_encode(['success' => true, 'message' => 'Login successful', 'user' => ['id' => $user['id'], 'username' => $user['username']]]);
        } else {
            echo json_encode(['error' => 'Invalid credentials']);
        }
    }
} elseif ($method === 'GET') {
    if ($action === 'logout') {
        session_destroy();
        echo json_encode(['success' => true, 'message' => 'Logged out']);
    } elseif ($action === 'check') {
        if (isset($_SESSION['user_id'])) {
            echo json_encode(['authenticated' => true, 'user' => ['id' => $_SESSION['user_id'], 'username' => $_SESSION['username']]]);
        } else {
            echo json_encode(['authenticated' => false]);
        }
    }
}
?>