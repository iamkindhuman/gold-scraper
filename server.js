const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 10000;

let cache = {
  spn9: null,
  raw: null,
  updated: null
};

/**
 * FETCH AJAX DATA
 */
async function fetchGold() {
  try {
    const res = await axios.get(
      "https://msgold.com.my/adminxsettings/__ajax2.php",
      {
        params: {
          fn: "refg4",
          m: "eval",
          f: "",
          q: "2599_1778738276_d8764a080a726758c42c0850d8d8a9c8", // IMPORTANT FIXED Q
          seed: Math.random()
        },
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://msgold.com.my/"
        }
      }
    );

    const raw = res.data;

    // 🔥 EXTRACT spn9 DIRECTLY
    const match = raw.match(/updprc\('spn9','([\d.,]+)'\)/);

    const spn9 = match ? match[1].replace(/,/g, "") : null;

    cache = {
      spn9,
      raw,
      updated: new Date().toISOString()
    };

    console.log("SPN9:", spn9, "| Updated:", cache.updated);
  } catch (err) {
    console.log("ERROR:", err.message);
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
 * API OUTPUT (FOR YOUR PHP/FRONTEND)
 */
app.get("/gold", (req, res) => {
  if (!cache.spn9) {
    return res.status(503).json({
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
 * START SERVER
 */
app.listen(PORT, "0.0.0.0", () => {
  console.log("RUNNING ON PORT", PORT);
});
