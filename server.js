const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ---------- HEALTH CHECK ----------
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "Gold Scraper Running",
    time: new Date().toISOString(),
  });
});

// ---------- MAIN SCRAPE ENDPOINT ----------
app.get("/scrape", async (req, res) => {
  let browser = null;

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

    const url = "https://msgold.com.my/";

    // IMPORTANT: avoid double navigation crash
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(3000);

    // ---------- SAFE SCRAPE (NO PATTERN MATCHING) ----------
    const result = await page.evaluate(() => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.innerText.trim() : null;
      };

      return {
        spn9: getText("body")?.match(/SPN\s*9[^0-9]*([0-9,.]+)/i)?.[1] || null,
        updated: new Date().toLocaleString(),
        success: true,
      };
    });

    await browser.close();

    console.log("SUCCESS:", result);
    return res.json(result);
  } catch (err) {
    console.error("ERROR:", err.message);

    if (browser) await browser.close();

    return res.status(500).json({
      spn9: null,
      updated: new Date().toISOString(),
      success: false,
      error: err.message,
    });
  }
});

// ---------- RENDER PORT FIX ----------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`RUNNING ON PORT: ${PORT}`);
});
