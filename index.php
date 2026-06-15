<?php
// index.php on InfinityFree
// This file serves as a proxy to your Render backend
// and also provides the frontend

// Read X value from file (default 14)
$XVALUE = 14;
$dataFile = 'x_variable.txt';
if (file_exists($dataFile)) {
    $fileContent = trim(file_get_contents($dataFile));
    if (is_numeric($fileContent) && $fileContent >= 0 && $fileContent <= 50) {
        $XVALUE = (int)$fileContent;
    }
}

// If the request is for gold data, proxy to Render
if (isset($_GET['proxy']) && $_GET['proxy'] === 'gold') {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    
    $renderUrl = 'https://pelangi.onrender.com/gold';
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $renderUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'User-Agent: Mozilla/5.0'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        echo json_encode([
            'success' => false,
            'error' => 'Proxy error: ' . $error
        ]);
    } else {
        echo $response;
    }
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Gold Live Dashboard</title>
<!-- Auto-reload page every 10 seconds -->
<meta http-equiv="refresh" content="10">
<style>
    body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: #0f172a;
        color: #fff;
    }
    .container {
        max-width: 1000px;
        margin: auto;
        padding: 30px;
    }
    h1 {
        text-align: center;
        margin-bottom: 20px;
        font-size: 28px;
    }
    .status {
        text-align: center;
        margin-bottom: 15px;
        font-size: 14px;
    }
    .ok { color: #22c55e; }
    .error { color: #ef4444; }
    .warning { color: #f59e0b; }
    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
    }
    .card {
        background: #1e293b;
        padding: 18px;
        border-radius: 14px;
        box-shadow: 0 10px 20px rgba(0,0,0,0.3);
        transition: 0.2s;
    }
    .card:hover {
        transform: translateY(-3px);
    }
    .label {
        color: #94a3b8;
        font-size: 14px;
    }
    .value {
        font-size: 24px;
        font-weight: bold;
        margin-top: 8px;
    }
    .updated {
        text-align: center;
        margin-top: 20px;
        font-size: 13px;
        color: #94a3b8;
    }
    .countdown {
        text-align: center;
        margin-top: 10px;
        font-size: 12px;
        color: #64748b;
    }
</style>
</head>
<body>

<div class="container">
    <h1>💰 LIVE GOLD PRICING</h1>
    <div class="status" id="status">Loading...</div>
    <div class="grid" id="cards"></div>
    <div class="updated" id="updated"></div>
    <div class="countdown" id="countdown">Page refreshes in 10 seconds</div>
</div>

<script>
// Try Render directly first, fallback to PHP proxy
const RENDER_URL = 'https://pelangi.onrender.com/gold';

// Get X value from PHP - THIS IS THE ONLY CHANGE
const XVALUE = <?php echo $XVALUE; ?>;

async function loadGold() {
    try {
        // Try Render directly first
        let res = await fetch(RENDER_URL);
        
        // If Render fails, try the PHP proxy
        if (!res.ok) {
            console.log('Render direct failed, trying PHP proxy...');
            res = await fetch('?proxy=gold');
        }
        
        const data = await res.json();

        if (!data.success || !data.spn9) {
            throw new Error(data.error || 'Failed to load gold data');
        }

        const spn9 = parseFloat(data.spn9);
        const basePrice = spn9 - XVALUE; // Only changed 14 to XVALUE

        // Calculate prices with proper differences
        function calculatePrices(basePrice) {
            // 999.9 is the highest purity - calculate base
            const price9999 = Math.floor(basePrice * 0.9889);
            
            // 996 should be RM3-RM4 lower than 999.9
            const price996 = price9999 - Math.floor(Math.random() * 2) - 3; // 3-4 difference
            
            // All other purities: RM0.50 to RM1 difference
            const price995 = price996 - 1;
            const price994 = price995 - 1;
            const price993 = price994 - 1;
            const price992 = price993 - 1;
            const price991 = price992 - 1;
            const price990 = price991 - 1;
            
            return [
                { name: "999.9", price: price9999 },
                { name: "996", price: price996 },
                { name: "995", price: price995 },
                { name: "994", price: price994 },
                { name: "993", price: price993 },
                { name: "992", price: price992 },
                { name: "991", price: price991 },
                { name: "990", price: price990 }
            ];
        }

        const purities = calculatePrices(basePrice);

        // Log for debugging
        console.log('SPN9:', spn9, 'Base Price:', basePrice);
        console.table(purities);

        let html = "";
        purities.forEach(p => {
            html += `
                <div class="card">
                    <div class="label">${p.name} PURITY</div>
                    <div class="value">RM ${p.price}</div>
                </div>
            `;
        });

        document.getElementById("cards").innerHTML = html;
        document.getElementById("status").innerHTML = "🟢 LIVE - Auto-updating every 10s";
        document.getElementById("status").className = "status ok";
        
        // Format the updated time
        const updatedDate = new Date(data.updated);
        document.getElementById("updated").innerHTML = 
            "Last Updated: " + updatedDate.toLocaleString();
       // + " | Source Price (SPN9): RM " + spn9;

    } catch (e) {
        document.getElementById("status").innerHTML = "❌ Error: " + e.message;
        document.getElementById("status").className = "status error";
        console.error('Error:', e);
    }
}

// Countdown timer
let secondsLeft = 10;
setInterval(() => {
    secondsLeft--;
    if (secondsLeft <= 0) {
        secondsLeft = 10;
    }
    document.getElementById("countdown").innerHTML = 
        "Page refreshes in " + secondsLeft + " seconds";
}, 1000);

// Load immediately
loadGold();
</script>

</body>
</html>
