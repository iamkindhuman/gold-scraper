import express from "express";
import cors from "cors";
import { chromium } from "playwright";

const app = express();

app.use(cors());

let cache = {
  buy: null,
  sell: null,
  updated: null,
  success: false,
  error: null
};

async function scrape() {

  let browser;

  try {

    console.log("SCRAPING START");

    browser = await chromium.launch({
      executablePath: "/opt/render/.cache/ms-playwright/chromium-1223/chrome-linux/chrome",
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
    });

    await page.goto("https://msgold.com.my/", {
      waitUntil: "networkidle",
      timeout: 60000
    });

    await page.waitForTimeout(10000);

    const buy = await page.locator("#spn9").textContent();
    const sell = await page.locator("#spn10").textContent();

    cache = {
      buy: buy?.trim(),
      sell: sell?.trim(),
      updated: new Date().toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur"
      }),
      success: true,
      error: null
    };

    console.log("SUCCESS:", cache);

    await browser.close();

  } catch (err) {

    console.log("ERROR:", err.message);

    cache = {
      buy: null,
      sell: null,
      updated: null,
      success: false,
      error: err.message
    };

    if (browser) {
      await browser.close();
    }

  }

}

// first run
await scrape();

// every 1 minute
setInterval(scrape, 60000);

app.get("/", (req, res) => {
  res.send("Gold Scraper Running");
});

app.get("/gold", (req, res) => {
  res.json(cache);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("SERVER RUNNING:", PORT);
});
