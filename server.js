const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
    origin: '*',
    methods: ['GET']
}));

// Memory-optimized cache variables
let cachedAjaxUrl = null;
let lastUrlFetch = 0;
const URL_CACHE_DURATION = 5000; // 5 seconds
let cachedGoldData = null;
let lastGoldFetch = 0;
const GOLD_CACHE_DURATION = 2000;
const FETCH_INTERVAL = 15000; // 15 seconds
const MAX_CACHE_AGE = 60000; // Clear cache after 1 minute

// Known hash from the website
const AJAX_HASH = 'c7345ad4580290c2971b1a5b43b0db0a';

// Memory cleanup function
function clearMemoryCache() {
    const now = Date.now();
    
    // Clear old AJAX URL
    if (cachedAjaxUrl && (now - lastUrlFetch) > MAX_CACHE_AGE) {
        cachedAjaxUrl = null;
        console.log('🧹 Cleared old AJAX URL cache');
    }
    
    // Clear old gold data
    if (cachedGoldData && (now - lastGoldFetch) > MAX_CACHE_AGE) {
        cachedGoldData = null;
        console.log('🧹 Cleared old gold data cache');
    }
    
    // Force garbage collection hint
    if (global.gc) {
        global.gc();
    }
}

// Function to extract prefix from the page
async function extractPrefix() {
    try {
        console.log('Extracting prefix from page...');
        
        const response = await axios.get('https://msgold.com.my/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache'
            },
            timeout: 15000
        });
        
        const html = response.data;
        
        // Clear response data immediately to free memory
        response.data = null;
        
        // Look for: ajax("refg4","PREFIX_"+s+"_HASH","eval","","");
        const match = html.match(/ajax\("refg4","(\d+)_"\+s\+"_([a-f0-9]+)"/);
        
        if (match) {
            const prefix = match[1];
            const hash = match[2];
            console.log('Found prefix:', prefix, 'hash:', hash);
            return { prefix, hash };
        }
        
        console.log('Could not find prefix in page');
        return null;
        
    } catch (error) {
        console.error('Error extracting prefix:', error.message);
        return null;
    }
}

function generateAjaxUrl(prefix, hash) {
    const timestamp = Math.floor(Date.now() / 1000);
    const seed = Math.random();
    const q = `${prefix}_${timestamp}_${hash}`;
    
    return `adminxsettings/__ajax2.php?fn=refg4&m=eval&f=&q=${q}&seed=${seed}`;
}

async function fetchGoldData(url) {
    try {
        const fullUrl = `https://msgold.com.my/${url}`;
        console.log('Fetching:', fullUrl);
        
        const response = await axios.get(fullUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://msgold.com.my/',
                'Cache-Control': 'no-cache'
            },
            timeout: 10000
        });
        
        const data = response.data;
        
        // Clear response object to free memory
        response.data = null;
        
        return data;
        
    } catch (error) {
        console.error('Fetch error:', error.message);
        return null;
    }
}

