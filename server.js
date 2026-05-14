const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "alive",
    service: "gold-scraper",
    time: new Date().toISOString(),
  });
});

// MAIN SCRAPER
app.get("/scrape", async (req, res) => {
  let browser;

  try {
    console.log("SCRAPE START");

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    let ajaxResults = [];

    // Capture ALL AJAX responses
    page.on("response", async (response) => {
      const url = response.url();

      if (url.includes("__ajax2.php")) {
        try {
          const text = await response.text();

          ajaxResults.push({
            url,
            data: text,
            time: new Date().toISOString(),
          });
        } catch (e) {}
      }
    });

    await page.goto("https://msgold.com.my/", {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    // wait for AJAX refresh cycles (important!)
    await page.waitForTimeout(15000);

    await browser.close();

    return res.json({
      success: true,
      count: ajaxResults.length,
      result: ajaxResults,
    });

  } catch (err) {
    if (browser) await browser.close();

    console.error(err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("RUNNING ON PORT:", PORT);
});
