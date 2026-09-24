import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// Devuelve null si todavía no se cargaron las variables de entorno —
// así el resto de la app puede seguir mostrando datos de ejemplo.
export function createClient() {
  if (!url || !anonKey) return null;
  return createBrowserClient(url, anonKey);
}
