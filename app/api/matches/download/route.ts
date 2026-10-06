import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// POST /api/matches/download   json: { matchId }
// Activa en Mux la copia .mp4 descargable de un partido (los partidos viejos
// no la tienen) y devuelve el enlace de descarga. Solo coach/assistant.
// Si el archivo se acaba de activar, puede tardar unos minutos en estar listo.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.matchId !== "string") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  }

  const { data: match } = await admin
    .from("matches")
    .select("id, team_id, opponent, match_date, video_asset_id, video_playback_id, video_status")
    .eq("id", body.matchId)
    .maybeSingle();
  if (!match) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  const { data: membership } = await admin
    .from("team_members")
    .select("role")
    .eq("team_id", match.team_id)
    .eq("profile_id", userData.user.id);
  const isStaff = (membership ?? []).some((m) => m.role === "coach" || m.role === "assistant");
  if (!isStaff) {
    return NextResponse.json({ error: "No tenés permiso" }, { status: 403 });
  }

  if (match.video_status !== "ready" || !match.video_asset_id || !match.video_playback_id) {
    return NextResponse.json({ error: "Este partido no tiene video disponible" }, { status: 400 });
  }

  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    return NextResponse.json({ error: "Mux no está configurado" }, { status: 500 });
  }

  // Activar la copia .mp4 (si ya estaba activa, Mux simplemente la deja igual).
  const auth = Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64");
  const res = await fetch(`https://api.mux.com/video/v1/assets/${match.video_asset_id}/mp4-support`, {
    method: "PUT",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ mp4_support: "capped-1080p" }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Mux mp4-support falló", res.status, text);
    return NextResponse.json({ error: "No se pudo preparar la descarga" }, { status: 502 });
  }

  const name = `${match.opponent}-${match.match_date}`.replace(/[^\w\-]+/g, "_");
  return NextResponse.json({
    ok: true,
    url: `https://stream.mux.com/${match.video_playback_id}/capped-1080p.mp4?download=${encodeURIComponent(name)}`,
  });
}
