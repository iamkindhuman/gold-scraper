const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ---------------- GLOBAL SAFETY ----------------
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("REJECTION:", err);
});

// ---------------- HEALTH CHECK ----------------
app.get("/", (req, res) => {
  res.json({
    status: "alive",
    service: "gold-scraper",
    time: new Date().toISOString(),
  });
});

// ---------------- SCRAPER (SAFE MODE) ----------------
app.get("/scrape", async (req, res) => {
  let browser;

  try {
    console.log("SCRAPE START");

    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();

    await page.goto("https://msgold.com.my/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(3000);

    const data = await page.evaluate(() => {
      return {
        raw: document.body.innerText.slice(0, 2000),
        updated: new Date().toISOString(),
      };
    });

    await browser.close();

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    if (browser) await browser.close();

    console.error("SCRAPE ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ---------------- IMPORTANT: RENDER FIX ----------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`RUNNING ON PORT: ${PORT}`);
});
