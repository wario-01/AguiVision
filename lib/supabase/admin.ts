import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isAdminConfigured = Boolean(url && serviceRoleKey);

// Este cliente ignora las políticas de seguridad (RLS) — tiene acceso total.
// SOLO se usa en rutas de servidor que reciben datos de un sistema externo
// de confianza (como el webhook de Mux), nunca para responder directamente
// a algo que pidió un usuario desde el navegador.
export function createAdminClient() {
  if (!url || !serviceRoleKey) return null;
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
