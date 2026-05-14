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

// generate dynamic q similar to site pattern
function generateQ() {
  const part1 = 8050;
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = "01da9b4759d81a47cf8c4f00e5d38451"; // stable part observed

  return `${part1}_${timestamp}_${hash}`;
}

async function scrape() {
  try {
    console.log("TRY FETCH AJAX...");

    const q = generateQ();

    const url = `https://msgold.com.my/adminxsettings/__ajax2.php?fn=refg4&m=eval&f=&q=${q}&seed=${Math.random()}`;

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

    console.log("RESULT:", cache);

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
  res.send("Gold Scraper Running (DIRECT AJAX MODE)");
});

setInterval(scrape, 30000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("RUNNING:", PORT));
