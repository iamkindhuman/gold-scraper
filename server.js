import express from "express";
import cors from "cors";
import { chromium } from "playwright";

const app = express();

app.use(cors());

let cache = {
  buy: null,
  sell: null,
  updated: null,
  success: false
};

let browser;

async function getBrowser() {

  if (!browser) {

    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

  }

  return browser;
}

async function scrape() {

  let page;

  try {

    const browserInstance = await getBrowser();

    page = await browserInstance.newPage();

    await page.goto("https://msgold.com.my/", {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForSelector("#spn9", {
      timeout: 30000
    });

    const data = await page.evaluate(() => {

      return {
        buy: document.querySelector("#spn9")?.innerText?.trim(),
        sell: document.querySelector("#spn10")?.innerText?.trim()
      };

    });

    cache = {
      ...data,
      updated: new Date().toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur"
      }),
      success: true
    };

    console.log("Updated:", cache);

  } catch (err) {

    console.error("SCRAPE ERROR:", err.message);

    cache.success = false;

  } finally {

    if (page) {
      await page.close();
    }

  }

}

// First run
await scrape();

// Every 1 minute
setInterval(scrape, 60000);

app.get("/gold", (req, res) => {
  res.json(cache);
});

app.get("/", (req, res) => {
  res.send("Gold Scraper Running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
