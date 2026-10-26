import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isR2Configured, r2DownloadUrl, r2ViewUrl } from "@/lib/r2";

// POST /api/fotos/descargar
// body: { ids: string[] }  → { items: [{ id, file_name, url }] }
// Devuelve enlaces temporales (1 hora) para descargar las fotos en su calidad
// original. La base de datos (RLS) decide cuáles puede ver quien pregunta.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!isSupabaseConfigured || !isR2Configured) {
    return NextResponse.json({ error: "El almacenamiento de fotos no está configurado" }, { status: 503 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });

  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string").slice(0, 200) : [];
  if (ids.length === 0) return NextResponse.json({ error: "No hay fotos elegidas" }, { status: 400 });

  const { data, error } = await supabase.from("photos").select("id, file_name, r2_key").in("id", ids);
  if (error) return NextResponse.json({ error: "No se pudieron leer las fotos" }, { status: 500 });

  const inline = body?.inline === true; // para zip en el navegador (sin forzar descarga)
  return NextResponse.json({
    items: (data ?? []).map((p) => ({
      id: p.id,
      file_name: p.file_name,
      url: inline ? r2ViewUrl(p.r2_key) : r2DownloadUrl(p.r2_key, p.file_name),
    })),
  });
}
