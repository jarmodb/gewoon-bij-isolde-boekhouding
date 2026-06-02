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

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Instellingen ─────────────────────────────────────────────────────────────
const PORT       = process.env.PORT       || 3747;
const API_KEY    = process.env.API_KEY    || "verander-dit-naar-een-geheim-wachtwoord";
const UPLOAD_MAP = process.env.UPLOAD_MAP || path.join(__dirname, "uploads");

// Maak uploadmap aan als die nog niet bestaat
fs.mkdirSync(UPLOAD_MAP, { recursive: true });

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

// API-key authenticatie
app.use((req, res, next) => {
  if (req.path === "/health") return next(); // health check mag altijd
  if (req.headers["x-api-key"] !== API_KEY) {
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
    const toegestaan = ["image/jpeg","image/jpg","image/png","image/webp","image/heic","application/pdf"];
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

// Bestand opvragen (voor inzage bon)
app.get("/bestand/*", (req, res) => {
  const relativePad = req.params[0];
  const volledigPad = path.join(UPLOAD_MAP, relativePad);
  if (!fs.existsSync(volledigPad)) return res.status(404).json({ error: "Niet gevonden" });
  res.sendFile(volledigPad);
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n💅 Gewoon bij Isolde — Upload server gestart`);
  console.log(`   Poort    : ${PORT}`);
  console.log(`   Map      : ${UPLOAD_MAP}`);
  console.log(`   API-key  : ${API_KEY === "verander-dit-naar-een-geheim-wachtwoord" ? "⚠️  Nog niet ingesteld!" : "✓ ingesteld"}`);
  console.log(`\n   Tailscale Funnel starten:`);
  console.log(`   tailscale funnel --bg ${PORT}\n`);
});
