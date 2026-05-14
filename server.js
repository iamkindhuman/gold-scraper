const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 10000;

let cache = {
  spn9: null,
  updated: null
};

/**
 * STEP 1: GET LIVE q FROM MAIN PAGE
 */
async function getLiveQ() {
  try {
    const res = await axios.get("https://msgold.com.my/", {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const html = res.data;

    const match = html.match(/q=([a-zA-Z0-9_]+)/);

    if (!match) return null;

    return match[1];
  } catch (err) {
    console.log("Q ERROR:", err.message);
    return null;
  }
}

/**
 * STEP 2: FETCH AJAX USING LIVE Q
 */
async function fetchGold() {
  try {
    const q = await getLiveQ();

    if (!q) {
      console.log("No live q found");
      return;
    }

    const res = await axios.get(
      "https://msgold.com.my/adminxsettings/__ajax2.php",
      {
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
      }
    );

    const
