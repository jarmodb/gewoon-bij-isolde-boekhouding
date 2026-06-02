// ── Bewijsstukken opslag via Supabase Storage ─────────────────────────────
// Vervangt de oude WebDAV/NAS aanpak — geen port forwarding of NAS nodig.
// Bestanden worden opgeslagen in de Supabase bucket "bewijsstukken".
// Max bestandsgrootte: 10MB. Bewaartermijn: permanent (7+ jaar belasting OK).

import { supabase } from "./storage.js";

const BUCKET = "bewijsstukken";

export async function uploadNaarNAS(bestand, type, datum, bedrag) {
  const ext = bestand.name.split(".").pop().toLowerCase();
  const jaar = datum.slice(0, 4);
  const maand = datum.slice(5, 7);
  const bedragStr = String(bedrag).replace(".", "-");
  const uniek = Math.random().toString(36).slice(2, 7);
  const pad = `${jaar}/${maand}/${type}_${datum}_${bedragStr}euro_${uniek}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(pad, bestand, { contentType: bestand.type || "application/octet-stream" });

  if (error) throw new Error("Upload mislukt: " + error.message);
  return pad;
}

export function getBewijsstukUrl(pad) {
  if (!pad) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(pad);
  return data?.publicUrl || null;
}

// Leeg object — was nodig voor de NAS-instellingen weergave in Meer
export const WEBDAV_CONFIG = { url: "supabase-storage" };
