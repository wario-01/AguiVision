import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// Devuelve null si Supabase todavía no está configurado — el resto de la
// app usa esto como señal para caer en los datos de ejemplo.
export async function createClient() {
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    global: {
      // Next.js cachea `fetch` por defecto en Server Components — sin esto,
      // podíamos seguir viendo datos viejos (nombre, equipos, etc.) durante
      // mucho tiempo aunque la base de datos ya esté actualizada.
      fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" }),
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Se puede llamar desde un Server Component, donde no se pueden
          // escribir cookies — el middleware se encarga de refrescar la sesión.
        }
      },
    },
  });
}
