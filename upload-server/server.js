// ── Gewoon bij Isolde — Bewijsstukken upload server ─────────────────────────
// Draait op de NUC, bereikbaar via Tailscale Funnel.
// Bestanden worden opgeslagen in UPLOAD_MAP (stel in via .env of hieronder).
//
// Opstarten:
//   node server.js
//
// Stoppen / automatisch opstarten: zie README.md

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import puppeteer from "puppeteer";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Instellingen ─────────────────────────────────────────────────────────────
const PORT       = process.env.PORT       || 3747;
const API_KEY    = process.env.API_KEY    || "verander-dit-naar-een-geheim-wachtwoord";
const UPLOAD_MAP = process.env.UPLOAD_MAP || path.join(__dirname, "uploads");

// Uploadmap aanmaken — niet fataal als NAS nog niet gemount is bij opstarten
try {
  fs.mkdirSync(UPLOAD_MAP, { recursive: true });
} catch (e) {
  console.warn("⚠️  Uploadmap nog niet bereikbaar bij start (NAS waarschijnlijk nog niet gemount).");
  console.warn("   Map wordt automatisch aangemaakt bij eerste upload.");
}

// ── Express setup ─────────────────────────────────────────────────────────────
const app = express();

// CORS — sta verzoeken toe van de Netlify app
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "x-api-key, Content-Type");
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// API-key authenticatie (header voor uploads, query param voor bestandsweergave)
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const keyHeader = req.headers["x-api-key"];
  const keyQuery  = req.query.key;
  if (keyHeader !== API_KEY && keyQuery !== API_KEY) {
    return res.status(401).json({ error: "Ongeldige API-key" });
  }
  next();
});

// ── Multer: bestanden opslaan per jaar/maand ─────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Pad komt uit de request: bijv. "2026/06"
    const submap = req.body.pad || "";
    const volledigeMap = path.join(UPLOAD_MAP, submap);
    fs.mkdirSync(volledigeMap, { recursive: true });
    cb(null, volledigeMap);
  },
  filename: (req, file, cb) => {
    cb(null, req.body.bestandsnaam || file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // max 10MB
  fileFilter: (req, file, cb) => {
    const toegestaan = ["image/jpeg","image/jpg","image/png","image/webp","image/heic","application/pdf","text/html","application/octet-stream"];
    cb(null, toegestaan.includes(file.mimetype));
  },
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check (geen auth nodig)
app.get("/health", (req, res) => {
  res.json({ status: "ok", server: "Gewoon bij Isolde upload server" });
});

// Upload bestand
app.post("/upload", upload.single("bestand"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Geen bestand ontvangen" });
  const relativePad = path.join(req.body.pad || "", req.file.filename).replace(/\\/g, "/");
  console.log(`✓ Opgeslagen: ${relativePad}`);
  res.json({ pad: relativePad, ok: true });
});

// HTML → PDF converteren en opslaan op NAS
app.post("/html-to-pdf", express.json({ limit: "8mb" }), async (req, res) => {
  const { html, pad, bestandsnaam } = req.body;
  if (!html || !pad || !bestandsnaam) return res.status(400).json({ error: "Ontbrekende velden" });

  const volledigeMap = path.join(UPLOAD_MAP, pad);
  try { fs.mkdirSync(volledigeMap, { recursive: true }); } catch {}
  const volledigPad = path.join(volledigeMap, bestandsnaam);

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 15000 });
    await page.pdf({
      path: volledigPad,
      format: "A4",
      margin: { top: "15mm", bottom: "15mm", left: "15mm", right: "15mm" },
      printBackground: true,
    });
    await browser.close();

    const relativePad = path.join(pad, bestandsnaam).replace(/\\/g, "/");
    console.log(`✓ PDF opgeslagen: ${relativePad}`);
    res.json({ pad: relativePad, ok: true });
  } catch (e) {
    console.error("PDF generatie mislukt:", e.message);
    res.status(500).json({ error: "PDF generatie mislukt: " + e.message });
  }
});

// Bestand opvragen (voor inzage bon)
app.get("/bestand/*", (req, res) => {
  const relativePad = req.params[0];
  const volledigPad = path.join(UPLOAD_MAP, relativePad);
  if (!fs.existsSync(volledigPad)) return res.status(404).json({ error: "Niet gevonden" });
  res.sendFile(volledigPad);
});

// ── Start ─────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n💅 Gewoon bij Isolde — Upload server gestart`);
  console.log(`   Poort    : ${PORT}`);
  console.log(`   Map      : ${UPLOAD_MAP}`);
  console.log(`   API-key  : ${API_KEY === "verander-dit-naar-een-geheim-wachtwoord" ? "⚠️  Nog niet ingesteld!" : "✓ ingesteld"}`);
  console.log(`\n   Tailscale Funnel starten:`);
  console.log(`   tailscale funnel --bg ${PORT}\n`);
});

// Graceful shutdown: poort netjes vrijgeven zodat PM2 herstart zonder EADDRINUSE
const shutdown = () => {
  console.log("Server wordt afgesloten...");
  server.close(() => { console.log("Poort vrijgegeven."); process.exit(0); });
  setTimeout(() => process.exit(0), 3000); // forceer na 3s
};
process.on("SIGTERM", shutdown);
process.on("SIGINT",  shutdown);
