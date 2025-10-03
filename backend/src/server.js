import "dotenv/config";
import express from "express";
import cors from "cors";
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { fetch } from "undici";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ?? 4000;
const DEMO_API_KEY = process.env.API_KEY;
const DATA_DIR = join(__dirname, "..", "data");
const DATA_FILE = join(DATA_DIR, "records.json");

async function ensureDataFileExists() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify({ records: [] }, null, 2), {
      flag: "wx",
    });
  } catch (_) {
    // ignore EEXIST
  }
}

async function readRecords() {
  await ensureDataFileExists();
  const raw = await readFile(DATA_FILE, "utf-8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.records)) {
    return [];
  }
  return parsed.records;
}

async function writeRecords(records) {
  await ensureDataFileExists();
  const body = { records };
  await writeFile(DATA_FILE, JSON.stringify(body, null, 2), "utf-8");
}

// Health
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// CoinGecko Demo API proxy - ping
app.get("/api/ping", async (req, res) => {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/ping", {
      headers: {
        "x-cg-demo-api-key": DEMO_API_KEY ?? "",
      },
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "proxy_failed", message: String(err) });
  }
});

// Coin price proxy: /api/price?ids=bitcoin,ethereum&vs_currencies=usd
app.get("/api/price", async (req, res) => {
  try {
    const params = new URLSearchParams();
    if (req.query.ids) params.set("ids", String(req.query.ids));
    if (req.query.vs_currencies)
      params.set("vs_currencies", String(req.query.vs_currencies));
    const url = `https://api.coingecko.com/api/v3/simple/price?${params.toString()}`;
    const r = await fetch(url, {
      headers: {
        "x-cg-demo-api-key": DEMO_API_KEY ?? "",
      },
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "proxy_failed", message: String(err) });
  }
});

// Search coins: /api/search?query=bit
app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.query ?? "").trim();
    if (!q) return res.status(400).json({ error: "missing_query" });
    const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(
      q
    )}`;
    const r = await fetch(url, {
      headers: {
        "x-cg-demo-api-key": DEMO_API_KEY ?? "",
      },
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "proxy_failed", message: String(err) });
  }
});

// Market chart: /api/market-chart?id=bitcoin&vs_currency=usd&days=30
app.get("/api/market-chart", async (req, res) => {
  try {
    const id = String(req.query.id ?? "");
    const vs = String(req.query.vs_currency ?? "usd");
    const days = String(req.query.days ?? "30");
    if (!id) return res.status(400).json({ error: "missing_id" });
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
      id
    )}/market_chart?vs_currency=${encodeURIComponent(
      vs
    )}&days=${encodeURIComponent(days)}`;
    const r = await fetch(url, {
      headers: { "x-cg-demo-api-key": DEMO_API_KEY ?? "" },
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "proxy_failed", message: String(err) });
  }
});

// JSON storage: list records
app.get("/records", async (req, res) => {
  try {
    const records = await readRecords();
    res.json({ records });
  } catch (err) {
    res.status(500).json({ error: "read_failed", message: String(err) });
  }
});

// JSON storage: add record
app.post("/records", async (req, res) => {
  try {
    const payload = req.body ?? {};
    const records = await readRecords();
    const newRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      data: payload,
    };
    records.push(newRecord);
    await writeRecords(records);
    res.status(201).json(newRecord);
  } catch (err) {
    res.status(500).json({ error: "write_failed", message: String(err) });
  }
});

// JSON storage: delete record by id
app.delete("/records/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const records = await readRecords();
    const next = records.filter((r) => r.id !== id);
    if (next.length === records.length) {
      return res.status(404).json({ error: "not_found" });
    }
    await writeRecords(next);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "delete_failed", message: String(err) });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});
