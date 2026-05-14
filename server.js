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

let browser, page;

async function initBrowser() {
  if (browser) return;

  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  page = await browser.newPage();

  // 🔥 INTERCEPT ALL AJAX RESPONSES
  page.on("response", async (response) => {
    const url = response.url();

    if (url.includes("__ajax2.php") && url.includes("fn=refg4")) {
      try {
        const text = await response.text();

        const match = text.match(/updprc\('spn9','([^']+)'\)/);

        if (match) {
          cache = {
            spn9: match[1],
            updated: new Date().toLocaleString("en-MY", {
              timeZone: "Asia/Kuala_Lumpur"
            }),
            success: true
          };

          console.log("UPDATED:", cache);
        }
      } catch (e) {}
    }
  });

  // load once
  await page.goto("https://msgold.com.my/", {
    waitUntil: "networkidle"
  });
}

async function refreshData() {
  try {
    await initBrowser();

    // 🔥 trigger page JS again (forces new AJAX calls)
    await page.reload({ waitUntil: "networkidle" });

  } catch (err) {
    console.log("REFRESH ERROR:", err.message);
  }
}

// API
app.get("/gold", (req, res) => {
  res.json(cache);
});

app.get("/refresh", async (req, res) => {
  await refreshData();
  res.json({ ok: true });
});

app.get("/", (req, res) => {
  res.send("Gold Scraper Running (STABLE MODE)");
});

// refresh loop (safe)
setInterval(refreshData, 15000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("RUNNING:", PORT));
