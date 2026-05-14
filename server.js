import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());

/**
 * =========================
 * GLOBAL CACHE (ONLY SOURCE OF TRUTH)
 * =========================
 */
let cache = {
  spn9: null,
  updated: null,
  success: false,
  error: null
};

/**
 * =========================
 * LOCK (PREVENT DOUBLE SCRAPE)
 * =========================
 */
let isScraping = false;

/**
 * =========================
 * SAFE SCRAPER (NO INTERVAL CHAOS)
 * =========================
 */
async function scrape() {
  if (isScraping) return; // 🚫 prevent overlapping runs
  isScraping = true;

  try {
    console.log("SCRAPE START (SAFE MODE)");

    const url =
      "https://msgold.com.my/adminxsettings/__ajax2.php?fn=refg4&m=eval&f=&q=3825_1778727686_05a216ba187c04e146501316fdc220b3&seed=" +
      Date.now(); // IMPORTANT: stable seed, not Math.random

    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://msgold.com.my/"
      },
      timeout: 10000
    });

    const text = res.data;

    const match = text.match(/updprc\('spn9','([^']+)'\)/);

    if (!match) {
      throw new Error("Pattern not found");
    }

    cache = {
      spn9: match[1],
      updated: new Date().toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur"
      }),
      success: true,
      error: null
    };

    console.log("SUCCESS:", cache);
  } catch (err) {
    console.log("ERROR:", err.message);

    // ❗ DO NOT wipe good cache on failure
    cache = {
      ...cache,
      success: false,
      error: err.message
    };
  } finally {
    isScraping = false;
  }
}

/**
 * =========================
 * API
 * =========================
 */

// ALWAYS return cached value (NO scraping here)
app.get("/gold", (req, res) => {
  res.json(cache);
});

// manual refresh endpoint (optional)
app.get("/refresh", async (req, res) => {
  await scrape();
  res.json(cache);
});

app.get("/", (req, res) => {
  res.send("Gold Scraper Running (STABLE MODE)");
});

/**
 * =========================
 * BACKGROUND LOOP (SAFE)
 * =========================
 */

// first run immediately
scrape();

// then loop safely every 30s (NOT 10s, too aggressive for Render)
setInterval(() => {
  scrape().catch(() => {});
}, 30000);

/**
 * =========================
 * SERVER START
 * =========================
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("RUNNING ON PORT:", PORT);
});
