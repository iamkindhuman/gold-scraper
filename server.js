const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const PORT = process.env.PORT || 10000;

let latestData = null;

/**
 * STEP 1: GET PAGE + EXTRACT AJAX "q" VALUE
 */
async function getAjaxQuery() {
  try {
    const res = await axios.get("https://msgold.com.my/");
    const html = res.data;

    // Try to find q= value in scripts
    const match = html.match(/q=([a-zA-Z0-9_]+)/);

    if (!match) {
      throw new Error("Cannot find q parameter in page");
    }

    return match[1];
  } catch (err) {
    console.error("Failed to extract q:", err.message);
    return null;
  }
}

/**
 * STEP 2: CALL AJAX ENDPOINT
 */
async function fetchGoldData() {
  try {
    const q = await getAjaxQuery();
    if (!q) return;

    const url = `https://msgold.com.my/adminxsettings/__ajax2.php`;

    const res = await axios.get(url, {
      params: {
        fn: "refg4",
        m: "eval",
        f: "",
        q: q,
        seed: Math.random()
      },
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://msgold.com.my/"
      }
    });

    latestData = {
      q,
      raw: res.data,
      updated: new Date().toISOString()
    };

    console.log("UPDATED:", latestData.updated);
  } catch (err) {
    console.error("AJAX ERROR:", err.message);
  }
}

/**
 * AUTO RUN EVERY 10 SECONDS
 */
setInterval(fetchGoldData, 10000);
fetchGoldData();

/**
 * API ENDPOINT
 */
app.get("/gold", (req, res) => {
  if (!latestData) {
    return res.status(503).json({
      success: false,
      message: "No data yet"
    });
  }

  res.json({
    success: true,
    data: latestData
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});
