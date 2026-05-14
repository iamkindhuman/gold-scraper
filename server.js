import express from "express";
import cors from "cors";
import { chromium } from "playwright";
import { execSync } from "child_process";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// --------------------
// CACHE
// --------------------
let cache = {
  spn9: null,
  updated: null,
  success: false,
  error: null
};

let isScraping = false;
const CACHE_TTL = 60 * 1000;

// --------------------
// FORCE PLAYWRIGHT BROWSER INSTALL (SAFE)
// --------------------
try {
  console.log("Checking Playwright browsers...");
  execSync("npx playwright install chromium", {
    stdio: "inherit"
  });
  console.log("Playwright browser ready");
} catch (err) {
  console.log("Playwright install skipped/failed but continuing...");
}

// --------------------
// SCRAPER
// --------------------
async function scrape() {
  if (isScraping) {
    console.log("SKIP: already scraping");
    return cache;
  }

  isScraping = true;
  let browser;

  try {
    console.log("SCRAPE START");

    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    });

    const page = await browser.newPage();

    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("__ajax2.php") &&
        res.url().includes("fn=refg4"),
      { timeout: 20000 }
    );

    await page.goto("https://msgold.com.my/", {
      waitUntil: "domcontentloaded"
    });

    const response = await responsePromise;
    const text = await response.text();

    const match = text.match(/updprc\('spn9','([^']+)'\)/);

    cache = {
      spn9: match?.[1] || null,
      updated: Date.now(),
      success: !!match,
      error: null
    };

    console.log("SUCCESS:", cache);
    return cache;

  } catch (err) {
    console.log("ERROR:", err.message);

    cache = {
      spn9: null,
      updated: Date.now(),
      success: false,
      error: err.message
    };

    return cache;

  } finally {
    isScraping = false;
    if (browser) await browser.close();
  }
}

// --------------------
// SMART CACHE LAYER
// --------------------
async function getData() {
  const now = Date.now();

  if (!cache.updated || now - cache.updated > CACHE_TTL) {
    await scrape();
  }

  return cache;
}

// --------------------
// ROUTES
// --------------------
app.get("/", (req, res) => {
  res.send("Gold Scraper Running (STABLE PLAYWRIGHT MODE)");
});

app.get("/gold", async (req, res) => {
  const data = await getData();
  res.json(data);
});

// --------------------
// START SERVER
// --------------------
app.listen(PORT, () => {
  console.log("RUNNING ON PORT:", PORT);
});