function parseGoldData(rawData) {
    let spn9 = null;
    
    // Convert to string if needed
    let dataStr = typeof rawData === 'string' ? rawData : JSON.stringify(rawData);
    
    // Remove outer quotes if present
    dataStr = dataStr.replace(/^["']|["']$/g, '');
    
    // Look for updprc('spn9','XXX.XX') pattern
    const spn9Match = dataStr.match(/updprc\('spn9','([\d,]+\.?\d*)'\)/);
    
    if (spn9Match) {
        // Remove commas and parse
        spn9 = parseFloat(spn9Match[1].replace(/,/g, ''));
        console.log('Found spn9:', spn9);
        return spn9;
    }
    
    // Alternative: look for any spn9 reference
    const altMatch = dataStr.match(/spn9[^0-9]*([\d,]+\.?\d*)/);
    if (altMatch) {
        spn9 = parseFloat(altMatch[1].replace(/,/g, ''));
        console.log('Found spn9 (alt):', spn9);
        return spn9;
    }
    
    // Look for cus0 which sometimes equals spn9
    const cus0Match = dataStr.match(/updprc\('cus0','([\d,]+\.?\d*)'\)/);
    if (cus0Match) {
        spn9 = parseFloat(cus0Match[1].replace(/,/g, ''));
        console.log('Found cus0 (same as spn9):', spn9);
        return spn9;
    }
    
    console.log('Could not parse spn9 from data');
    return null;
}

// Auto-fetch function that runs every 15 seconds
async function autoFetchGoldPrice() {
    try {
        const now = Date.now();
        
        // Memory cleanup check
        clearMemoryCache();
        
        // Get fresh prefix if URL is old
        let hash = AJAX_HASH;
        
        if (!cachedAjaxUrl || (now - lastUrlFetch) > URL_CACHE_DURATION) {
            const params = await extractPrefix();
            if (params) {
                hash = params.hash;
                cachedAjaxUrl = generateAjaxUrl(params.prefix, hash);
                lastUrlFetch = now;
                console.log('🔄 Generated new URL:', cachedAjaxUrl);
            }
        }
        
        // If no URL yet, try to generate one
        if (!cachedAjaxUrl) {
            // Try a few common prefixes
            for (let testPrefix of ['3581', '794', '1360', '2104']) {
                cachedAjaxUrl = generateAjaxUrl(testPrefix, hash);
                lastUrlFetch = now;
                console.log('Trying prefix', testPrefix, ':', cachedAjaxUrl);
                
                const rawData = await fetchGoldData(cachedAjaxUrl);
                if (rawData) {
                    const spn9 = parseGoldData(rawData);
                    if (spn9) {
                        console.log('✅ Found working prefix:', testPrefix);
                        break;
                    }
                }
                // If prefix didn't work, reset URL
                cachedAjaxUrl = null;
            }
        }
        
        // Fetch with current URL
        if (cachedAjaxUrl) {
            const rawData = await fetchGoldData(cachedAjaxUrl);
            
            if (rawData) {
                const spn9 = parseGoldData(rawData);
                
                if (spn9) {
                    // Only update if value changed (reduces memory operations)
                    if (!cachedGoldData || cachedGoldData.spn9 !== spn9) {
                        cachedGoldData = {
                            success: true,
                            spn9: spn9,
                            updated: new Date().toISOString(),
                            timestamp: Date.now()
                        };
                        lastGoldFetch = Date.now();
                        console.log('✅ Updated gold price (spn9):', spn9);
                    } else {
                        // Update timestamp only
                        if (cachedGoldData) {
                            cachedGoldData.updated = new Date().toISOString();
                            cachedGoldData.timestamp = Date.now();
                        }
                        lastGoldFetch = Date.now();
                        console.log('💲 Gold price unchanged (spn9):', spn9);
                    }
                    return;
                }
            }
            
            // If fetch failed, try fresh extraction
            console.log('Fetch failed, trying fresh extraction...');
            const params = await extractPrefix();
            if (params) {
                cachedAjaxUrl = generateAjaxUrl(params.prefix, params.hash);
                lastUrlFetch = now;
                const rawData = await fetchGoldData(cachedAjaxUrl);
                if (rawData) {
                    const spn9 = parseGoldData(rawData);
                    if (spn9) {
                        cachedGoldData = {
                            success: true,
                            spn9: spn9,
                            updated: new Date().toISOString(),
                            timestamp: Date.now()
                        };
                        lastGoldFetch = Date.now();
                        console.log('✅ Fresh extraction - Gold price (spn9):', spn9);
                    }
                }
            }
        }
        
        // Clear local variables to help garbage collection
        rawData = null;
        hash = null;
        
    } catch (error) {
        console.error('Auto-fetch error:', error.message);
    }
}

// Heartbeat function to keep Render alive
function heartbeat() {
    console.log('💓 Heartbeat - Service alive at', new Date().toISOString());
    
    // Log memory usage if available
    if (process.memoryUsage) {
        const mem = process.memoryUsage();
        console.log(`📊 Memory: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB`);
    }
    
    // Clean old caches
    clearMemoryCache();
}

// Self-ping to prevent sleep
async function selfPing() {
    try {
        const http = require('http');
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: '/',
            method: 'GET',
            timeout: 5000
        };
        
        const req = http.request(options, (res) => {
            console.log('🔔 Self-ping successful - Status:', res.statusCode);
        });
        
        req.on('error', (error) => {
            console.error('Self-ping error:', error.message);
        });
        
        req.end();
    } catch (error) {
        console.error('Self-ping failed:', error.message);
    }
}

app.get('/gold', async (req, res) => {
    try {
        // If we have cached data, return it immediately
        if (cachedGoldData) {
            console.log('📤 Serving cached gold data:', cachedGoldData.spn9);
            return res.json(cachedGoldData);
        }
        
        // If no cached data, do an immediate fetch
        console.log('No cached data, doing immediate fetch...');
        await autoFetchGoldPrice();
        
        if (cachedGoldData) {
            res.json(cachedGoldData);
        } else {
            res.json({
                success: false,
                error: 'Could not fetch gold data'
            });
        }
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/health', (req, res) => {
    const mem = process.memoryUsage();
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        memory: {
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
            rss: Math.round(mem.rss / 1024 / 1024) + 'MB'
        },
        cache: {
            hasUrl: cachedAjaxUrl !== null,
            hasData: cachedGoldData !== null,
            urlAge: cachedAjaxUrl ? Math.round((Date.now() - lastUrlFetch) / 1000) + 's' : 'none',
            dataAge: cachedGoldData ? Math.round((Date.now() - lastGoldFetch) / 1000) + 's' : 'none'
        },
        last_gold_price: cachedGoldData ? cachedGoldData.spn9 : null,
        last_updated: cachedGoldData ? cachedGoldData.updated : null
    });
});

