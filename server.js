// gold_scraper.js
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

let cachedAjaxUrl = null;
let lastUrlFetch = 0;
const URL_CACHE_DURATION = 60000; // 1 minute

async function extractAjaxUrl() {
    try {
        const response = await axios.get('https://msgold.com.my/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const html = response.data;
        
        // Extract all script contents
        const $ = cheerio.load(html);
        let ajaxUrl = null;
        
        // Search in script tags
        $('script').each((i, elem) => {
            const content = $(elem).html();
            if (content) {
                // Look for AJAX URL patterns
                const matches = content.match(/__ajax2\.php\?[^"'\s]+/g);
                if (matches) {
                    ajaxUrl = matches[matches.length - 1];
                }
            }
        });
        
        // Also search in the entire HTML
        if (!ajaxUrl) {
            const matches = html.match(/adminxsettings\/__ajax2\.php\?[^"'\s]+/g);
            if (matches) {
                ajaxUrl = matches[matches.length - 1];
            }
        }
        
        return ajaxUrl;
    } catch (error) {
        console.error('Error extracting URL:', error);
        return null;
    }
}

async function fetchGoldData(ajaxPath) {
    try {
        const url = `https://msgold.com.my/${ajaxPath}`;
        const response = await axios.get(url, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://msgold.com.my/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        return response.data;
    } catch (error) {
        console.error('Error fetching gold data:', error);
        return null;
    }
}

app.get('/gold', async (req, res) => {
    try {
        // Check if we need to refresh the AJAX URL
        const now = Date.now();
        if (!cachedAjaxUrl || (now - lastUrlFetch) > URL_CACHE_DURATION) {
            cachedAjaxUrl = await extractAjaxUrl();
            lastUrlFetch = now;
        }
        
        if (!cachedAjaxUrl) {
            return res.json({ success: false, error: 'Could not extract AJAX URL' });
        }
        
        const data = await fetchGoldData(cachedAjaxUrl);
        
        if (data) {
            // Try to parse and structure the data
            let spn9 = null;
            
            // If the response is JSON
            if (typeof data === 'object') {
                // Extract spn9 or relevant values based on actual response structure
                spn9 = data.spn9 || data.price || null;
            } 
            // If it's a string with numbers
            else if (typeof data === 'string') {
                const matches = data.match(/\d+\.?\d*/g);
                if (matches && matches.length > 0) {
                    spn9 = parseFloat(matches[0]);
                }
            }
            
            res.json({
                success: true,
                spn9: spn9 || data,
                updated: new Date().toISOString(),
                source_url: cachedAjaxUrl
            });
        } else {
            res.json({ success: false, error: 'Failed to fetch data' });
        }
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Gold price server running on port ${PORT}`);
});
