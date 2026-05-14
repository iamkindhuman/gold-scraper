import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());

let cache = {
  spn9: null,
  updated: null,
  success: false
};

async function getAjaxUrl() {
  try {
    const res = await axios.get("https://msgold.com.my/", {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const html = res.data;

    // extract FULL ajax url dynamically
    const match = html.match(/__ajax2\.php\?fn=refg4[^"']+/);

    if (!match) return null;

    return "https://msgold.com.my/adminxsettings/" + match[0];

  } catch (e) {
    return null;
  }
}

async function scrape() {
  try {
    console.log("FETCHING DYNAMIC AJAX URL...");

    const url = await getAjaxUrl();

    if (!url) throw new Error("AJAX URL NOT FOUND");

    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://msgold.com.my/"
      }
    });

    const text = res.data;

    const match = text.match(/updprc\('spn9','([^']+)'\)/);

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
  }
}

app.get("/gold", async (req, res) => {
  await scrape();
  res.json(cache);
});

app.get("/", (req, res) => {
  res.send("Gold Scraper Running (AUTO AJAX DETECTION)");
});

setInterval(scrape, 30000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("RUNNING:", PORT));
