import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { builtinTrack } from "@/lib/music-library";

// PATCH { highlightId, trackId: string | null, volume: 0..1 }
// Elige (o quita) la música de fondo de un highlight. Solo entrenador/asistente.
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.highlightId !== "string") return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  const trackId = typeof body.trackId === "string" ? body.trackId : null;
  const volume = Math.max(0, Math.min(1, Number(body.volume)));
  if (!Number.isFinite(volume)) return NextResponse.json({ error: "Volumen inválido" }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Tienes que iniciar sesión" }, { status: 401 });

  const { data: hl } = await supabase
    .from("highlights")
    .select("id, matches!inner(team_id)")
    .eq("id", body.highlightId)
    .maybeSingle();
  const teamId = (hl as any)?.matches?.team_id as string | undefined;
  if (!hl || !teamId) return NextResponse.json({ error: "Highlight no encontrado" }, { status: 404 });
  const { data: me } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!me || (me.role !== "coach" && me.role !== "assistant")) {
    return NextResponse.json({ error: "Solo el cuerpo técnico puede cambiar la música" }, { status: 403 });
  }
  const admin = isAdminConfigured ? createAdminClient() : null;
  if (!admin) return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });

  if (trackId && !builtinTrack(trackId)) {
    const { data: t } = await admin.from("music_tracks").select("id").eq("id", trackId).eq("team_id", teamId).maybeSingle();
    if (!t) return NextResponse.json({ error: "Canción no encontrada en este equipo" }, { status: 404 });
  }
  const { error } = await admin
    .from("highlights")
    .update({ music_id: trackId, music_volume: Math.round(volume * 100) / 100 })
    .eq("id", hl.id);
  if (error) {
    const missing = /music_/.test(error.message ?? "");
    return NextResponse.json(
      { error: missing ? "Falta correr el SQL de música en Supabase (highlights-musica.sql)." : "No se pudo guardar la música" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
