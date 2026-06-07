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

// Apart geheim voor de Google Agenda-feed (los van de upload API-key, want
// deze link wordt gedeeld met Google en mag dus niet de uploadfunctie kunnen misbruiken)
const AGENDA_TOKEN = process.env.AGENDA_TOKEN || "verander-dit-agenda-token";

// Supabase — zelfde (publieke) project-gegevens als in src/storage.js, alleen-lezen gebruikt
const SUPABASE_URL      = "https://djueprzazwzwskdrqtgm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdWVwcnphend6d3NrZHJxdGdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzM3OTcsImV4cCI6MjA5NTkwOTc5N30.GvjNwW0yMQhGwaqdyeiLqlElhPQk3JMo0eix4Cd0nQw";

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
  if (req.path === "/health" || req.path === "/agenda.ics") return next();
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

// ── Google Agenda-feed (.ics) ─────────────────────────────────────────────────
// Eenmalig in Google Agenda toevoegen via "Andere agenda's" → "Op URL abonneren":
//   https://<jouw-funnel-url>/agenda.ics?token=<AGENDA_TOKEN>
// Google ververst zo'n abonnement automatisch (meestal binnen enkele uren).

const pad2 = (n) => String(n).padStart(2, "0");

// "2026-06-07" + "10:00" (lokale NL-tijd) → "20260607T080000Z" (UTC, voor ICS)
// Werkt automatisch goed met zomer-/wintertijd omdat de NUC in Europe/Amsterdam draait.
function naarIcsTijd(datumStr, tijdStr) {
  const d = new Date(`${datumStr}T${tijdStr}:00`);
  return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate())
    + "T" + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + "Z";
}

// "2026-06-07" → "20260607" (voor hele-dag-events)
const naarIcsDatum = (datumStr) => datumStr.replace(/-/g, "");

// Volgende kalenderdag als "YYYY-MM-DD" (DTEND bij hele-dag-events is exclusief)
function volgendeDag(datumStr) {
  const d = new Date(`${datumStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

// Speciale tekens escapen volgens RFC 5545
function icsEscape(str) {
  return String(str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

app.get("/agenda.ics", async (req, res) => {
  if (req.query.token !== AGENDA_TOKEN) {
    return res.status(401).send("Ongeldig token");
  }

  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/boekhouding?id=eq.1&select=data`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!resp.ok) throw new Error(`Supabase gaf status ${resp.status}`);
    const rows = await resp.json();
    const data = rows?.[0]?.data || {};
    const afspraken  = Array.isArray(data.afspraken)   ? data.afspraken   : [];
    const geblokkeerd = Array.isArray(data.geblokkeerd) ? data.geblokkeerd : [];

    const nu = naarIcsTijd(
      new Date().toISOString().slice(0, 10),
      `${pad2(new Date().getUTCHours())}:${pad2(new Date().getUTCMinutes())}`
    );

    const regels = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Gewoon bij Isolde//Planning//NL",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Gewoon bij Isolde — Planning",
      "X-WR-TIMEZONE:Europe/Amsterdam",
    ];

    // Afspraken (geannuleerde afspraken niet meenemen)
    afspraken
      .filter(a => a.status !== "geannuleerd" && a.datum && a.tijdstip)
      .forEach(a => {
        const start = naarIcsTijd(a.datum, a.tijdstip);
        const eindeDatum = new Date(`${a.datum}T${a.tijdstip}:00`);
        eindeDatum.setMinutes(eindeDatum.getMinutes() + (Number(a.duurMinuten) || 60));
        const eind = naarIcsTijd(
          `${eindeDatum.getFullYear()}-${pad2(eindeDatum.getMonth() + 1)}-${pad2(eindeDatum.getDate())}`,
          `${pad2(eindeDatum.getHours())}:${pad2(eindeDatum.getMinutes())}`
        );
        const titel = [a.klantNaam, a.behandeling].filter(Boolean).join(" — ") || "Afspraak";
        const beschrijving = [
          a.behandeling ? `Behandeling: ${a.behandeling}` : null,
          a.prijsIndicatie ? `Prijsindicatie: €${a.prijsIndicatie}` : null,
          a.notities ? `Notities: ${a.notities}` : null,
          a.status === "voltooid" ? "Status: voltooid" : null,
        ].filter(Boolean).join("\\n");

        regels.push(
          "BEGIN:VEVENT",
          `UID:afspraak-${a.id}@gewoonbijisolde`,
          `DTSTAMP:${nu}`,
          `DTSTART:${start}`,
          `DTEND:${eind}`,
          `SUMMARY:${icsEscape(titel)}`,
          beschrijving ? `DESCRIPTION:${icsEscape(beschrijving)}` : null,
          "END:VEVENT"
        );
      });

    // Geblokkeerde dagen (vakantie/cursus/ziek/overig) als hele-dag-events
    geblokkeerd
      .filter(b => b.van && b.tot)
      .forEach(b => {
        const titel = `🔒 ${b.type || "Geblokkeerd"}${b.reden ? ` — ${b.reden}` : ""}`;
        regels.push(
          "BEGIN:VEVENT",
          `UID:blok-${b.id}@gewoonbijisolde`,
          `DTSTAMP:${nu}`,
          `DTSTART;VALUE=DATE:${naarIcsDatum(b.van)}`,
          `DTEND;VALUE=DATE:${naarIcsDatum(volgendeDag(b.tot))}`,
          `SUMMARY:${icsEscape(titel)}`,
          "TRANSP:TRANSPARENT",
          "END:VEVENT"
        );
      });

    regels.push("END:VCALENDAR");

    res.set("Content-Type", "text/calendar; charset=utf-8");
    res.set("Content-Disposition", "inline; filename=\"gewoon-bij-isolde-planning.ics\"");
    res.send(regels.filter(Boolean).join("\r\n"));
  } catch (e) {
    console.error("Agenda-feed genereren mislukt:", e.message);
    res.status(500).send("Agenda-feed genereren mislukt");
  }
});

