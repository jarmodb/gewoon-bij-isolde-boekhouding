// ── Bewijsstukken upload naar NUC via Tailscale Funnel ───────────────────────
// Config wordt opgeslagen in Supabase (sync naar alle apparaten) én localStorage (offline fallback).

export function getNucConfig() {
  try { return JSON.parse(localStorage.getItem("nuc_config") || "{}"); } catch { return {}; }
}

export function setNucConfig(config) {
  try { localStorage.setItem("nuc_config", JSON.stringify(config)); } catch {}
}

export async function uploadNaarNAS(bestand, type, datum, bedrag) {
  const { serverUrl, apiKey } = getNucConfig();

  if (!serverUrl || !apiKey) {
    throw new Error("NUC server nog niet ingesteld — vul de URL en API-key in via Meer → Bewijsstukken.");
  }

  const ext = bestand.name.split(".").pop().toLowerCase();
  const jaar = datum.slice(0, 4);
  const maand = datum.slice(5, 7);
  const bedragStr = String(bedrag).replace(".", "-");
  const uniek = Math.random().toString(36).slice(2, 7);
  const bestandsnaam = `${type}_${datum}_${bedragStr}euro_${uniek}.${ext}`;

  const formData = new FormData();
  formData.append("bestand", bestand);
  formData.append("pad", `${jaar}/${maand}`);
  formData.append("bestandsnaam", bestandsnaam);

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
  return `${serverUrl.replace(/\/$/, "")}/bestand/${pad}?key=${encodeURIComponent(apiKey)}`;
}

export const WEBDAV_CONFIG = {};
