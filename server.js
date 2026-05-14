import express from "express";
import cors from "cors";
import axios from "axios";

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
  try {
    console.log("SCRAPING START (NO BROWSER)");

    const res = await axios.get("https://msgold.com.my/", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://msgold.com.my/"
      },
      timeout: 30000
    });

    const html = res.data;

    const buyMatch = html.match(/id="spn9"[^>]*>([^<]+)/);
    const sellMatch = html.match(/id="spn10"[^>]*>([^<]+)/);

    const buy = buyMatch ? buyMatch[1].trim() : null;
    const sell = sellMatch ? sellMatch[1].trim() : null;

    cache = {
      buy,
      sell,
      updated: new Date().toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur"
      }),
      success: !!(buy && sell),
      error: null
    };

    console.log("SUCCESS:", cache);

  } catch (err) {
    console.log("ERROR:", err.message);

    cache = {
      buy: null,
      sell: null,
      updated: null,
      success: false,
      error: err.message
    };
  }
}

// run immediately
scrape();

// refresh every 60 seconds
setInterval(scrape, 60000);

app.get("/", (req, res) => {
  res.send("Gold Scraper Running (NO PLAYWRIGHT)");
});

app.get("/gold", (req, res) => {
  res.json(cache);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("SERVER RUNNING:", PORT));
