const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
    origin: '*',
    methods: ['GET']
}));

let cachedAjaxUrl = null;
let lastUrlFetch = 0;
const URL_CACHE_DURATION = 3000;
let cachedGoldData = null;
let lastGoldFetch = 0;
const GOLD_CACHE_DURATION = 2000;

// Known hash from the website
const AJAX_HASH = 'c7345ad4580290c2971b1a5b43b0db0a';

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
        
        return response.data;
        
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

// Auto-fetch function that runs every 10 seconds
async function autoFetchGoldPrice() {
    try {
        const now = Date.now();
        
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
            }
        }
        
        // Fetch with current URL
        if (cachedAjaxUrl) {
            const rawData = await fetchGoldData(cachedAjaxUrl);
            
            if (rawData) {
                const spn9 = parseGoldData(rawData);
                
                if (spn9) {
                    // Update cached data
                    cachedGoldData = {
                        success: true,
                        spn9: spn9,
                        updated: new Date().toISOString(),
                        timestamp: Date.now()
                    };
                    lastGoldFetch = Date.now();
                    console.log('✅ Auto-fetched gold price (spn9):', spn9);
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
        
    } catch (error) {
        console.error('Auto-fetch error:', error.message);
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

app.get('/debug', async (req, res) => {
    try {
        const response = await axios.get('https://msgold.com.my/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });
        
        const html = response.data;
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
        
        res.json({
            success: true,
            extracted_params: match ? { prefix: match[1], hash: match[2] } : null,
            test_result: testResult,
            cached_ajax_url: cachedAjaxUrl,
            cached_gold_data: cachedGoldData,
            auto_fetch_active: autoFetchInterval !== null
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Gold Price Scraper',
        version: '2.0.0',
        uptime: process.uptime(),
        cached_url: cachedAjaxUrl || 'No',
        last_url_fetch: lastUrlFetch ? new Date(lastUrlFetch).toISOString() : 'Never',
        last_gold_fetch: lastGoldFetch ? new Date(lastGoldFetch).toISOString() : 'Never',
        cached_data: cachedGoldData ? cachedGoldData.spn9 : null,
        auto_refresh_interval: '10 seconds',
        auto_fetch_active: autoFetchInterval !== null
    });
});

// Start the auto-fetch interval
let autoFetchInterval = null;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gold Price Server v2.0.0 running on port ${PORT}`);
    console.log('Auto-refresh: Every 10 seconds');
    
    // Do initial fetch immediately
    console.log('Performing initial fetch...');
    autoFetchGoldPrice().then(() => {
        console.log('Initial fetch complete');
    });
    
    // Set up auto-fetch every 10 seconds
    autoFetchInterval = setInterval(() => {
        console.log('⏰ Auto-fetch timer triggered...');
        autoFetchGoldPrice();
    }, 10000); // 10 seconds
    
    console.log('Auto-fetch interval set to 10 seconds');
});

// Keep the process alive
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
