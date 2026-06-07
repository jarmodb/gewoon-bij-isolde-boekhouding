// ── Gewoon bij Isolde — Google Agenda-feed (.ics) ───────────────────────────
// Vercel serverless function. Genereert een live iCalendar-feed (afspraken +
// geblokkeerde dagen) op basis van de planning-data in Supabase.
//
// URL:  https://<jouw-site>.vercel.app/api/agenda?token=<AGENDA_TOKEN>
//
// Eenmalig instellen:
//  1. Zet in de Vercel-projectinstellingen (Settings → Environment Variables)
//     een variabele AGENDA_TOKEN met een zelfbedacht geheim wachtwoord.
//  2. Vul datzelfde token in via de app: Meer → "Koppeling met Google Agenda".
//  3. Abonneer Google Agenda op de link die de app dan toont.
//
// Geen NUC of eigen server nodig — dit draait automatisch mee met elke deploy.

const SUPABASE_URL = "https://djueprzazwzwskdrqtgm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdWVwcnphend6d3NrZHJxdGdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzM3OTcsImV4cCI6MjA5NTkwOTc5N30.GvjNwW0yMQhGwaqdyeiLqlElhPQk3JMo0eix4Cd0nQw";

const pad2 = (n) => String(n).padStart(2, "0");

function formatIcsUtc(d) {
  return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate())
    + "T" + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + "Z";
}

// Zet "2026-06-07" + "10:00" (Europe/Amsterdam, lokale tijd zoals in de planning
// is ingevoerd) om naar het juiste UTC-tijdstip — werkt correct over de
// zomer-/wintertijdgrens heen, ongeacht de tijdzone van de server zelf.
function lokaalNaarUtc(datumStr, tijdStr) {
  const [j, m, d] = datumStr.split("-").map(Number);
  const [u, mi] = tijdStr.split(":").map(Number);

  const gok = Date.UTC(j, m - 1, d, u, mi, 0);

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const onderdelen = fmt.formatToParts(new Date(gok))
    .reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  // Hoe laat zou het in Amsterdam zijn op moment "gok" (als UTC-tijdstip)?
  const amsterdamAlsUtc = Date.UTC(
    +onderdelen.year, +onderdelen.month - 1, +onderdelen.day,
    +onderdelen.hour, +onderdelen.minute, +onderdelen.second
  );
  const offsetMs = amsterdamAlsUtc - gok; // verschil Amsterdam t.o.v. UTC
  return new Date(gok - offsetMs);
}

// "2026-06-07" → "20260607" (voor hele-dag-events)
const naarIcsDatum = (datumStr) => datumStr.replace(/-/g, "");

// Volgende kalenderdag als "YYYY-MM-DD" (DTEND bij hele-dag-events is exclusief).
// Pure UTC-datumberekening, dus onafhankelijk van de servertijdzone.
function volgendeDag(datumStr) {
  const [j, m, d] = datumStr.split("-").map(Number);
  const volgende = new Date(Date.UTC(j, m - 1, d) + 24 * 60 * 60 * 1000);
  return volgende.getUTCFullYear() + "-" + pad2(volgende.getUTCMonth() + 1) + "-" + pad2(volgende.getUTCDate());
}

// Speciale tekens escapen volgens RFC 5545
function icsEscape(str) {
  return String(str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

module.exports = async (req, res) => {
  const AGENDA_TOKEN = process.env.AGENDA_TOKEN;

  if (!AGENDA_TOKEN) {
    res.status(500).send("AGENDA_TOKEN is niet ingesteld in de Vercel-projectinstellingen.");
    return;
  }
  if (req.query.token !== AGENDA_TOKEN) {
    res.status(401).send("Ongeldig token");
    return;
  }

  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/boekhouding?id=eq.1&select=data`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!resp.ok) throw new Error(`Supabase gaf status ${resp.status}`);
    const rows = await resp.json();
    const data = rows?.[0]?.data || {};
    const afspraken   = Array.isArray(data.afspraken)   ? data.afspraken   : [];
    const geblokkeerd = Array.isArray(data.geblokkeerd) ? data.geblokkeerd : [];

    const nu = formatIcsUtc(new Date());

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
        const start = lokaalNaarUtc(a.datum, a.tijdstip);
        const eind = new Date(start.getTime() + (Number(a.duurMinuten) || 60) * 60000);
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
          `DTSTART:${formatIcsUtc(start)}`,
          `DTEND:${formatIcsUtc(eind)}`,
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

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "inline; filename=\"gewoon-bij-isolde-planning.ics\"");
    res.status(200).send(regels.filter(Boolean).join("\r\n"));
  } catch (e) {
    console.error("Agenda-feed genereren mislukt:", e.message);
    res.status(500).send("Agenda-feed genereren mislukt");
  }
};
