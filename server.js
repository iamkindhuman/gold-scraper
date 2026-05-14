import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());

let cache = {
  spn9: null,
  updated: null,
  success: false,
  error: null
};

let isScraping = false;

/**
 * SAFE SCRAPER (ROBUST + DEBUG + FALLBACK)
 */
async function scrape() {
  if (isScraping) return;
  isScraping = true;

  try {
    console.log("SCRAPE START (FINAL MODE)");

    const url =
      "https://msgold.com.my/adminxsettings/__ajax2.php?fn=refg4&m=eval&f=&q=3825_1778727686_05a216ba187c04e146501316fdc220b3&seed=" +
      Date.now();

    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://msgold.com.my/"
      },
      timeout: 15000
    });

    const text = res.data;

    // =========================
    // PRIMARY PATTERN
    // =========================
    let match =
      text.match(/updprc\('spn9','([^']+)'\)/) ||

      // fallback (in case API format changed slightly)
      text.match(/spn9['"]?\s*,\s*['"]([^'"]+)['"]/) ||

      text.match(/'spn9'.*?([0-9]+\.[0-9]+)/);

    if (!match) {
      console.log("RAW RESPONSE (DEBUG):");
      console.log(text.slice(0, 500)); // IMPORTANT DEBUG

      throw new Error("Pattern not found (API changed or blocked)");
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

    // ❗ NEVER DELETE GOOD DATA
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
 * API (NO SCRAPING HERE)
 */
app.get("/gold", (req, res) => {
  res.json(cache);
});

app.get("/refresh", async (req, res) => {
  await scrape();
  res.json(cache);
});

app.get("/", (req, res) => {
  res.send("Gold Scraper Running (FINAL STABLE MODE)");
});

/**
 * INITIAL + LOOP
 */
scrape();

// safer interval (NOT too aggressive for Render)
setInterval(() => {
  scrape().catch(() => {});
}, 45000); // 45 seconds

/**
 * START SERVER
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("RUNNING ON PORT:", PORT);
});
