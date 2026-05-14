import express from "express";
import cors from "cors";
import { chromium } from "playwright";

const app = express();
app.use(cors());

let cache = {
  spn9: null,
  updated: null,
  success: false
};

async function scrape() {
  let browser;

  try {
    console.log("SCRAPING WITH BROWSER...");

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    await page.goto("https://msgold.com.my/", {
      waitUntil: "networkidle"
    });

    // wait for JS to generate values
    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => {
      return {
        spn9: document.querySelector("#spn9")?.innerText || null
      };
    });

    cache = {
      ...result,
      updated: new Date().toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur"
      }),
      success: !!result.spn9
    };

    console.log("OK:", cache);

  } catch (err) {
    console.log("ERROR:", err.message);

    cache = {
      spn9: null,
      success: false,
      error: err.message
    };

  } finally {
    if (browser) await browser.close();
  }
}

app.get("/gold", async (req, res) => {
  await scrape();
  res.json(cache);
});

app.get("/", (req, res) => {
  res.send("Gold Scraper Running (BROWSER MODE)");
});

setInterval(scrape, 30000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("RUNNING:", PORT));
