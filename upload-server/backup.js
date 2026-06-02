// ── Gewoon bij Isolde — Automatische nachtelijke backup ──────────────────────
// Haalt alle data op uit Supabase en slaat het op als JSON op de NAS.
// Bewaart de laatste 90 dagen aan backups, oudere worden automatisch verwijderd.
//
// Wordt elke nacht om middernacht uitgevoerd via PM2 cron.

import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL  = "https://djueprzazwzwskdrqtgm.supabase.co";
const SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdWVwcnphend6d3NrZHJxdGdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzM3OTcsImV4cCI6MjA5NTkwOTc5N30.GvjNwW0yMQhGwaqdyeiLqlElhPQk3JMo0eix4Cd0nQw";
const UPLOAD_MAP    = process.env.UPLOAD_MAP || "C:\\nagelsalon\\bewijsstukken";
const BACKUP_MAP    = path.join(path.dirname(UPLOAD_MAP), "data-backups");
const BEWAAR_DAGEN  = 90;

async function backup() {
  const nu = new Date();
  const datum = nu.toISOString().slice(0, 10);
  const tijdstip = nu.toLocaleTimeString("nl-NL");
  console.log(`\n💾 Backup gestart: ${datum} ${tijdstip}`);

  // Haal data op uit Supabase
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/boekhouding?id=eq.1&select=data,updated_at`,
    { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
  );

  if (!res.ok) throw new Error(`Supabase fout: ${res.status}`);
  const rows = await res.json();
  if (!rows.length) throw new Error("Geen data gevonden in Supabase");

  const { data, updated_at } = rows[0];

  // Statistieken berekenen
  const stats = {
    inkomsten:   (data.inkomsten  || []).length,
    uitgaven:    (data.uitgaven   || []).length,
    klanten:     (data.klanten    || []).length,
    leveranciers:(data.leveranciers || []).length,
    kleuren:     (data.kleuren    || []).length,
    afspraken:   (data.afspraken  || []).length,
  };

  // Backup aanmaken
  fs.mkdirSync(BACKUP_MAP, { recursive: true });
  const bestandsnaam = `backup_${datum}.json`;
  const volledigPad = path.join(BACKUP_MAP, bestandsnaam);

  fs.writeFileSync(volledigPad, JSON.stringify({
    backup_datum:        nu.toISOString(),
    supabase_updated_at: updated_at,
    statistieken:        stats,
    data,
  }, null, 2), "utf8");

  console.log(`✓ Opgeslagen: ${volledigPad}`);
  console.log(`  Inhoud: ${stats.inkomsten} inkomsten · ${stats.uitgaven} uitgaven · ${stats.klanten} klanten · ${stats.afspraken} afspraken`);

  // Verwijder backups ouder dan BEWAAR_DAGEN
  const grens = new Date();
  grens.setDate(grens.getDate() - BEWAAR_DAGEN);
  let verwijderd = 0;

  for (const bestand of fs.readdirSync(BACKUP_MAP)) {
    if (!bestand.startsWith("backup_") || !bestand.endsWith(".json")) continue;
    const bestandDatum = new Date(bestand.replace("backup_", "").replace(".json", ""));
    if (bestandDatum < grens) {
      fs.unlinkSync(path.join(BACKUP_MAP, bestand));
      verwijderd++;
    }
  }

  if (verwijderd > 0) console.log(`  ${verwijderd} oude backup(s) opgeruimd`);
  console.log("✅ Backup voltooid!\n");
}

backup().catch(err => {
  console.error("❌ Backup mislukt:", err.message);
  process.exit(1);
});
