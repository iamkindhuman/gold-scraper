const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Enable CORS for your InfinityFree domain
app.use(cors({
    origin: '*', // Allow all origins (you can restrict to your InfinityFree domain)
    methods: ['GET'],
    credentials: true
}));

// Cache management
let cachedAjaxUrl = null;
let lastUrlFetch = 0;
const URL_CACHE_DURATION = 30000; // 30 seconds cache for AJAX URL
let cachedGoldData = null;
let lastGoldFetch = 0;
const GOLD_CACHE_DURATION = 3000; // 3 seconds cache for gold data

// Function to extract the dynamic AJAX URL from msgold.com.my
async function extractAjaxUrl() {
    try {
        console.log('Fetching main page to extract AJAX URL...');
        
        const response = await axios.get('https://msgold.com.my/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache'
            },
            timeout: 15000
        });
        
        const html = response.data;
        
        // Search for the AJAX URL pattern
        let ajaxUrl = null;
        
        // Pattern 1: Look for __ajax2.php with parameters
        const pattern1 = /adminxsettings\/__ajax2\.php\?fn=refg4[^"'\s<>]+/g;
        const matches1 = html.match(pattern1);
        
        if (matches1 && matches1.length > 0) {
            ajaxUrl = matches1[matches1.length - 1];
            console.log('Found AJAX URL (pattern 1):', ajaxUrl);
        }
        
        // Pattern 2: Look for any __ajax2.php reference
        if (!ajaxUrl) {
            const pattern2 = /__ajax2\.php\?[^"'\s<>]+/g;
            const matches2 = html.match(pattern2);
            
            if (matches2 && matches2.length > 0) {
                ajaxUrl = 'adminxsettings/' + matches2[matches2.length - 1];
                console.log('Found AJAX URL (pattern 2):', ajaxUrl);
            }
        }
        
        // Pattern 3: Look in script tags for dynamic URL construction
        if (!ajaxUrl) {
            const scriptPattern = /["']([^"']*__ajax2\.php\?[^"']*)["']/g;
            const matches3 = html.match(scriptPattern);
            
            if (matches3 && matches3.length > 0) {
                ajaxUrl = matches3[matches3.length - 1].replace(/["']/g, '');
                console.log('Found AJAX URL (pattern 3):', ajaxUrl);
            }
        }
        
        return ajaxUrl;
        
    } catch (error) {
        console.error('Error extracting AJAX URL:', error.message);
        return null;
    }
}

// Function to fetch gold data using the dynamic URL
async function fetchGoldData(ajaxPath) {
    try {
        const url = `https://msgold.com.my/${ajaxPath}`;
        console.log('Fetching gold data from:', url);
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://msgold.com.my/',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: 10000
        });
        
        return response.data;
        
    } catch (error) {
        console.error('Error fetching gold data:', error.message);
        return null;
    }
}

// Function to parse gold data
function parseGoldData(rawData) {
    let spn9 = null;
    
    // If it's already an object with spn9
    if (typeof rawData === 'object' && rawData !== null) {
        spn9 = rawData.spn9 || rawData.price || rawData.value;
        if (spn9) return parseFloat(spn9);
        
        // Search through object values
        for (let key in rawData) {
            if (typeof rawData[key] === 'number' && rawData[key] > 100) {
                spn9 = rawData[key];
                break;
            }
            if (typeof rawData[key] === 'string' && !isNaN(rawData[key]) && parseFloat(rawData[key]) > 100) {
                spn9 = parseFloat(rawData[key]);
                break;
            }
        }
    }
    
    // If it's a string, try to parse JSON first
    if (typeof rawData === 'string') {
        try {
            const parsed = JSON.parse(rawData);
            return parseGoldData(parsed);
        } catch (e) {
            // Not JSON, extract numbers
        }
        
        // Extract all numbers
        const numbers = rawData.match(/\d+\.?\d*/g);
        if (numbers && numbers.length > 0) {
            // Find a reasonable gold price (usually > 100)
            for (let num of numbers) {
                const val = parseFloat(num);
                if (val > 100 && val < 10000) {
                    spn9 = val;
                    break;
                }
            }
            // If no reasonable price found, take the first number
            if (!spn9 && numbers.length > 0) {
                spn9 = parseFloat(numbers[0]);
            }
        }
    }
    
    return spn9;
}

