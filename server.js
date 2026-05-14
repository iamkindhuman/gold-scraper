import express from "express";
import cors from "cors";
import { chromium } from "playwright";
import { execSync } from "child_process";

const app = express();
app.use(cors());

let cache = {
  spn9: null,
  updated: null,
  success: false,
  error: null
};

let browser = null;
let page = null;

/**
 * 🔥 Ensure Playwright browser exists (Render-safe fix)
 */
async function ensureBrowserInstalled() {
  try {
    execSync("npx playwright install chromium", {
      stdio: "inherit"
    });
  } catch (err) {
    console.log("Install step skipped/failed (likely already installed)");
  }
}

/**
 * 🚀 Init browser once (IMPORTANT for stability)
 */
async function initBrowser() {
  if (browser) return;

  await ensureBrowserInstalled();

  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  page = await browser.newPage();

  console.log("Browser initialized");
}

/**
 * 🔥 Core scrape logic (NO AJAX GUESSING)
 */
async function scrape() {
  try {
    await initBrowser();

    console.log("SCRAPE START");

    await page.goto("https://msgold.com.my/", {
      waitUntil: "networkidle",
      timeout: 30000
    });

    // wait until spn9 appears in DOM OR JS runtime
    await page.waitForFunction(() => {
      const el = document.querySelector("#spn9");
      return el && el.innerText && el.innerText.trim().length > 0;
    }, { timeout: 20000 });

    const spn9 = await page.$eval("#spn9", el =>
      el.innerText.trim()
    );

    cache = {
      spn9,
      updated: new Date().toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur"
      }),
      success: true,
      error: null
    };

    console.log("SUCCESS:", cache);

  } catch (err) {
    console.log("ERROR:", err.message);

    cache = {
      spn9: null,
      updated: new Date().toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur"
      }),
      success: false,
      error: err.message
    };
  }
}

/**
 * 🌐 API endpoint
 */
app.get("/gold", async (req, res) => {
  res.json(cache); // return cached instantly

  // optional background refresh (non-blocking)
  scrape().catch(() => {});
});

/**
 * 🔄 manual refresh endpoint
 */
app.get("/refresh", async (req, res) => {
  await scrape();
  res.json(cache);
});

/**
 * 🧠 health check
 */
app.get("/", (req, res) => {
  res.send("Gold Scraper Running (STABLE PLAYWRIGHT MODE)");
});

/**
 * 🔁 background refresh loop (safe for Render)
 */
setInterval(() => {
  scrape().catch(() => {});
}, 20000); // 20s safer than 10s

/**
 * 🚀 start server
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log("RUNNING ON PORT:", PORT);

  // warm up browser + first scrape
  await scrape();
});
