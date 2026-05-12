import express from "express";
import cors from "cors";
import { chromium } from "playwright";

const app = express();
app.use(cors());

let cache = {
  buy: null,
  sell: null,
  time: null
};

async function scrape() {
  try {
    const browser = await chromium.launch({
      headless: true
    });

    const page = await browser.newPage();

    await page.goto("https://msgold.com.my/", {
      waitUntil: "networkidle"
    });

    const data = await page.evaluate(() => {
      return {
        buy: document.querySelector("#spn9")?.innerText,
        sell: document.querySelector("#spn10")?.innerText
      };
    });

    await browser.close();

    cache = {
      ...data,
      time: new Date().toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur"
      })
    };

    console.log("Updated:", cache);

  } catch (err) {
    console.error("Scrape error:", err.message);
  }
}

// run every 30 seconds
scrape();
setInterval(scrape, 30000);

app.get("/gold", (req, res) => {
  res.json(cache);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on", PORT));
