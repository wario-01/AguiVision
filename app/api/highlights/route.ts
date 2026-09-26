import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { mux, isMuxConfigured } from "@/lib/mux";

// POST /api/highlights
// body: { matchId, playerName, label, startSeconds, endSeconds }
//
// 1) busca el partido (necesita su video_asset_id — el video ya tiene que
//    estar "ready")
// 2) busca un jugador con ese nombre en el equipo, o lo crea si es la
//    primera vez que se lo nombra (así no hace falta una pantalla aparte
//    de "cargar plantel" para empezar a usar esto)
// 3) guarda la fila del highlight
// 4) le pide a Mux que corte ese pedazo del video como un clip propio —
//    el webhook (video.asset.ready) completa clip_playback_id cuando esté listo
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (
    !body?.matchId ||
    !body?.playerName ||
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

  // Buscar o crear el jugador dentro del equipo (respeta RLS: solo funciona
  // si el usuario es coach/assistant de este equipo)
  let playerId: string;
  const { data: existingPlayer } = await supabase
    .from("players")
    .select("id")
    .eq("team_id", match.team_id)
    .eq("full_name", body.playerName)
    .maybeSingle();

  if (existingPlayer) {
    playerId = existingPlayer.id;
  } else {
    const { data: newPlayer, error: playerError } = await supabase
      .from("players")
      .insert({ team_id: match.team_id, full_name: body.playerName })
      .select("id")
      .single();
    if (playerError || !newPlayer) {
      return NextResponse.json({ error: "No tenés permiso para agregar jugadores a este equipo" }, { status: 403 });
    }
    playerId = newPlayer.id;
  }

  const { data: highlight, error: highlightError } = await supabase
    .from("highlights")
    .insert({
      match_id: match.id,
      player_id: playerId,
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
  await mux.video.assets.create({
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

  return NextResponse.json({ highlightId: highlight.id });
}
