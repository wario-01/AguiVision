import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/resend";

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

  const { data: team } = await supabase.from("teams").select("id, slug, name").eq("slug", teamSlug).single();
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

  // Avisarle por correo a todo el equipo (menos a quien lo creó).
  const { data: recipients } = await supabase
    .from("team_members")
    .select("profile_id, profiles(email)")
    .eq("team_id", team.id);

  const emails = (recipients ?? [])
    .filter((r: any) => r.profile_id !== userData.user!.id)
    .map((r: any) => r.profiles?.email)
    .filter((e: string | undefined): e is string => Boolean(e));

  if (emails.length > 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nidoaguilaatx.com";
    const type = formData.get("type") ?? "game";
    const what =
      type === "game"
        ? `partido vs ${formData.get("opponent") || "?"}`
        : (formData.get("title") as string) || "evento nuevo";
    const when = new Date(startAt).toLocaleString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
    });
    await sendEmail({
      to: emails,
      subject: `${team.name}: ${what}`,
      html: `
        <p>Se agregó un evento nuevo a ${team.name}: <b>${what}</b>.</p>
        <p>${when}</p>
        <p><a href="${appUrl}/${team.slug}/calendario">Ver el calendario en AguiVision</a></p>
      `,
    });
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