// Zoek browser: eerst puppeteer cache, dan systeem Chrome/Edge
function vindChrome() {
  // 1. Puppeteer cache (alle versies)
  const userDir = process.env.USERPROFILE || process.env.HOME || "C:\\Users\\jarmo";
  const cacheDir = path.join(userDir, ".cache", "puppeteer", "chrome");
  if (fs.existsSync(cacheDir)) {
    for (const versie of fs.readdirSync(cacheDir)) {
      for (const submap of ["chrome-win64", "chrome-win32"]) {
        const exe = path.join(cacheDir, versie, submap, "chrome.exe");
        if (fs.existsSync(exe)) { console.log("Chrome (cache) gevonden:", exe); return exe; }
      }
    }
  }
  // 2. Systeem Chrome
  for (const p of [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ]) {
    if (fs.existsSync(p)) { console.log("Chrome (systeem) gevonden:", p); return p; }
  }
  // 3. Microsoft Edge (altijd aanwezig op Windows 10/11)
  for (const p of [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ]) {
    if (fs.existsSync(p)) { console.log("Edge gevonden:", p); return p; }
  }
  return null;
}

// HTML → PDF converteren en opslaan op NAS
app.post("/html-to-pdf", express.json({ limit: "8mb" }), async (req, res) => {
  const { html, pad, bestandsnaam } = req.body;
  if (!html || !pad || !bestandsnaam) return res.status(400).json({ error: "Ontbrekende velden" });

  const volledigeMap = path.join(UPLOAD_MAP, pad);
  try { fs.mkdirSync(volledigeMap, { recursive: true }); } catch {}
  const volledigPad = path.join(volledigeMap, bestandsnaam);

  const chromePath = vindChrome();
  if (!chromePath) {
    console.error("Geen Chrome gevonden in cache. Run: npx puppeteer browsers install chrome");
    return res.status(500).json({ error: "Chrome niet gevonden. Run: npx puppeteer browsers install chrome" });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: chromePath,
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
