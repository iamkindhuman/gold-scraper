const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

/* =========================
   ERROR HANDLING
========================= */
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("REJECTION:", err);
});

/* =========================
   HOME
========================= */
app.get("/", (req, res) => {
  res.json({
    status: "alive",
    service: "gold-scraper",
  });
});

/* =========================
   GOLD ROUTE (FIX FOR YOU)
========================= */
app.get("/gold", (req, res) => {
  res.json({
    message: "Use /scrape to get data",
    endpoints: {
      scrape: "/scrape"
    }
  });
});

/* =========================
   SCRAPER
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
        title: document.title,
        preview: text.slice(0, 1500),
      };
    });

    await browser.close();

    return res.json({
      success: true,
      updated: new Date().toISOString(),
      data,
    });
  } catch (err) {
    if (browser) await browser.close();

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log("RUNNING ON PORT:", PORT);
});
