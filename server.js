const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
    origin: '*',
    methods: ['GET']
}));

// Cache management
let cachedAjaxUrl = null;
let lastUrlFetch = 0;
const URL_CACHE_DURATION = 60000; // 1 minute
let cachedGoldData = null;
let lastGoldFetch = 0;
const GOLD_CACHE_DURATION = 3000; // 3 seconds

// Multiple known working URL patterns
const KNOWN_PATTERNS = [
    'adminxsettings/__ajax2.php?fn=refg4&m=eval&f=&q=',
    '__ajax2.php?fn=refg4&m=eval&f=&q=',
    'ajax/gold_price.php',
    'api/gold',
    'live/gold-price'
];

async function extractAjaxUrl() {
    try {
        console.log('Attempting to fetch main page...');
        
        const response = await axios.get('https://msgold.com.my/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            },
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            }
        });
        
        const html = response.data;
        console.log('Page fetched successfully, size:', html.length, 'bytes');
        
        // Save HTML for debugging (first 2000 chars)
        const debugHtml = html.substring(0, 2000);
        console.log('HTML preview:', debugHtml);
        
        let ajaxUrl = null;
        
        // Method 1: Look for __ajax2.php with full path
        const patterns = [
            /adminxsettings\/__ajax2\.php\?[^"'\s<>]+/g,
            /__ajax2\.php\?[^"'\s<>]+/g,
            /["']([^"']*__ajax2\.php[^"']*)["']/g,
            /ajaxurl\s*=\s*["']([^"']+)["']/g,
            /url:\s*["']([^"']*ajax[^"']*)["']/g
        ];
        
        for (let pattern of patterns) {
            const matches = html.match(pattern);
            if (matches && matches.length > 0) {
                console.log(`Pattern matched: ${pattern}`);
                console.log('Matches found:', matches);
                
                // Get the last match (most likely current)
                let url = matches[matches.length - 1];
                // Clean up quotes
                url = url.replace(/["']/g, '');
                // Remove any prefix like 'url:' or 'ajaxurl='
                url = url.replace(/^(?:url|ajaxurl):\s*['"]?/, '');
                
                if (url.includes('__ajax2.php') || url.includes('ajax')) {
                    // Ensure it has the adminxsettings prefix if needed
                    if (!url.startsWith('adminxsettings/') && !url.startsWith('/')) {
                        url = 'adminxsettings/' + url;
                    }
                    ajaxUrl = url;
                    console.log('Found AJAX URL:', ajaxUrl);
                    break;
                }
            }
        }
        
        // Method 2: Look for eval or function calls that construct the URL
        if (!ajaxUrl) {
            const evalPatterns = [
                /fn=refg4[^"'\s<>]*/g,
                /refg4[^"'\s<>]*/g,
                /__ajax2[^"'\s<>]*/g
            ];
            
            for (let pattern of evalPatterns) {
                const matches = html.match(pattern);
                if (matches) {
                    console.log('Eval pattern matched:', matches);
                }
            }
        }
        
        // Method 3: Search in script tags specifically
        if (!ajaxUrl) {
            const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
            let scriptMatch;
            while ((scriptMatch = scriptRegex.exec(html)) !== null) {
                const scriptContent = scriptMatch[1];
                if (scriptContent.includes('ajax') || scriptContent.includes('refg4')) {
                    console.log('Found relevant script:', scriptContent.substring(0, 500));
                    
                    const urlMatch = scriptContent.match(/["']([^"']*ajax[^"']*)["']/);
                    if (urlMatch) {
                        ajaxUrl = urlMatch[1];
                        break;
                    }
                }
            }
        }
        
        return ajaxUrl;
        
    } catch (error) {
        console.error('Error fetching main page:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        }
        return null;
    }
}

// Alternative: Try to construct the URL with current timestamp
function generatePossibleUrl() {
    const timestamp = Math.floor(Date.now() / 1000);
    const random = Math.random().toString(36).substring(7);
    const seed = Math.random();
    
    // Based on your example: 794_1778739259_c7345ad4580290c2971b1a5b43b0db0a
    return `adminxsettings/__ajax2.php?fn=refg4&m=eval&f=&q=794_${timestamp}_${random}&seed=${seed}`;
}

// Try to fetch gold data from multiple possible URLs
async function tryMultipleUrls() {
    const urlsToTry = [];
    
    // Add cached URL if exists
    if (cachedAjaxUrl) {
        urlsToTry.push(cachedAjaxUrl);
    }
    
    // Add generated URL
    urlsToTry.push(generatePossibleUrl());
    
    // Add common patterns
    for (let pattern of KNOWN_PATTERNS) {
        const timestamp = Math.floor(Date.now() / 1000);
        const random = Math.random().toString(36).substring(7);
        urlsToTry.push(`${pattern}${timestamp}_${random}&seed=${Math.random()}`);
    }
    
    for (let url of urlsToTry) {
        try {
            console.log('Trying URL:', url);
            const fullUrl = `https://msgold.com.my/${url}`;
            
            const response = await axios.get(fullUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://msgold.com.my/',
                    'Cache-Control': 'no-cache'
                },
                timeout: 10000,
                validateStatus: function (status) {
                    return status === 200; // Only accept 200
                }
            });
            
            if (response.data && response.data !== '') {
                console.log('Success with URL:', url);
                console.log('Response data type:', typeof response.data);
                console.log('Response preview:', JSON.stringify(response.data).substring(0, 200));
                
                // Cache the working URL
                cachedAjaxUrl = url;
                lastUrlFetch = Date.now();
                
                return response.data;
            }
        } catch (error) {
            console.log(`Failed with URL ${url}:`, error.message);
        }
    }
    
    return null;
}

function parseGoldData(rawData) {
    console.log('Parsing data type:', typeof rawData);
    
    let spn9 = null;
    
    // If it's an object
    if (typeof rawData === 'object' && rawData !== null) {
        // Check common property names
        for (let key of ['spn9', 'price', 'value', 'gold_price', 'harga', 'kadar']) {
            if (rawData[key] !== undefined) {
                spn9 = parseFloat(rawData[key]);
                if (!isNaN(spn9) && spn9 > 100) {
                    console.log(`Found spn9 in object.${key}:`, spn9);
                    return spn9;
                }
            }
        }
        
        // Search through all properties
        for (let key in rawData) {
            if (typeof rawData[key] === 'number' && rawData[key] > 100) {
                spn9 = rawData[key];
                console.log(`Found number in object.${key}:`, spn9);
                break;
            }
            if (typeof rawData[key] === 'string') {
                const num = parseFloat(rawData[key]);
                if (!isNaN(num) && num > 100) {
                    spn9 = num;
                    console.log(`Found string-number in object.${key}:`, spn9);
                    break;
                }
            }
        }
    }
    
    // If it's a string
    if (typeof rawData === 'string') {
        // Try to parse as JSON
        try {
            const parsed = JSON.parse(rawData);
            return parseGoldData(parsed);
        } catch (e) {
            // Not JSON, extract numbers
        }
        
        // Look for numbers that could be gold prices (usually between 200-500)
        const numbers = rawData.match(/\d+\.?\d*/g);
        if (numbers) {
            console.log('Found numbers in string:', numbers);
            for (let num of numbers) {
                const val = parseFloat(num);
                if (val > 200 && val < 600) {
                    spn9 = val;
                    console.log('Found gold price in string:', spn9);
                    break;
                }
            }
            // If no price in range, take the largest number
            if (!spn9 && numbers.length > 0) {
                const nums = numbers.map(n => parseFloat(n)).filter(n => n > 100);
                if (nums.length > 0) {
                    spn9 = Math.max(...nums);
                    console.log('Taking largest number as gold price:', spn9);
                }
            }
        }
    }
    
    return spn9;
}

// Main endpoint
app.get('/gold', async (req, res) => {
    try {
        const now = Date.now();
        
        // Return cached data if fresh enough
        if (cachedGoldData && (now - lastGoldFetch) < GOLD_CACHE_DURATION) {
            console.log('Returning cached gold data');
            return res.json(cachedGoldData);
        }
        
        // Try to get AJAX URL first
        let rawData = null;
        
        if (cachedAjaxUrl && (now - lastUrlFetch) < URL_CACHE_DURATION) {
            // Use cached URL
            try {
                const fullUrl = `https://msgold.com.my/${cachedAjaxUrl}`;
                console.log('Using cached URL:', fullUrl);
                const response = await axios.get(fullUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Referer': 'https://msgold.com.my/'
                    },
                    timeout: 10000
                });
                rawData = response.data;
            } catch (error) {
                console.log('Cached URL failed, will try alternatives');
                cachedAjaxUrl = null; // Invalidate cache
            }
        }
        
        // If no data yet, try to extract new URL
        if (!rawData) {
            const newUrl = await extractAjaxUrl();
            if (newUrl) {
                cachedAjaxUrl = newUrl;
                lastUrlFetch = Date.now();
                console.log('New AJAX URL:', newUrl);
                
                try {
                    const fullUrl = `https://msgold.com.my/${newUrl}`;
                    const response = await axios.get(fullUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Referer': 'https://msgold.com.my/'
                        },
                        timeout: 10000
                    });
                    rawData = response.data;
                } catch (error) {
                    console.log('New URL failed:', error.message);
                }
            }
        }
        
        // If still no data, try multiple URLs
        if (!rawData) {
            console.log('Trying multiple URLs...');
            rawData = await tryMultipleUrls();
        }
        
        if (!rawData) {
            return res.json({
                success: false,
                error: 'Could not fetch gold data from any source',
                debug: {
                    cached_url: cachedAjaxUrl,
                    last_url_fetch: lastUrlFetch ? new Date(lastUrlFetch).toISOString() : null
                }
            });
        }
        
        const spn9 = parseGoldData(rawData);
        
        if (!spn9) {
            return res.json({
                success: false,
                error: 'Could not parse gold price from data',
                raw_data_preview: JSON.stringify(rawData).substring(0, 500)
            });
        }
        
        const responseData = {
            success: true,
            spn9: spn9,
            updated: new Date().toISOString(),
            timestamp: now
        };
        
        cachedGoldData = responseData;
        lastGoldFetch = now;
        
        console.log('Success! Gold price:', spn9);
        res.json(responseData);
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug endpoint to see what's happening
app.get('/debug', async (req, res) => {
    try {
        console.log('Debug: Fetching main page...');
        const response = await axios.get('https://msgold.com.my/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 30000
        });
        
        const html = response.data;
        
        // Search for various patterns
        const ajaxPatterns = html.match(/ajax[^"'\s<>]{0,50}/gi) || [];
        const scriptContent = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
        
        // Find scripts containing gold/price/ajax
        const relevantScripts = scriptContent.filter(s => 
            s.toLowerCase().includes('gold') || 
            s.toLowerCase().includes('price') || 
            s.toLowerCase().includes('ajax') ||
            s.toLowerCase().includes('refg4')
        );
        
        res.json({
            success: true,
            page_size: html.length,
            ajax_references: ajaxPatterns.slice(0, 20),
            relevant_scripts_count: relevantScripts.length,
            script_preview: relevantScripts.slice(0, 3).map(s => s.substring(0, 500)),
            html_preview: html.substring(0, 2000),
            cached_ajax_url: cachedAjaxUrl
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Gold Price Scraper',
        version: '1.0.0',
        uptime: process.uptime(),
        cached_url: cachedAjaxUrl || 'No',
        last_url_fetch: lastUrlFetch ? new Date(lastUrlFetch).toISOString() : 'Never',
        last_successful_fetch: lastGoldFetch ? new Date(lastGoldFetch).toISOString() : 'Never'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Attempting initial URL extraction...');
    
    // Initial attempt with delay to ensure network is ready
    setTimeout(async () => {
        const url = await extractAjaxUrl();
        if (url) {
            cachedAjaxUrl = url;
            lastUrlFetch = Date.now();
            console.log('Initial URL cached:', url);
        } else {
            console.log('Initial URL extraction failed, will retry on first request');
        }
    }, 5000);
});
