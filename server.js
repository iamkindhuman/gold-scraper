const express = require("express");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.json({ status: "alive" });
});

app.get("/scrape", async (req, res) => {
  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    });

    const page = await browser.newPage();

    let ajaxData = [];

    page.on("response", async (response) => {
      if (response.url().includes("__ajax2.php")) {
        try {
          ajaxData.push(await response.text());
        } catch (e) {}
      }
    });

    await page.goto("https://msgold.com.my/", {
      waitUntil: "domcontentloaded"
    });

    await page.waitForTimeout(15000);

    await browser.close();

    res.json({
      success: true,
      data: ajaxData
    });

  } catch (err) {
    if (browser) await browser.close();

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("RUNNING ON PORT:", PORT);
});
