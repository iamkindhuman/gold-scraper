const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 10000;

let cache = null;

/**
 * GET dynamic q= value from homepage
 */
async function getQ() {
  try {
    const res = await axios.get("https://msgold.com.my/", {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const html = res.data;

    // extract q=xxxxxxxx pattern
    const match = html.match(/q=([a-zA-Z0-9_]+)/);

    if (!match) return null;

    return match[1];
  } catch (err) {
    console.log("Q ERROR:", err.message);
    return null;
  }
}

/**
 * CALL AJAX API
 */
async function fetchGold() {
  try {
    const q = await getQ();
    if (!q) return;

    const url = "https://msgold.com.my/adminxsettings/__ajax2.php";

    const res = await axios.get(url, {
      params: {
        fn: "refg4",
        m: "eval",
        f: "",
        q,
        seed: Math.random()
      },
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://msgold.com.my/"
      }
    });

    cache = {
      q,
      data: res.data,
      updated: new Date().toISOString()
    };

    console.log("UPDATED:", cache.updated);
  } catch (err) {
    console.log("AJAX ERROR:", err.message);
  }
}

/**
 * RUN EVERY 10 SECONDS
 */
setInterval(fetchGold, 10000);
fetchGold();

/**
 * HEALTH CHECK
 */
app.get("/", (req, res) => {
  res.json({
    status: "alive",
    service: "gold-scraper"
  });
});

/**
 * OUTPUT API
 */
app.get("/gold", (req, res) => {
  if (!cache) {
    return res.status(503).json({
      success: false,
      message: "No data yet"
    });
  }

  res.json({
    success: true,
    result: cache
  });
});

/**
 * START SERVER
 */
app.listen(PORT, "0.0.0.0", () => {
  console.log("RUNNING ON PORT:", PORT);
});
