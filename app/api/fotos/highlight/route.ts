import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { mux, isMuxConfigured } from "@/lib/mux";
import { isR2Configured, r2ViewUrl } from "@/lib/r2";

// POST /api/fotos/highlight
// body: { teamSlug, photoId, matchId, label, playerId?, shared?, notas? }
// Convierte un VIDEO de la galería en highlight: se manda a Mux (igual que los
// clips de partidos) y queda en la pantalla de Highlights del partido elegido.
// Solo entrenador/asistente.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!isSupabaseConfigured || !isR2Configured) {
    return NextResponse.json({ error: "El almacenamiento no está configurado" }, { status: 503 });
  }
  if (!isMuxConfigured || !mux) {
    return NextResponse.json({ error: "Falta conectar Mux para crear el highlight" }, { status: 503 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Tienes que iniciar sesión" }, { status: 401 });

  if (typeof body?.teamSlug !== "string" || typeof body?.photoId !== "string" || typeof body?.matchId !== "string") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : "";
  if (!label) return NextResponse.json({ error: "Escribe una etiqueta para el highlight" }, { status: 400 });
  const notas = typeof body.notas === "string" ? body.notas.trim().slice(0, 500) : "";
  const playerIdRaw = typeof body.playerId === "string" && body.playerId ? body.playerId : null;
  const shared = playerIdRaw === null ? true : body.shared === true;

  const { data: team } = await supabase.from("teams").select("id").eq("slug", body.teamSlug).single();
  if (!team) return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  const { data: me } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", team.id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!me || (me.role !== "coach" && me.role !== "assistant")) {
    return NextResponse.json({ error: "Solo el cuerpo técnico puede marcar highlights" }, { status: 403 });
  }

  const { data: photo } = await supabase
    .from("photos")
    .select("*")
    .eq("id", body.photoId)
    .eq("team_id", team.id)
    .maybeSingle();
  if (!photo || photo.kind !== "video") {
    return NextResponse.json({ error: "Ese archivo no es un video de la galería" }, { status: 404 });
  }
  if (photo.highlight_id) {
    return NextResponse.json({ error: "Este video ya es un highlight" }, { status: 409 });
  }
  const duration = Number(photo.duration_seconds) || 0;
  if (duration > 300) {
    return NextResponse.json(
      { error: `Los highlights duran máximo 5 minutos y este video dura ${Math.round(duration / 60)} min.` },
      { status: 400 }
    );
  }

  const { data: match } = await supabase
    .from("matches")
    .select("id")
    .eq("id", body.matchId)
    .eq("team_id", team.id)
    .maybeSingle();
  if (!match) return NextResponse.json({ error: "Partido no encontrado en este equipo" }, { status: 404 });
  if (playerIdRaw) {
    const { data: player } = await supabase
      .from("players")
      .select("id")
      .eq("id", playerIdRaw)
      .eq("team_id", team.id)
      .maybeSingle();
    if (!player) return NextResponse.json({ error: "Ese jugador no pertenece a este equipo" }, { status: 400 });
  }

  const { data: highlight, error: hlError } = await supabase
    .from("highlights")
    .insert({
      match_id: match.id,
      player_id: playerIdRaw,
      shared_with_team: shared,
      notas: notas || null,
      label,
      start_seconds: 0,
      end_seconds: Math.max(1, duration),
      source_photo_id: photo.id,
    })
    .select("id")
    .single();
  if (hlError || !highlight) {
    const missing = /source_photo_id/.test(hlError?.message ?? "");
    return NextResponse.json(
      { error: missing ? "Falta correr el SQL de videos en Supabase (fotos-4-videos.sql)." : "No se pudo crear el highlight" },
      { status: 500 }
    );
  }

  // Mux descarga el video desde un enlace temporal de Cloudflare y arma el clip.
  let assetId: string | null = null;
  try {
    const asset = await mux.video.assets.create({
      input: [{ url: r2ViewUrl(photo.r2_key) }],
      playback_policy: ["public"],
      video_quality: "basic",
      mp4_support: "capped-1080p",
      passthrough: `highlight:${highlight.id}`,
    } as any);
    assetId = (asset as any).id;
  } catch (err) {
    console.error("Mux no pudo procesar el video de la galería:", err);
  }

  const admin = isAdminConfigured ? createAdminClient() : null;
  if (!assetId || !admin) {
    // No dejamos un highlight vacío: se deshace.
    if (admin) await admin.from("highlights").delete().eq("id", highlight.id);
    return NextResponse.json({ error: "No se pudo enviar el video a Mux. Inténtalo de nuevo." }, { status: 502 });
  }
  await admin.from("highlights").update({ clip_asset_id: assetId }).eq("id", highlight.id);
  await admin.from("photos").update({ highlight_id: highlight.id }).eq("id", photo.id);

  return NextResponse.json({ ok: true, highlightId: highlight.id });
}
