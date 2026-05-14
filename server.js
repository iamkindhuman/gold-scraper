import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());

async function getAjaxUrl() {
  const res = await axios.get("https://msgold.com.my/", {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const html = res.data;

  // extract FULL ajax url from script
  const match = html.match(/__ajax2\.php\?fn=refg4[^"']+/);

  if (!match) return null;

  return "https://msgold.com.my/adminxsettings/" + match[0];
}

async function scrape() {
  try {
    console.log("FETCHING DYNAMIC AJAX...");

    const ajaxUrl = await getAjaxUrl();

    if (!ajaxUrl) throw new Error("AJAX URL not found");

    const res = await axios.get(ajaxUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://msgold.com.my/"
      }
    });

    const html = res.data;

    const spn9 = html.match(/updprc\('spn9','([^']+)'\)/);

    const result = {
      spn9: spn9?.[1] || null,
      updated: new Date().toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur"
      }),
      success: !!spn9
    };

    console.log("RESULT:", result);

    return result;

  } catch (err) {
    console.log("ERROR:", err.message);

    return {
      spn9: null,
      success: false,
      error: err.message
    };
  }
}

app.get("/gold", async (req, res) => {
  const data = await scrape();
  res.json(data);
});

app.get("/", (req, res) => {
  res.send("Gold Scraper Running (AUTO AJAX DETECTION)");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("RUNNING:", PORT));
