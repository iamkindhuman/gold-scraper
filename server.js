const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 10000;

let cache = {
  spn9: null,
  updated: null
};

/**
 * SAFE Q FETCH
 */
async function getLiveQ() {
  try {
    const res = await axios.get("https://msgold.com.my/", {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const match = res.data.match(/q=([a-zA-Z0-9_]+)/);
    return match ? match[1] : null;

  } catch (e) {
    console.log("Q FAIL:", e.message);
    return null;
  }
}

/**
 * SAFE FETCH GOLD
 */
async function fetchGold() {
  try {
    const q = await getLiveQ();
    if (!q) return;

    const res = await axios.get(
      "https://msgold.com.my/adminxsettings/__ajax2.php",
      {
        timeout: 10000,
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
      }
    );

    const match = res.data.match(/updprc\('spn9','([\d.,]+)'\)/);

    if (!match) {
      console.log("Invalid AJAX response (likely expired q)");
      return;
    }

    cache.spn9 = match[1].replace(/,/g, "");
    cache.updated = new Date().toISOString();

    console.log("SPN9:", cache.spn9);

  } catch (e) {
    console.log("AJAX FAIL:", e.message);
  }
}

/**
 * LOOP (SAFE WRAPPED)
 */
setInterval(() => {
  fetchGold().catch(() => {});
}, 10000);

/**
 * STARTUP DELAY (IMPORTANT FOR RENDER)
 */
setTimeout(fetchGold, 3000);

/**
 * ROUTES
 */
app.get("/", (req, res) => {
  res.json({
    status: "alive"
  });
});

app.get("/gold", (req, res) => {
  if (!cache.spn9) {
    return res.json({
      success: false,
      message: "No data yet"
    });
  }

  res.json({
    success: true,
    spn9: cache.spn9,
    updated: cache.updated
  });
});

/**
 * CRASH PROTECTION
 */
process.on("uncaughtException", err => {
  console.log("UNCAUGHT:", err.message);
});

process.on("unhandledRejection", err => {
  console.log("REJECTION:", err);
});

/**
 * START SERVER
 */
app.listen(PORT, "0.0.0.0", () => {
  console.log("RUNNING ON PORT", PORT);
});
