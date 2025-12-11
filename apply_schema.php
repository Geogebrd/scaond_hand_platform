<?php
require 'api/db.php';

$sql = file_get_contents('second_hand_db.sql');

try {
    $pdo->exec($sql);
    echo "Schema applied successfully.\n";
} catch (PDOException $e) {
    echo "Error applying schema: " . $e->getMessage() . "\n";
}
