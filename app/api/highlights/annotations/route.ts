import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { cleanAnnotations, MAX_ANNOS } from "@/lib/annotations";
import { cleanTrack } from "@/lib/camera-track";

// PATCH /api/highlights/annotations
// body: { highlightId, annotations?: Anno[], camTrack?: CamTrack | null }
// Guarda los dibujos y/o el movimiento de cámara medido de un highlight. Solo entrenador/asistente del equipo.
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const hasAnnos = Array.isArray(body?.annotations);
  const hasTrack = body && "camTrack" in body;
  if (!body || typeof body.highlightId !== "string" || (!hasAnnos && !hasTrack)) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  if (hasAnnos && body.annotations.length > MAX_ANNOS) {
    return NextResponse.json({ error: `Máximo ${MAX_ANNOS} dibujos por highlight` }, { status: 400 });
  }
  const annotations = hasAnnos ? cleanAnnotations(body.annotations) : [];
  const camTrack = hasTrack ? cleanTrack(body.camTrack) : null;
  if (hasTrack && body.camTrack !== null && !camTrack) {
    return NextResponse.json({ error: "El movimiento de cámara no es válido" }, { status: 400 });
  }

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
    return NextResponse.json({ error: "Solo el cuerpo técnico puede dibujar sobre un highlight" }, { status: 403 });
  }

  const admin = isAdminConfigured ? createAdminClient() : null;
  if (!admin) return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  if (hasTrack) {
    const { error: te } = await admin.from("highlights").update({ cam_track: camTrack }).eq("id", hl.id);
    if (te) {
      const missing = /cam_track/.test(te.message ?? "");
      return NextResponse.json(
        { error: missing ? "Falta correr el SQL de cámara en Supabase (highlights-camara.sql)." : "No se pudo guardar el movimiento de cámara" },
        { status: 500 }
      );
    }
    if (!hasAnnos) return NextResponse.json({ ok: true });
  }
  const { error } = await admin.from("highlights").update({ annotations }).eq("id", hl.id);
  if (error) {
    const missing = /annotations/.test(error.message ?? "");
    return NextResponse.json(
      { error: missing ? "Falta correr el SQL de dibujos en Supabase (highlights-dibujos.sql)." : "No se pudieron guardar los dibujos" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, count: annotations.length });
}
