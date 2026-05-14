const express = require("express");

const app = express();
app.use(express.json());

// 🔥 MUST USE RENDER PORT EXACTLY
const PORT = process.env.PORT;

// ---------------- SAFETY NET (PREVENT EXIT 1) ----------------
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

// ---------------- LAZY LOAD PLAYWRIGHT ----------------
app.get("/scrape", async (req, res) => {
  let browser;

  try {
    console.log("SCRAPE START");

    const { chromium } = require("playwright");

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

// ---------------- START SERVER (CRITICAL) ----------------
app.listen(PORT, "0.0.0.0", () => {
  console.log("RUNNING ON PORT:", PORT);
});
