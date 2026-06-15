<?php
// adminAccess.php - Admin page to change the X variable
session_start();

// Hardcoded password - CHANGE THIS TO YOUR OWN PASSWORD!
define('ADMIN_PASSWORD', 'pelangiGold@123');

// File to store the X value
define('DATA_FILE', 'x_variable.txt');

// Default X value
define('DEFAULT_X', 14);

// Get current X value
$currentX = DEFAULT_X;
if (file_exists(DATA_FILE)) {
    $fileContent = trim(file_get_contents(DATA_FILE));
    if (is_numeric($fileContent) && $fileContent >= 0 && $fileContent <= 50) {
        $currentX = (int)$fileContent;
    }
}

// Handle logout
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: adminAccess.php');
    exit;
}

// Handle login
if (isset($_POST['password'])) {
    if ($_POST['password'] === ADMIN_PASSWORD) {
        $_SESSION['admin_logged_in'] = true;
        header('Location: adminAccess.php');
        exit;
    } else {
        $error = 'Wrong password!';
    }
}

// Handle X value update
if (isset($_POST['update_x']) && isset($_SESSION['admin_logged_in'])) {
    $newX = (int)$_POST['x_value'];
    if ($newX >= 0 && $newX <= 50) {
        file_put_contents(DATA_FILE, $newX);
        $currentX = $newX;
        $success = 'X value updated to ' . $newX . '!';
    } else {
        $error = 'X value must be between 0 and 50';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin - Gold Price Settings</title>
<style>
    body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: #0f172a;
        color: #fff;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
    }
    .admin-container {
        background: #1e293b;
        padding: 40px;
        border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        max-width: 450px;
        width: 100%;
    }
    h2 {
        text-align: center;
        margin-bottom: 25px;
        color: #fbbf24;
    }
    .form-group {
        margin-bottom: 20px;
    }
    label {
        display: block;
        margin-bottom: 8px;
        color: #94a3b8;
        font-size: 14px;
    }
    input[type="password"],
    input[type="number"] {
        width: 100%;
        padding: 12px;
        border: 2px solid #334155;
        border-radius: 8px;
        background: #0f172a;
        color: #fff;
        font-size: 16px;
        box-sizing: border-box;
    }
    input:focus {
        outline: none;
        border-color: #fbbf24;
    }
    .btn {
        width: 100%;
        padding: 12px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: 0.2s;
    }
    .btn-login {
        background: #fbbf24;
        color: #0f172a;
    }
    .btn-login:hover {
        background: #f59e0b;
    }
    .btn-save {
        background: #22c55e;
        color: #fff;
    }
    .btn-save:hover {
        background: #16a34a;
    }
    .btn-logout {
        background: #ef4444;
        color: #fff;
        margin-top: 15px;
    }
    .btn-logout:hover {
        background: #dc2626;
    }
    .error {
        background: rgba(239, 68, 68, 0.2);
        color: #ef4444;
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 15px;
        text-align: center;
    }
    .success {
        background: rgba(34, 197, 94, 0.2);
        color: #22c55e;
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 15px;
        text-align: center;
    }
    .info {
        background: rgba(59, 130, 246, 0.2);
        color: #60a5fa;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
        text-align: center;
    }
    .back-link {
        display: block;
        text-align: center;
        margin-top: 20px;
        color: #94a3b8;
        text-decoration: none;
    }
    .back-link:hover {
        color: #fff;
    }
</style>
</head>
<body>

<div class="admin-container">
    <h2>🔧 Admin Settings</h2>
    
    <?php if (isset($error)): ?>
        <div class="error"><?php echo $error; ?></div>
    <?php endif; ?>
    
    <?php if (isset($success)): ?>
        <div class="success"><?php echo $success; ?></div>
    <?php endif; ?>
    
    <?php if (!isset($_SESSION['admin_logged_in'])): ?>
        <!-- Login Form -->
        <form method="POST">
            <div class="form-group">
                <label>Enter Admin Password</label>
                <input type="password" name="password" placeholder="Password" required autofocus>
            </div>
            <button type="submit" class="btn btn-login">🔑 Login</button>
        </form>
    <?php else: ?>
        <!-- Admin Panel -->
        <div class="info">
            <strong>Current X Value: <?php echo $currentX; ?></strong><br>
            <small>Formula: (SPN9 - X) × Multiplier</small>
        </div>
        
        <form method="POST">
            <div class="form-group">
                <label>Change X Value (Default: 14)</label>
                <input type="number" name="x_value" value="<?php echo $currentX; ?>" min="0" max="50" required>
                <small style="color: #64748b;">Example: 12, 13, 14, 15</small>
            </div>
            <button type="submit" name="update_x" class="btn btn-save">💾 Save Changes</button>
        </form>
        
        <form method="GET" style="margin-top: 15px;">
            <button type="submit" name="logout" class="btn btn-logout">🚪 Logout</button>
        </form>
    <?php endif; ?>
    
    <a href="index.php" class="back-link">← Back to Dashboard</a>
</div>

</body>
</html>
