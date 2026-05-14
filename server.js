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
    console.log("START SCRAPE (PLAYWRIGHT RELIABLE MODE)");

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    // IMPORTANT: capture AJAX response
    const ajaxPromise = new Promise((resolve) => {
      page.on("response", async (res) => {
        const url = res.url();

        if (url.includes("__ajax2.php") && url.includes("fn=refg4")) {
          try {
            const text = await res.text();
            resolve(text);
          } catch (e) {
            resolve(null);
          }
        }
      });
    });

    await page.goto("https://msgold.com.my/", {
      waitUntil: "networkidle"
    });

    const ajaxText = await ajaxPromise;

    if (!ajaxText) throw new Error("AJAX not captured");

    const match = ajaxText.match(/updprc\('spn9','([^']+)'\)/);

    cache = {
      spn9: match?.[1] || null,
      updated: new Date().toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur"
      }),
      success: !!match
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
