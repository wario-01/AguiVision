import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// POST /api/events — crear
// form-data: teamSlug, type, title?, opponent?, league?, location?, startAt,
//            endAt?, notes?, opponentLogo? (archivo, opcional)
export async function POST(req: Request) {
  const formData = await req.formData();
  const teamSlug = formData.get("teamSlug");
  const startAt = formData.get("startAt");

  if (typeof teamSlug !== "string" || typeof startAt !== "string") {
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

  const { data: team } = await supabase.from("teams").select("id").eq("slug", teamSlug).single();
  if (!team) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  let opponentLogoUrl: string | null = null;
  const logoFile = formData.get("opponentLogo");
  if (logoFile instanceof File && logoFile.size > 0) {
    if (!isAdminConfigured) {
      return NextResponse.json({ error: "Falta configurar el almacenamiento" }, { status: 500 });
    }
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Falta configurar el almacenamiento" }, { status: 500 });
    }
    const ext = logoFile.name.split(".").pop() || "jpg";
    const path = `events/${team.id}-${Date.now()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("photos")
      .upload(path, logoFile, { contentType: logoFile.type, upsert: true });
    if (!uploadError) {
      const { data: publicUrl } = admin.storage.from("photos").getPublicUrl(path);
      opponentLogoUrl = publicUrl.publicUrl;
    }
  }

  // insert respeta RLS: solo entrenadores/asistentes de este equipo pueden crear
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      team_id: team.id,
      type: formData.get("type") ?? "game",
      title: formData.get("title") || null,
      opponent: formData.get("opponent") || null,
      opponent_logo_url: opponentLogoUrl,
      league: formData.get("league") || null,
      location: formData.get("location") || null,
      start_at: startAt,
      end_at: formData.get("endAt") || null,
      notes: formData.get("notes") || null,
    })
    .select("id")
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "No tenés permiso para agregar eventos a este equipo" }, { status: 403 });
  }

  return NextResponse.json({ id: event.id });
}

// DELETE /api/events
// body (JSON): { eventId }
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.eventId) {
    return NextResponse.json({ error: "Falta el id del evento" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { error } = await supabase.from("events").delete().eq("id", body.eventId);
  if (error) {
    return NextResponse.json({ error: "No tenés permiso para borrar este evento" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