// Main endpoint
app.get('/gold', async (req, res) => {
    try {
        const now = Date.now();
        
        // Check gold data cache first (3 seconds)
        if (cachedGoldData && (now - lastGoldFetch) < GOLD_CACHE_DURATION) {
            console.log('Returning cached gold data');
            return res.json(cachedGoldData);
        }
        
        // Check if we need to refresh the AJAX URL
        if (!cachedAjaxUrl || (now - lastUrlFetch) > URL_CACHE_DURATION) {
            console.log('Refreshing AJAX URL...');
            const newUrl = await extractAjaxUrl();
            
            if (newUrl) {
                cachedAjaxUrl = newUrl;
                lastUrlFetch = now;
                console.log('AJAX URL updated:', cachedAjaxUrl);
            } else if (!cachedAjaxUrl) {
                // No cached URL and couldn't get new one
                return res.json({
                    success: false,
                    error: 'Could not extract AJAX URL from msgold.com.my'
                });
            }
            // If we have old cached URL but failed to get new one, continue with old URL
        }
        
        // Fetch gold data
        const rawData = await fetchGoldData(cachedAjaxUrl);
        
        if (!rawData) {
            return res.json({
                success: false,
                error: 'Failed to fetch gold data from source'
            });
        }
        
        // Parse the data
        const spn9 = parseGoldData(rawData);
        
        if (!spn9) {
            return res.json({
                success: false,
                error: 'Could not extract gold price from data',
                raw_data: typeof rawData === 'string' ? rawData.substring(0, 200) : JSON.stringify(rawData).substring(0, 200)
            });
        }
        
        // Create response
        const responseData = {
            success: true,
            spn9: spn9,
            updated: new Date().toISOString(),
            timestamp: now,
            source: 'msgold.com.my'
        };
        
        // Cache the response
        cachedGoldData = responseData;
        lastGoldFetch = now;
        
        console.log('Gold price:', spn9);
        res.json(responseData);
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error: ' + error.message
        });
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Gold Price Scraper',
        version: '1.0.0',
        uptime: process.uptime(),
        cached_url: cachedAjaxUrl ? 'Yes' : 'No',
        last_url_fetch: lastUrlFetch ? new Date(lastUrlFetch).toISOString() : 'Never'
    });
});

// Debug endpoint
app.get('/debug', (req, res) => {
    res.json({
        cachedAjaxUrl: cachedAjaxUrl,
        lastUrlFetch: lastUrlFetch ? new Date(lastUrlFetch).toISOString() : null,
        lastGoldFetch: lastGoldFetch ? new Date(lastGoldFetch).toISOString() : null,
        cacheStatus: {
            urlCacheMs: URL_CACHE_DURATION,
            goldCacheMs: GOLD_CACHE_DURATION,
            urlCacheAge: cachedAjaxUrl ? Date.now() - lastUrlFetch : null,
            goldCacheAge: cachedGoldData ? Date.now() - lastGoldFetch : null
        }
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gold Price Server running on port ${PORT}`);
    console.log(`CORS enabled for all origins`);
    console.log(`URL cache duration: ${URL_CACHE_DURATION}ms`);
    console.log(`Gold data cache duration: ${GOLD_CACHE_DURATION}ms`);
});

// Initial URL fetch on startup
extractAjaxUrl().then(url => {
    if (url) {
        cachedAjaxUrl = url;
        lastUrlFetch = Date.now();
        console.log('Initial AJAX URL cached:', url);
    } else {
        console.warn('Failed to get initial AJAX URL');
    }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
