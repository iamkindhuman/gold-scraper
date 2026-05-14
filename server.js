const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Enable CORS
app.use(cors({
    origin: '*',
    methods: ['GET']
}));

// Cache management
let cachedAjaxUrl = null;
let lastUrlFetch = 0;
const URL_CACHE_DURATION = 3000; // 3 seconds cache (matches the 4-second refresh on site)
let cachedGoldData = null;
let lastGoldFetch = 0;
const GOLD_CACHE_DURATION = 2000; // 2 seconds

// We need to get the correct prefix from the page
let urlPrefix = '794'; // Default fallback

// Function to extract the AJAX URL parameters from the page
async function extractAjaxParams() {
    try {
        console.log('Extracting AJAX parameters...');
        
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
        
        // Look for the refg() function to extract parameters
        const refgMatch = html.match(/ajax\("refg4","(\d+)_"[+]s\+"_([a-f0-9]+)"\)/);
        
        if (refgMatch) {
            const prefix = refgMatch[1]; // e.g., "3581" or "794"
            const hash = refgMatch[2];   // e.g., "c7345ad4580290c2971b1a5b43b0db0a"
            
            console.log('Found AJAX parameters - Prefix:', prefix, 'Hash:', hash);
            
            return { prefix, hash };
        }
        
        // Alternative pattern
        const altMatch = html.match(/refg4","(\d+)_"[+]s\+"_([^"]+)"/);
        if (altMatch) {
            console.log('Found AJAX parameters (alt) - Prefix:', altMatch[1], 'Hash:', altMatch[2]);
            return { prefix: altMatch[1], hash: altMatch[2] };
        }
        
        console.log('Could not extract parameters, using defaults');
        return null;
        
    } catch (error) {
        console.error('Error extracting AJAX params:', error.message);
        return null;
    }
}

// Function to generate a current AJAX URL
function generateAjaxUrl(prefix, hash) {
    const timestamp = Math.floor(Date.now() / 1000);
    const seed = Math.random();
    const q = `${prefix}_${timestamp}_${hash}`;
    
    return `adminxsettings/__ajax2.php?fn=refg4&m=eval&f=&q=${q}&seed=${seed}`;
}

// Function to fetch gold data
async function fetchGoldData(url) {
    try {
        const fullUrl = `https://msgold.com.my/${url}`;
        console.log('Fetching:', fullUrl);
        
        const response = await axios.get(fullUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://msgold.com.my/',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: 10000,
            validateStatus: function (status) {
                return status === 200;
            }
        });
        
        const data = response.data;
        console.log('Response type:', typeof data);
        console.log('Response preview:', JSON.stringify(data).substring(0, 300));
        
        // Check if it's a redirect
        if (typeof data === 'string' && data.includes('window.location')) {
            console.log('Got redirect response, URL might be expired');
            return null;
        }
        
        return data;
        
    } catch (error) {
        console.error('Fetch error:', error.message);
        return null;
    }
}

// Function to parse gold data from eval response
function parseGoldData(rawData) {
    console.log('Parsing data...');
    
    let spn9 = null;
    
    // If it's an array (common for eval responses)
    if (Array.isArray(rawData)) {
        console.log('Data is array with', rawData.length, 'items');
        
        // Look for SPAN elements with gold prices
        for (let item of rawData) {
            if (typeof item === 'string') {
                // Look for span updates like: gebi('spn9').innerHTML='XXX.XX'
                const spn9Match = item.match(/spn9[^=]*=\s*['"]?([\d.]+)/);
                if (spn9Match) {
                    spn9 = parseFloat(spn9Match[1]);
                    console.log('Found spn9 in array:', spn9);
                    break;
                }
            }
        }
    }
    
    // If it's a string
    if (typeof rawData === 'string') {
        console.log('Data is string, length:', rawData.length);
        
        // Try to parse as JSON first
        try {
            const parsed = JSON.parse(rawData);
            if (Array.isArray(parsed)) {
                return parseGoldData(parsed);
            }
            if (typeof parsed === 'object') {
                return parseGoldData(parsed);
            }
        } catch (e) {
            // Not JSON, continue with string parsing
        }
        
        // Look for spn9 value in eval code
        const spn9Match = rawData.match(/spn9[^=]*=\s*['"]?([\d.]+)/);
        if (spn9Match) {
            spn9 = parseFloat(spn9Match[1]);
            console.log('Found spn9 in string:', spn9);
        }
        
        // Look for any spn values as backup
        if (!spn9) {
            const spnMatch = rawData.match(/spn(\d+)[^=]*=\s*['"]?([\d.]+)/g);
            if (spnMatch) {
                console.log('Found SPN values:', spnMatch);
                // Try to get spn9 specifically
                for (let match of spnMatch) {
                    if (match.includes('spn9')) {
                        const numMatch = match.match(/([\d.]+)/);
                        if (numMatch) {
                            spn9 = parseFloat(numMatch[1]);
                            break;
                        }
                    }
                }
            }
        }
        
        // Look for document.getElementById('spn9') patterns
        if (!spn9) {
            const docMatch = rawData.match(/getElementById\(['"]spn9['"]\)[^=]*=\s*['"]?([\d.]+)/);
            if (docMatch) {
                spn9 = parseFloat(docMatch[1]);
                console.log('Found spn9 via getElementById:', spn9);
            }
        }
    }
    
    // If it's an object
    if (typeof rawData === 'object' && rawData !== null && !Array.isArray(rawData)) {
        console.log('Data is object with keys:', Object.keys(rawData));
        
        // Check for spn9 directly
        if (rawData.spn9 !== undefined) {
            spn9 = parseFloat(rawData.spn9);
        }
        
        // Check for any property containing gold price
        if (!spn9) {
            for (let key in rawData) {
                const val = parseFloat(rawData[key]);
                if (!isNaN(val) && val > 200 && val < 600) {
                    spn9 = val;
                    console.log('Found gold price in object.' + key + ':', spn9);
                    break;
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
        
        // Get AJAX parameters if we don't have them or they're old
        let params = null;
        if (!cachedAjaxUrl || (now - lastUrlFetch) > URL_CACHE_DURATION) {
            const extractedParams = await extractAjaxParams();
            if (extractedParams) {
                params = extractedParams;
                urlPrefix = params.prefix;
                cachedAjaxUrl = generateAjaxUrl(params.prefix, params.hash);
                lastUrlFetch = now;
                console.log('Generated new AJAX URL:', cachedAjaxUrl);
            }
        }
        
        // If we still don't have a URL, generate one with defaults
        if (!cachedAjaxUrl) {
            // Use the hash we know from debug
            const hash = 'c7345ad4580290c2971b1a5b43b0db0a';
            cachedAjaxUrl = generateAjaxUrl(urlPrefix, hash);
            lastUrlFetch = now;
            console.log('Using fallback AJAX URL:', cachedAjaxUrl);
        }
        
        // Fetch gold data
        let rawData = await fetchGoldData(cachedAjaxUrl);
        
        // If first attempt fails, try with fresh URL
        if (!rawData) {
            console.log('First attempt failed, trying with fresh URL...');
            const extractedParams = await extractAjaxParams();
            if (extractedParams) {
                cachedAjaxUrl = generateAjaxUrl(extractedParams.prefix, extractedParams.hash);
                lastUrlFetch = now;
                console.log('Retrying with new URL:', cachedAjaxUrl);
                rawData = await fetchGoldData(cachedAjaxUrl);
            }
        }
        
        if (!rawData) {
            return res.json({
                success: false,
                error: 'Could not fetch gold data from source',
                debug_url: cachedAjaxUrl
            });
        }
        
        // Parse the data
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
            timestamp: now,
            source_url: cachedAjaxUrl
        };
        
        cachedGoldData = responseData;
        lastGoldFetch = now;
        
        console.log('Success! Gold price (spn9):', spn9);
        res.json(responseData);
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug endpoint
app.get('/debug', async (req, res) => {
    try {
        const response = await axios.get('https://msgold.com.my/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });
        
        const html = response.data;
        
        // Extract the exact AJAX call pattern
        const refgMatch = html.match(/ajax\("refg4","(\d+)_"[+]s\+"_([^"]+)"\)/);
        
        // Generate a test URL
        let testUrl = null;
        if (refgMatch) {
            const timestamp = Math.floor(Date.now() / 1000);
            const prefix = refgMatch[1];
            const hash = refgMatch[2];
            testUrl = `adminxsettings/__ajax2.php?fn=refg4&m=eval&f=&q=${prefix}_${timestamp}_${hash}&seed=${Math.random()}`;
        }
        
        // Try to fetch with test URL
        let testResponse = null;
        if (testUrl) {
            try {
                const testResult = await axios.get(`https://msgold.com.my/${testUrl}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Referer': 'https://msgold.com.my/'
                    },
                    timeout: 10000
                });
                testResponse = {
                    status: testResult.status,
                    data_type: typeof testResult.data,
                    data_preview: JSON.stringify(testResult.data).substring(0, 500)
                };
            } catch (e) {
                testResponse = { error: e.message };
            }
        }
        
        res.json({
            success: true,
            extracted_params: refgMatch ? { prefix: refgMatch[1], hash: refgMatch[2] } : null,
            test_url: testUrl,
            test_response: testResponse,
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
        version: '1.1.0',
        uptime: process.uptime(),
        cached_url: cachedAjaxUrl || 'No',
        url_prefix: urlPrefix,
        last_url_fetch: lastUrlFetch ? new Date(lastUrlFetch).toISOString() : 'Never',
        last_gold_fetch: lastGoldFetch ? new Date(lastGoldFetch).toISOString() : 'Never'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gold Price Server v1.1.0 running on port ${PORT}`);
    
    // Initial parameter extraction
    setTimeout(async () => {
        const params = await extractAjaxParams();
        if (params) {
            urlPrefix = params.prefix;
            cachedAjaxUrl = generateAjaxUrl(params.prefix, params.hash);
            lastUrlFetch = Date.now();
            console.log('Initial URL cached:', cachedAjaxUrl);
        }
    }, 3000);
});
