// v2.1
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://djueprzazwzwskdrqtgm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdWVwcnphend6d3NrZHJxdGdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzM3OTcsImV4cCI6MjA5NTkwOTc5N30.GvjNwW0yMQhGwaqdyeiLqlElhPQk3JMo0eix4Cd0nQw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TABLE = "boekhouding";
const ROW_ID = 1;

export async function loadAll() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("id", ROW_ID)
    .single();

  if (error) {
    console.error("Supabase laden mislukt:", error);
    try { return JSON.parse(localStorage.getItem("nagelsalon_backup") || "{}"); } catch { return {}; }
  }

  const result = data?.data || {};
  try { localStorage.setItem("nagelsalon_backup", JSON.stringify(result)); } catch {}
  return result;
}

export async function saveAll(appData) {
  try { localStorage.setItem("nagelsalon_backup", JSON.stringify(appData)); } catch {}

  const { error } = await supabase
    .from(TABLE)
    .upsert({ id: ROW_ID, data: appData, updated_at: new Date().toISOString() });

  if (error) {
    console.error("Supabase opslaan mislukt:", error);
    throw error;
  }
}

// Realtime-abonnement — callback(newData) bij update door ander apparaat.
// Geeft een unsubscribe-functie terug.
export function subscribeToChanges(callback) {
  const channel = supabase
    .channel("boekhouding_realtime")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: TABLE, filter: `id=eq.${ROW_ID}` },
      (payload) => callback(payload.new?.data ?? {})
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
