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
    console.log("SCRAPE START (ULTRA STABLE MODE)");

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    // wait specifically for AJAX response
    const [response] = await Promise.all([
      page.waitForResponse(res =>
        res.url().includes("__ajax2.php") &&
        res.url().includes("fn=refg4")
      , { timeout: 20000 }),

      page.goto("https://msgold.com.my/", {
        waitUntil: "domcontentloaded"
      })
    ]);

    const text = await response.text();

    const match = text.match(/updprc\('spn9','([^']+)'\)/);

    cache = {
      spn9: match?.[1] || null,
      updated: new Date().toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur"
      }),
      success: !!match
    };

    console.log("SUCCESS:", cache);

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

// API
app.get("/gold", async (req, res) => {
  await scrape();
  res.json(cache);
});

app.get("/", (req, res) => {
  res.send("Gold Scraper Running (ROBUST MODE)");
});

// auto refresh
setInterval(scrape, 15000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("RUNNING:", PORT));