app.get('/debug', async (req, res) => {
    try {
        const response = await axios.get('https://msgold.com.my/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });
        
        const html = response.data;
        response.data = null; // Clear memory
        
        const match = html.match(/ajax\("refg4","(\d+)_"\+s\+"_([a-f0-9]+)"/);
        
        let testResult = null;
        if (match) {
            const prefix = match[1];
            const hash = match[2];
            const testUrl = generateAjaxUrl(prefix, hash);
            
            try {
                const testResponse = await axios.get(`https://msgold.com.my/${testUrl}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Referer': 'https://msgold.com.my/'
                    },
                    timeout: 10000
                });
                
                const data = typeof testResponse.data === 'string' ? testResponse.data : JSON.stringify(testResponse.data);
                testResponse.data = null; // Clear memory
                
                const spn9Match = data.match(/updprc\('spn9','([\d,]+\.?\d*)'\)/);
                
                testResult = {
                    url: testUrl,
                    spn9_found: spn9Match ? spn9Match[1] : null,
                    data_preview: data.substring(0, 500)
                };
            } catch (e) {
                testResult = { error: e.message };
            }
        }
        
        const mem = process.memoryUsage();
        
        res.json({
            success: true,
            extracted_params: match ? { prefix: match[1], hash: match[2] } : null,
            test_result: testResult,
            cached_ajax_url: cachedAjaxUrl,
            cached_gold_data: cachedGoldData,
            auto_fetch_active: autoFetchInterval !== null,
            heartbeat_active: heartbeatInterval !== null,
            memory: {
                heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
                heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB'
            }
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

app.get('/', (req, res) => {
    const mem = process.memoryUsage();
    res.json({
        status: 'online',
        service: 'Gold Price Scraper',
        version: '3.0.0',
        uptime: Math.round(process.uptime()) + ' seconds',
        memory: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
        cached_url: cachedAjaxUrl || 'No',
        last_url_fetch: lastUrlFetch ? new Date(lastUrlFetch).toISOString() : 'Never',
        last_gold_fetch: lastGoldFetch ? new Date(lastGoldFetch).toISOString() : 'Never',
        cached_data: cachedGoldData ? cachedGoldData.spn9 : null,
        fetch_interval: '15 seconds',
        heartbeat_interval: '10 minutes',
        auto_fetch_active: autoFetchInterval !== null,
        heartbeat_active: heartbeatInterval !== null
    });
});

// Start intervals
let autoFetchInterval = null;
let heartbeatInterval = null;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Gold Price Server v3.0.0 running on port ${PORT}`);
    console.log('⚙️ Configuration:');
    console.log('   - Fetch Interval: 15 seconds');
    console.log('   - URL Cache: 5 seconds');
    console.log('   - Max Cache Age: 60 seconds');
    console.log('   - Heartbeat: Every 10 minutes');
    
    // Do initial fetch immediately
    console.log('📡 Performing initial fetch...');
    autoFetchGoldPrice().then(() => {
        console.log('✅ Initial fetch complete');
    });
    
    // Set up auto-fetch every 15 seconds
    autoFetchInterval = setInterval(() => {
        console.log('⏰ Auto-fetch timer triggered...');
        autoFetchGoldPrice();
    }, FETCH_INTERVAL);
    
    // Set up heartbeat every 10 minutes (keeps Render alive)
    heartbeatInterval = setInterval(() => {
        heartbeat();
        selfPing();
    }, 600000); // 10 minutes
    
    // Memory cleanup every 5 minutes
    setInterval(() => {
        clearMemoryCache();
    }, 300000); // 5 minutes
    
    console.log('✅ All intervals configured');
    console.log('💚 Service ready for long-term operation');
});

// Keep the process alive and handle errors gracefully
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
    // Don't exit, keep running
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
    // Don't exit, keep running
});

process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received. Cleaning up...');
    if (autoFetchInterval) clearInterval(autoFetchInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('👋 SIGINT received. Cleaning up...');
    if (autoFetchInterval) clearInterval(autoFetchInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    process.exit(0);
});

console.log('🛡️ Error handlers configured');
