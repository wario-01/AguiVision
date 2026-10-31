import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/resend";
import { checkImage } from "@/lib/imageUpload";
import { escapeHtml } from "@/lib/escapeHtml";

// POST /api/events — crear
// form-data: teamSlug, type, title?, opponent?, league?, location?, startAt,
//            endAt?, notes?, opponentLogo? (archivo, opcional),
//            parentEventId? (este evento es un juego dentro de un torneo),
//            repeatDates? (JSON: lista de fechas ISO — crea un evento por cada una,
//            todos con la misma serie; para entrenamientos que se repiten)
export async function POST(req: Request) {
  const formData = await req.formData();
  const teamSlug = formData.get("teamSlug");
  const startAt = formData.get("startAt");

  if (typeof teamSlug !== "string" || typeof startAt !== "string") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const typeRaw = formData.get("type") ?? "game";
  if (typeof typeRaw !== "string" || !["game", "practice", "tournament", "other"].includes(typeRaw)) {
    return NextResponse.json({ error: "Tipo de evento inválido" }, { status: 400 });
  }
  if (isNaN(Date.parse(startAt))) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  const endRaw = formData.get("endAt");
  if (typeof endRaw === "string" && endRaw && isNaN(Date.parse(endRaw))) {
    return NextResponse.json({ error: "Fecha de fin inválida" }, { status: 400 });
  }
  const txt = (k: string, max: number) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  };

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

  // Solo entrenador/asistente: se verifica ANTES de subir cualquier archivo.
  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", team.id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!membership || (membership.role !== "coach" && membership.role !== "assistant")) {
    return NextResponse.json({ error: "No tenés permiso para agregar eventos a este equipo" }, { status: 403 });
  }

  let opponentLogoUrl: string | null = null;
  const logoFile = formData.get("opponentLogo");
  if (logoFile instanceof File && logoFile.size > 0) {
    const image = checkImage(logoFile);
    if (!image.ok) {
      return NextResponse.json({ error: image.error }, { status: 400 });
    }
    if (!isAdminConfigured) {
      return NextResponse.json({ error: "Falta configurar el almacenamiento" }, { status: 500 });
    }
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Falta configurar el almacenamiento" }, { status: 500 });
    }
    const path = `events/${team.id}-${Date.now()}.${image.ext}`;
    const { error: uploadError } = await admin.storage
      .from("photos")
      .upload(path, logoFile, { contentType: logoFile.type, upsert: true });
    if (!uploadError) {
      const { data: publicUrl } = admin.storage.from("photos").getPublicUrl(path);
      opponentLogoUrl = publicUrl.publicUrl;
    }
  }

  // Juego dentro de un torneo: el torneo tiene que ser de este mismo equipo.
  let parentEventId: string | null = null;
  const parentRaw = formData.get("parentEventId");
  if (typeof parentRaw === "string" && parentRaw) {
    const { data: parent } = await supabase
      .from("events")
      .select("id, type, team_id")
      .eq("id", parentRaw)
      .maybeSingle();
    if (!parent || parent.team_id !== team.id || parent.type !== "tournament") {
      return NextResponse.json({ error: "Torneo no encontrado en este equipo" }, { status: 404 });
    }
    if (typeRaw !== "game") {
      return NextResponse.json({ error: "Dentro de un torneo solo se agregan juegos" }, { status: 400 });
    }
    parentEventId = parent.id;
  }

  // Eventos que se repiten (entrenamientos, etc.): una fecha ISO por cada día.
  let startList: string[] = [startAt];
  let seriesId: string | null = null;
  const repeatRaw = formData.get("repeatDates");
  if (typeof repeatRaw === "string" && repeatRaw) {
    let dates: unknown;
    try {
      dates = JSON.parse(repeatRaw);
    } catch {
      return NextResponse.json({ error: "Las fechas de repetición no son válidas" }, { status: 400 });
    }
    if (!Array.isArray(dates) || dates.length < 1 || dates.length > 120 || dates.some((d) => typeof d !== "string" || isNaN(Date.parse(d)))) {
      return NextResponse.json({ error: "Las fechas de repetición no son válidas (máximo 120)" }, { status: 400 });
    }
    if (typeRaw === "tournament" || typeRaw === "game") {
      return NextResponse.json({ error: "Solo se pueden repetir entrenamientos y otros eventos" }, { status: 400 });
    }
    startList = (dates as string[]).sort();
    seriesId = startList.length > 1 ? randomUUID() : null;
  }

  // insert respeta RLS: solo entrenadores/asistentes de este equipo pueden crear
  const rows = startList.map((start) => ({
    team_id: team.id,
    type: typeRaw,
    title: txt("title", 120),
    opponent: txt("opponent", 120),
    opponent_logo_url: opponentLogoUrl,
    league: txt("league", 160),
    location: txt("location", 200),
    start_at: start,
    end_at: typeof endRaw === "string" && endRaw && startList.length === 1 ? endRaw : null,
    notes: txt("notes", 1000),
    ...(parentEventId ? { parent_event_id: parentEventId } : {}),
    ...(seriesId ? { series_id: seriesId } : {}),
  }));
  const { data: inserted, error } = await supabase.from("events").insert(rows).select("id");
  const event = inserted?.[0];

  if (error || !event) {
    const missingColumn = /parent_event_id|series_id/.test(error?.message ?? "");
    return NextResponse.json(
      {
        error: missingColumn
          ? "Falta correr el SQL nuevo del calendario en Supabase (calendario-torneos-repeticion.sql)."
          : "No tenés permiso para agregar eventos a este equipo",
      },
      { status: missingColumn ? 500 : 403 }
    );
  }

  // Un juego dentro de un torneo no manda correo propio (el torneo ya avisó).
  if (parentEventId) return NextResponse.json({ id: event.id });

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
    const type = typeRaw;
    const what =
      type === "game"
        ? `partido vs ${txt("opponent", 120) || "?"}`
        : txt("title", 120) || "evento nuevo";
    const when = new Date(startList[0]).toLocaleString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Chicago",
    });
    const many = startList.length > 1;
    const lastDay = new Date(startList[startList.length - 1]).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      timeZone: "America/Chicago",
    });
    await sendEmail({
      to: emails,
      subject: `${team.name}: ${what}`,
      html: `
        <p>${many ? `Se agregaron ${startList.length} eventos a` : "Se agregó un evento nuevo a"} ${escapeHtml(team.name)}: <b>${escapeHtml(what)}</b>.</p>
        <p>${many ? `Desde el ${escapeHtml(when)} hasta el ${escapeHtml(lastDay)}.` : escapeHtml(when)}</p>
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

  // Si es parte de una serie que se repite y piden borrar toda la serie.
  let seriesId: string | null = null;
  if (body.series === true) {
    const { data: ev } = await supabase.from("events").select("series_id").eq("id", body.eventId).maybeSingle();
    seriesId = (ev as any)?.series_id ?? null;
  }
  const { data: deleted, error } = seriesId
    ? await supabase.from("events").delete().eq("series_id", seriesId).select("id")
    : await supabase.from("events").delete().eq("id", body.eventId).select("id");
  if (error || !deleted || deleted.length === 0) {
    return NextResponse.json({ error: "No tenés permiso para borrar este evento" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, deleted: deleted.length });
}

// PATCH /api/events — corregir un evento ya creado
// form-data: eventId, type, title?, opponent?, league?, location?, startAt, endAt?,
//            notes?, opponentLogo? (archivo nuevo, opcional), notify? ("1" = avisar por correo)
export async function PATCH(req: Request) {
  const formData = await req.formData();
  const eventId = formData.get("eventId");
  const startAt = formData.get("startAt");
  const typeRaw = formData.get("type");
  if (typeof eventId !== "string" || typeof startAt !== "string" || typeof typeRaw !== "string") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  if (!["game", "practice", "tournament", "other"].includes(typeRaw)) {
    return NextResponse.json({ error: "Tipo de evento inválido" }, { status: 400 });
  }
  if (isNaN(Date.parse(startAt))) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  const txt = (k: string, max: number) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  };

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }
  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", event.team_id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!membership || (membership.role !== "coach" && membership.role !== "assistant")) {
    return NextResponse.json({ error: "No tenés permiso para editar este evento" }, { status: 403 });
  }

  let opponentLogoUrl: string | null = event.opponent_logo_url ?? null;
  const logoFile = formData.get("opponentLogo");
  if (logoFile instanceof File && logoFile.size > 0) {
    const image = checkImage(logoFile);
    if (!image.ok) {
      return NextResponse.json({ error: image.error }, { status: 400 });
    }
    const admin = isAdminConfigured ? createAdminClient() : null;
    if (!admin) {
      return NextResponse.json({ error: "Falta configurar el almacenamiento" }, { status: 500 });
    }
    const path = `events/${event.team_id}-${Date.now()}.${image.ext}`;
    const { error: uploadError } = await admin.storage
      .from("photos")
      .upload(path, logoFile, { contentType: logoFile.type, upsert: true });
    if (!uploadError) {
      opponentLogoUrl = admin.storage.from("photos").getPublicUrl(path).data.publicUrl;
    }
  }

  const endRaw = formData.get("endAt");
  // Cancelar / reactivar. Solo se toca la columna si se cancela o ya estaba cancelado
  // (así editar sigue funcionando aunque todavía no se haya corrido el SQL).
  const cancelledNow = formData.get("cancelled") === "1";
  const wasCancelled = (event as any).cancelled === true;
  const cancelFields =
    cancelledNow || wasCancelled
      ? { cancelled: cancelledNow, cancel_reason: cancelledNow ? txt("cancelReason", 300) : null }
      : {};
  const { data: updated, error } = await supabase
    .from("events")
    .update({
      type: typeRaw,
      title: txt("title", 120),
      opponent: txt("opponent", 120),
      opponent_logo_url: opponentLogoUrl,
      league: txt("league", 160),
      location: txt("location", 200),
      start_at: startAt,
      end_at: typeof endRaw === "string" && endRaw && !isNaN(Date.parse(endRaw)) ? endRaw : null,
      notes: txt("notes", 1000),
      ...cancelFields,
    })
    .eq("id", event.id)
    .select("id");
  if (error && /cancel/.test(error.message ?? "")) {
    return NextResponse.json(
      { error: "Falta correr el SQL de eventos cancelados en Supabase (calendario-cancelado.sql)." },
      { status: 500 }
    );
  }
  if (error || !updated || updated.length === 0) {
    return NextResponse.json({ error: "No tenés permiso para editar este evento" }, { status: 403 });
  }

  if (formData.get("notify") === "1") {
    const { data: team } = await supabase.from("teams").select("slug, name").eq("id", event.team_id).single();
    const { data: recipients } = await supabase
      .from("team_members")
      .select("profile_id, profiles(email)")
      .eq("team_id", event.team_id);
    const emails = (recipients ?? [])
      .filter((r: any) => r.profile_id !== userData.user!.id)
      .map((r: any) => r.profiles?.email)
      .filter((e: string | undefined): e is string => Boolean(e));
    if (team && emails.length > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nidoaguilaatx.com";
      const what = typeRaw === "game" ? `partido vs ${txt("opponent", 120) || "?"}` : txt("title", 120) || "evento";
      const when = new Date(startAt).toLocaleString("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Chicago",
      });
      const newlyCancelled = cancelledNow && !wasCancelled;
      const reason = txt("cancelReason", 300);
      await sendEmail({
        to: emails,
        subject: newlyCancelled ? `${team.name}: SE CANCELÓ ${what}` : `${team.name}: se actualizó ${what}`,
        html: newlyCancelled
          ? `
          <p>Se canceló un evento de ${escapeHtml(team.name)}: <b>${escapeHtml(what)}</b>.</p>
          <p>Era el ${escapeHtml(when)}</p>
          ${reason ? `<p>Motivo: ${escapeHtml(reason)}</p>` : ""}
          <p><a href="${appUrl}/${team.slug}/calendario">Ver el calendario en AguiVision</a></p>
        `
          : `
          <p>Se actualizó un evento de ${escapeHtml(team.name)}: <b>${escapeHtml(what)}</b>.</p>
          <p>Ahora: ${escapeHtml(when)}</p>
          <p><a href="${appUrl}/${team.slug}/calendario">Ver el calendario en AguiVision</a></p>
        `,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
