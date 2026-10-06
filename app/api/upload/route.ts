import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { mux, isMuxConfigured } from "@/lib/mux";

// POST /api/upload
// body: { teamSlug, opponent }
//
// 1) confirma que quien llama esté logueado y sea coach/assistant de ese equipo
//    (las políticas RLS de Supabase también lo exigen del lado de la base de datos)
// 2) crea la fila en `matches` con video_status='uploading'
// 3) si Mux está conectado, le pide una URL de subida directa y la devuelve
//    para que el navegador suba el archivo ahí mismo (el archivo nunca pasa
//    por nuestro propio servidor)
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
  const { data: match, error: insertError } = await supabase
    .from("matches")
    .insert({
      team_id: team.id,
      opponent: body.opponent,
      match_date: new Date().toISOString(),
      video_status: "uploading",
    })
    .select("id")
    .single();

  if (insertError || !match) {
    return NextResponse.json({ error: "No tenés permiso para subir video a este equipo" }, { status: 403 });
  }

  if (!isMuxConfigured || !mux) {
    return NextResponse.json({
      uploadUrl: null,
      matchId: match.id,
      note: "Partido creado. Falta conectar Mux (variables MUX_TOKEN_ID / MUX_TOKEN_SECRET).",
    });
  }

  // El "passthrough" es cómo le decimos a Mux "este video es de este partido" —
  // vuelve intacto en el evento del webhook cuando el video esté listo.
  const upload = await mux.video.uploads.create({
    cors_origin: process.env.NEXT_PUBLIC_APP_URL || "*",
    new_asset_settings: {
      playback_policy: ["public"],
      video_quality: "basic",
      // Copia .mp4 descargable (botón "Descargar partido").
      mp4_support: "capped-1080p",
      passthrough: `match:${match.id}`,
    } as any,
  });

  await supabase.from("matches").update({ video_asset_id: upload.id }).eq("id", match.id);

  return NextResponse.json({ uploadUrl: upload.url, matchId: match.id });
}
