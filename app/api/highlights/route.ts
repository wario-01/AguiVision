import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { mux, isMuxConfigured } from "@/lib/mux";

// POST /api/highlights
// body: { matchId, playerId, label, startSeconds, endSeconds }
//
// El jugador tiene que existir de antes (se crean solo invitando a un
// jugador o madre/padre desde "Equipo") — este endpoint ya no crea
// jugadores nuevos a partir de un nombre escrito acá.
//
// 1) busca el partido (necesita su video_asset_id — el video ya tiene que
//    estar "ready")
// 2) guarda la fila del highlight, apuntando al jugador elegido
// 3) le pide a Mux que corte ese pedazo del video como un clip propio —
//    el webhook (video.asset.ready) completa clip_playback_id cuando esté listo
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (
    !body?.matchId ||
    !body?.playerId ||
    !body?.label ||
    body?.startSeconds === undefined ||
    body?.endSeconds === undefined
  ) {
    return NextResponse.json({ error: "Faltan datos del highlight" }, { status: 400 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Modo demo: Supabase no está configurado." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: match } = await supabase
    .from("matches")
    .select("id, team_id, video_asset_id, video_status")
    .eq("id", body.matchId)
    .single();

  if (!match) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }
  if (match.video_status !== "ready" || !match.video_asset_id) {
    return NextResponse.json({ error: "El video de este partido todavía no está listo" }, { status: 400 });
  }

  // Confirma que el jugador elegido sea realmente de este equipo (y no de
  // otro, pasado por error o a propósito).
  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("id", body.playerId)
    .eq("team_id", match.team_id)
    .maybeSingle();

  if (!player) {
    return NextResponse.json({ error: "Ese jugador no pertenece a este equipo" }, { status: 400 });
  }

  const { data: highlight, error: highlightError } = await supabase
    .from("highlights")
    .insert({
      match_id: match.id,
      player_id: player.id,
      label: body.label,
      start_seconds: body.startSeconds,
      end_seconds: body.endSeconds,
    })
    .select("id")
    .single();

  if (highlightError || !highlight) {
    return NextResponse.json({ error: "No tenés permiso para crear highlights en este equipo" }, { status: 403 });
  }

  if (!isMuxConfigured || !mux) {
    return NextResponse.json({
      highlightId: highlight.id,
      note: "Highlight guardado. Falta conectar Mux para generar el clip.",
    });
  }

  // TODO: revisar el nombre exacto de estos campos contra la versión
  // instalada de @mux/mux-node si esta llamada da error de tipos — Mux
  // documenta esto a veces como "input"/"inputs" según la versión del SDK.
  const clipAsset = await mux.video.assets.create({
    input: [
      {
        url: `mux://assets/${match.video_asset_id}`,
        start_time: body.startSeconds,
        end_time: body.endSeconds,
      },
    ],
    playback_policy: ["public"],
    video_quality: "basic",
    // Habilita una copia .mp4 descargable del clip (casi gratis para clips
    // cortos — ver el análisis de costo que hicimos con el usuario).
    mp4_support: "capped-1080p",
    passthrough: `highlight:${highlight.id}`,
  } as any);

  await supabase.from("highlights").update({ clip_asset_id: (clipAsset as any).id }).eq("id", highlight.id);

  return NextResponse.json({ highlightId: highlight.id });
}

// DELETE /api/highlights
// body: { highlightId }
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.highlightId) {
    return NextResponse.json({ error: "Falta el id del highlight" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { data: highlight } = await supabase
    .from("highlights")
    .select("clip_asset_id")
    .eq("id", body.highlightId)
    .single();

  // borra la fila primero: si RLS lo rechaza (no sos coach/assistant de ese
  // equipo), no llegamos a tocar nada en Mux
  const { error } = await supabase.from("highlights").delete().eq("id", body.highlightId);
  if (error) {
    return NextResponse.json({ error: "No tenés permiso para borrar este highlight" }, { status: 403 });
  }

  if (isMuxConfigured && mux && highlight?.clip_asset_id) {
    try {
      await mux.video.assets.delete(highlight.clip_asset_id);
    } catch (err) {
      console.error("No se pudo borrar el clip en Mux:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
