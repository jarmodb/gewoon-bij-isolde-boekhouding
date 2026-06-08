// ── Bewijsstukken upload naar NUC via Tailscale Funnel ───────────────────────

export function getNucConfig() {
  try { return JSON.parse(localStorage.getItem("nuc_config") || "{}"); } catch { return {}; }
}
export function setNucConfig(config) {
  try { localStorage.setItem("nuc_config", JSON.stringify(config)); } catch {}
}

function schoonNaam(s) {
  return (s || "").trim()
    .replace(/[^a-zA-Z0-9À-ž\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 25);
}

export async function uploadNaarNAS(bestand, type, datum, bedrag, naam, omschrijving) {
  const { serverUrl, apiKey } = getNucConfig();
  if (!serverUrl || !apiKey) {
    throw new Error("NUC server nog niet ingesteld — vul de URL en API-key in via Meer → Bewijsstukken.");
  }

  const ext = bestand.name.split(".").pop().toLowerCase();
  const jaar = datum.slice(0, 4);
  const maand = datum.slice(5, 7);
  const bedragStr = Math.round(parseFloat(bedrag) || 0) + "euro";
  const uniek = Math.random().toString(36).slice(2, 6);

  // Bestandsnaam: 2026-06-01_inkomen_Marie-Jansen_Manicure_35euro_a1b2.jpg
  const delen = [datum, type, schoonNaam(naam), schoonNaam(omschrijving), bedragStr, uniek]
    .filter(Boolean).join("_");
  const bestandsnaam = `${delen}.${ext}`;

  const formData = new FormData();
  // Tekstvelden VOOR het bestand zodat multer ze beschikbaar heeft in de filename callback
  formData.append("pad", `${jaar}/${maand}`);
  formData.append("bestandsnaam", bestandsnaam);
  formData.append("bestand", bestand);

  const res = await fetch(`${serverUrl.replace(/\/$/, "")}/upload`, {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload mislukt (${res.status})`);
  }

  const data = await res.json();
  return data.pad;
}

export function getBewijsstukUrl(pad) {
  if (!pad) return null;
  const { serverUrl, apiKey } = getNucConfig();
  if (!serverUrl || !apiKey) return null;
  // API-key als query param zodat window.open() werkt
  return `${serverUrl.replace(/\/$/, "")}/bestand/${pad}?key=${encodeURIComponent(apiKey)}`;
}

// Link voor het delen van bewijsstukken met derden (bijv. de boekhouder).
// Gebruikt bij voorkeur een aparte alleen-lezen "viewer-sleutel" — die geeft
// nooit upload-rechten, in tegenstelling tot de gewone API-key. Is die niet
// ingesteld, dan valt de link terug op de normale API-key (werkt nog steeds,
// maar dan kan de ontvanger in theorie ook uploaden).
// Met `download = true` dwingt de link af dat het bestand wordt gedownload
// in plaats van direct geopend in de browser.
export function getDeelbareBewijsstukUrl(pad, download = false) {
  if (!pad) return null;
  const { serverUrl, viewerKey, apiKey } = getNucConfig();
  const sleutel = viewerKey || apiKey;
  if (!serverUrl || !sleutel) return null;
  const basis = `${serverUrl.replace(/\/$/, "")}/bestand/${pad}?key=${encodeURIComponent(sleutel)}`;
  return download ? `${basis}&download=1` : basis;
}

export const WEBDAV_CONFIG = {};
