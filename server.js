const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

/* =========================
   GLOBAL ERROR HANDLERS
========================= */
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("REJECTION:", err);
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.json({
    status: "alive",
    service: "gold-scraper",
    time: new Date().toISOString(),
  });
});

/* =========================
   SCRAPER ENDPOINT
========================= */
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
      const text = document.body.innerText || "";

      return {
        title: document.title || null,
        preview: text.slice(0, 2000),
      };
    });

    await browser.close();

    return res.json({
      success: true,
      updated: new Date().toISOString(),
      data,
    });
  } catch (err) {
    console.error("SCRAPE ERROR:", err);

    if (browser) await browser.close();

    return res.status(500).json({
      success: false,
      error: err.message,
      updated: new Date().toISOString(),
    });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`RUNNING ON PORT: ${PORT}`);
});
