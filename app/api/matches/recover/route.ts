import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { mux, isMuxConfigured } from "@/lib/mux";

// POST /api/matches/recover
// json: { teamSlug, assetId, opponent, matchDate (YYYY-MM-DD) }
// Crea un partido nuevo y le cuelga un video que ya existe en Mux (por
// ejemplo, la grabación de una transmisión que no llegó a engancharse a
// ningún partido). Solo coach/assistant del equipo.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.teamSlug !== "string" ||
    typeof body.assetId !== "string" ||
    typeof body.opponent !== "string" ||
    !body.opponent.trim()
  ) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  const opponent = body.opponent.trim().slice(0, 100);

  const matchDate = new Date(`${body.matchDate}T12:00:00`);
  if (!body.matchDate || Number.isNaN(matchDate.getTime())) {
    return NextResponse.json({ error: "La fecha no es válida" }, { status: 400 });
  }

  if (!isMuxConfigured || !mux) {
    return NextResponse.json({ error: "Mux no está configurado" }, { status: 500 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: team } = await supabase.from("teams").select("id, slug").eq("slug", body.teamSlug).single();
  if (!team) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", team.id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (!membership || (membership.role !== "coach" && membership.role !== "assistant")) {
    return NextResponse.json({ error: "No tenés permiso en este equipo" }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  }

  // El video no puede estar ya colgado de otro partido ni ser un clip.
  const { data: alreadyMatch } = await admin
    .from("matches")
    .select("id")
    .eq("video_asset_id", body.assetId)
    .maybeSingle();
  const { data: alreadyClip } = await admin
    .from("highlights")
    .select("id")
    .eq("clip_asset_id", body.assetId)
    .maybeSingle();
  if (alreadyMatch || alreadyClip) {
    return NextResponse.json({ error: "Ese video ya está en un partido de la app" }, { status: 400 });
  }

  let asset: any;
  try {
    asset = await mux.video.assets.retrieve(body.assetId);
  } catch {
    return NextResponse.json({ error: "No encontré ese video en Mux" }, { status: 404 });
  }

  if (asset.status !== "ready") {
    return NextResponse.json({ error: "Ese video todavía no está listo en Mux" }, { status: 400 });
  }
  const playbackId = asset.playback_ids?.find((p: any) => p.policy === "public")?.id;
  if (!playbackId) {
    return NextResponse.json({ error: "Ese video no tiene reproducción pública" }, { status: 400 });
  }

  const { data: match, error } = await admin
    .from("matches")
    .insert({
      team_id: team.id,
      opponent,
      match_date: matchDate.toISOString(),
      video_status: "ready",
      video_asset_id: asset.id,
      video_playback_id: playbackId,
      duration_seconds: asset.duration ? Math.round(asset.duration) : null,
    })
    .select("id")
    .single();

  if (error || !match) {
    return NextResponse.json({ error: "No se pudo crear el partido" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, matchId: match.id, teamSlug: team.slug });
}
