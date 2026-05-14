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
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();

    await page.goto("https://msgold.com.my/", {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForSelector("#spn9", { timeout: 30000 });

    const buy = await page.$eval("#spn9", el => el.textContent.trim());
    const sell = await page.$eval("#spn10", el => el.textContent.trim());

    cache = {
      buy,
      sell,
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

    if (browser) await browser.close();
  }
}

await scrape();
setInterval(scrape, 60000);

app.get("/", (req, res) => res.send("Gold Scraper Running"));
app.get("/gold", (req, res) => res.json(cache));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("SERVER RUNNING:", PORT));
