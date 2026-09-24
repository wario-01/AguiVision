import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

// POST /api/upload
// body: { teamSlug, opponent, fileName }
//
// Lo que este endpoint hace hoy:
//   1) valida la entrada
//   2) confirma que quien llama esté logueado y sea coach/assistant de ese equipo
//      (las políticas RLS de Supabase también lo exigen del lado de la base de datos)
//   3) crea la fila en `matches` con video_status='uploading'
// Lo que falta conectar (elegir Mux o Cloudflare Stream, ver el roadmap de costos):
//   4) pedirle al proveedor de video una "direct upload URL" y devolverla al cliente
//      - Mux: POST https://api.mux.com/video/v1/uploads
//      - Cloudflare Stream: POST /accounts/{id}/stream/direct_upload
//   5) guardar el asset_id que devuelve el proveedor en matches.video_asset_id
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.teamSlug || !body?.opponent) {
    return NextResponse.json({ error: "Faltan datos del partido" }, { status: 400 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({
      uploadUrl: null,
      note: "Modo demo: Supabase no está configurado, no se guardó nada.",
    });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("slug", body.teamSlug)
    .single();

  if (!team) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  // insert respeta RLS: solo inserta si el usuario es coach/assistant de este equipo
  const { error } = await supabase.from("matches").insert({
    team_id: team.id,
    opponent: body.opponent,
    match_date: new Date().toISOString(),
    video_status: "uploading",
  });

  if (error) {
    return NextResponse.json({ error: "No tenés permiso para subir video a este equipo" }, { status: 403 });
  }

  // TODO: reemplazar por la URL de subida directa real del proveedor de video.
  return NextResponse.json({ uploadUrl: null, note: "Partido creado. Proveedor de video no conectado todavía." });
}
