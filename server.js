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
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    await page.goto("https://msgold.com.my/", {
      waitUntil: "networkidle"
    });

    // 🔥 WAIT UNTIL JS FINISHES POPULATING VALUE
    await page.waitForFunction(() => {
      const el = document.querySelector("#spn9");
      return el && el.innerText.trim() !== "";
    }, { timeout: 20000 });

    const spn9 = await page.$eval("#spn9", el => el.innerText.trim());

    cache = {
      spn9,
      updated: new Date().toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur"
      }),
      success: true
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
  res.send("Gold Scraper STABLE MODE");
});

setInterval(() => {
  scrape().catch(() => {});
}, 15000);

app.listen(3000, () => console.log("RUNNING"));
