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

async function scrape() {

  let browser;

  try {

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
      waitUntil: "networkidle",
      timeout: 60000
    });

    await page.waitForSelector("#spn9", {
      timeout: 30000
    });

    const result = await page.evaluate(() => {

      return {
        buy: document.querySelector("#spn9")?.innerText?.trim(),
        sell: document.querySelector("#spn10")?.innerText?.trim()
      };

    });

    cache = {
      buy: result.buy,
      sell: result.sell,
      updated: new Date().toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur"
      }),
      success: true
    };

    console.log(cache);

    await browser.close();

  } catch (err) {

    console.log("SCRAPE ERROR:");
    console.log(err);

    cache.success = false;

    if (browser) {
      await browser.close();
    }

  }

}

// initial scrape
scrape();

// scrape every 60 sec
setInterval(scrape, 60000);

app.get("/", (req, res) => {
  res.send("Gold Scraper Running");
});

app.get("/gold", (req, res) => {
  res.json(cache);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
