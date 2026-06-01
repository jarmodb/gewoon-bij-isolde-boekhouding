// ── WebDAV NAS upload ─────────────────────────────────────────────────────────

export const WEBDAV_CONFIG = {
  // Thuis (snel, via wifi):
  urlThuis: "http://192.168.1.31:5005",
  // Buitenshuis (via QuickConnect):
  urlBuiten: "https://nas-jarmo.quickconnect.to:5006",
  gebruiker: "JOUW_SYNOLOGY_GEBRUIKER",   // ← vervang dit
  wachtwoord: "JOUW_SYNOLOGY_WACHTWOORD", // ← vervang dit
  map: "/nagelsalon/bewijsstukken",
};

function authHeader(gebruiker, wachtwoord) {
  return "Basic " + btoa(`${gebruiker}:${wachtwoord}`);
}

// Probeer thuis URL, val terug op buitenshuis URL
async function getBeschikbareUrl(config) {
  try {
    const r = await fetch(config.urlThuis + "/", {
      method: "OPTIONS",
      headers: { Authorization: authHeader(config.gebruiker, config.wachtwoord) },
      signal: AbortSignal.timeout(2000),
    });
    if (r.ok || r.status === 401 || r.status === 207) return config.urlThuis;
  } catch {}
  return config.urlBuiten;
}

async function maakMapAan(url, auth, pad) {
  try {
    await fetch(url + pad, {
      method: "MKCOL",
      headers: { Authorization: auth },
    });
  } catch {}
}

export async function uploadNaarNAS(bestand, type, datum, bedrag) {
  const { gebruiker, wachtwoord, map } = WEBDAV_CONFIG;

  if (gebruiker.includes("JOUW")) {
    throw new Error("WebDAV nog niet ingesteld — vul gebruikersnaam en wachtwoord in via Meer → NAS instellingen.");
  }

  const auth = authHeader(gebruiker, wachtwoord);
  const url = await getBeschikbareUrl(WEBDAV_CONFIG);

  const jaar = datum.slice(0, 4);
  const maand = datum.slice(5, 7);
  const basisMap = `${map}/${jaar}/${maand}`;

  await maakMapAan(url, auth, map);
  await maakMapAan(url, auth, `${map}/${jaar}`);
  await maakMapAan(url, auth, basisMap);

  const ext = bestand.name.split(".").pop().toLowerCase();
  const bedragStr = String(bedrag).replace(".", "-");
  const uniek = Math.random().toString(36).slice(2, 7);
  const bestandsnaam = `${type}_${datum}_${bedragStr}euro_${uniek}.${ext}`;
  const volledigPad = `${basisMap}/${bestandsnaam}`;

  const r = await fetch(url + volledigPad, {
    method: "PUT",
    headers: {
      Authorization: auth,
      "Content-Type": bestand.type || "application/octet-stream",
    },
    body: bestand,
  });

  if (!r.ok) throw new Error(`NAS upload mislukt (${r.status}). Controleer of WebDAV aanstaat.`);
  return volledigPad;
}
