import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { mux, isMuxConfigured } from "@/lib/mux";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/resend";
import { escapeHtml } from "@/lib/escapeHtml";

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
    !body?.label ||
    body?.startSeconds === undefined ||
    body?.endSeconds === undefined
  ) {
    return NextResponse.json({ error: "Faltan datos del highlight" }, { status: 400 });
  }

  // Sin jugador = highlight de todo el equipo (siempre queda compartido).
  const playerIdRaw = typeof body.playerId === "string" && body.playerId ? body.playerId : null;
  const shared = playerIdRaw === null ? true : body.shared === true;
  const notas = typeof body.notas === "string" ? body.notas.trim().slice(0, 500) : "";
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : "";
  const start = Number(body.startSeconds);
  const end = Number(body.endSeconds);
  if (!label || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end - start > 300) {
    return NextResponse.json({ error: "Tiempos o etiqueta inválidos (máximo 5 minutos por clip)" }, { status: 400 });
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
  let player: { id: string; full_name: string } | null = null;
  if (playerIdRaw) {
    const { data } = await supabase
      .from("players")
      .select("id, full_name")
      .eq("id", playerIdRaw)
      .eq("team_id", match.team_id)
      .maybeSingle();
    if (!data) {
      return NextResponse.json({ error: "Ese jugador no pertenece a este equipo" }, { status: 400 });
    }
    player = data;
  }

  const { data: highlight, error: highlightError } = await supabase
    .from("highlights")
    .insert({
      match_id: match.id,
      player_id: player?.id ?? null,
      shared_with_team: shared,
      notas: notas || null,
      label,
      start_seconds: start,
      end_seconds: end,
    })
    .select("id")
    .single();

  if (highlightError || !highlight) {
    return NextResponse.json({ error: "No tenés permiso para crear highlights en este equipo" }, { status: 403 });
  }

  // Avisos por correo: si el highlight es de un jugador, a su madre/padre (o
  // al jugador); si es de todo el equipo (sin jugador), a todo el equipo.
  // Si el correo falla, no afecta el resto: el highlight ya quedó guardado.
  const { data: team } = await supabase.from("teams").select("slug, name").eq("id", match.team_id).single();
  let recipientsQuery = supabase
    .from("team_members")
    .select("profile_id, profiles(email)")
    .eq("team_id", match.team_id);
  recipientsQuery = player
    ? recipientsQuery.eq("player_id", player.id).in("role", ["player", "parent"])
    : recipientsQuery;
  const { data: recipients } = await recipientsQuery;

  const emails = (recipients ?? [])
    .filter((r: any) => r.profile_id !== userData.user!.id)
    .map((r: any) => r.profiles?.email)
    .filter((e: string | undefined): e is string => Boolean(e));

  if (emails.length > 0 && team) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nidoaguilaatx.com";
    const who = player ? player.full_name : team.name;
    await sendEmail({
      to: emails,
      subject: `Nuevo highlight de ${who} — ${label}`,
      html: `
        <p>Hay un highlight nuevo de <b>${escapeHtml(who)}</b> (${escapeHtml(team.name)}): <b>${escapeHtml(label)}</b>.</p>
        ${notas ? `<p>${escapeHtml(notas)}</p>` : ""}
        <p><a href="${appUrl}/${team.slug}/highlights/${highlight.id}">Ver el highlight en AguiVision</a></p>
      `,
    });
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
        start_time: start,
        end_time: end,
      },
    ],
    playback_policy: ["public"],
    video_quality: "basic",
    // Habilita una copia .mp4 descargable del clip (casi gratis para clips
    // cortos — ver el análisis de costo que hicimos con el usuario).
    mp4_support: "capped-1080p",
    passthrough: `highlight:${highlight.id}`,
  } as any);

  // No existe política de UPDATE en highlights para el cliente normal, por eso
  // se guarda con el cliente de servicio (la autorización ya se verificó arriba).
  const adminForClip = isAdminConfigured ? createAdminClient() : null;
  if (adminForClip) {
    await adminForClip.from("highlights").update({ clip_asset_id: (clipAsset as any).id }).eq("id", highlight.id);
  }

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
  const { data: deleted, error } = await supabase
    .from("highlights")
    .delete()
    .eq("id", body.highlightId)
    .select("id");
  if (error || !deleted || deleted.length === 0) {
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

// PATCH /api/highlights
// body: { highlightId, label, playerId|null, shared, notas, startSeconds, endSeconds }
// Solo entrenador/asistente del equipo. Si cambian los tiempos se genera un clip
// nuevo en Mux y se borra el anterior; lo demás (etiqueta, nota, jugador,
// compartido) se corrige al instante.
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.highlightId || !body?.label || body?.startSeconds === undefined || body?.endSeconds === undefined) {
    return NextResponse.json({ error: "Faltan datos del highlight" }, { status: 400 });
  }
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : "";
  const start = Number(body.startSeconds);
  const end = Number(body.endSeconds);
  if (!label || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end - start > 300) {
    return NextResponse.json({ error: "Tiempos o etiqueta inválidos (máximo 5 minutos por clip)" }, { status: 400 });
  }
  const playerIdRaw = typeof body.playerId === "string" && body.playerId ? body.playerId : null;
  const shared = playerIdRaw === null ? true : body.shared === true;
  const notas = typeof body.notas === "string" ? body.notas.trim().slice(0, 500) : "";

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: hl } = await supabase
    .from("highlights")
    .select("*, matches(team_id, video_asset_id, video_status)")
    .eq("id", body.highlightId)
    .maybeSingle();
  const match = (hl as any)?.matches as { team_id: string; video_asset_id: string | null; video_status: string } | undefined;
  if (!hl || !match) {
    return NextResponse.json({ error: "Highlight no encontrado" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", match.team_id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!membership || (membership.role !== "coach" && membership.role !== "assistant")) {
    return NextResponse.json({ error: "No tenés permiso para editar este highlight" }, { status: 403 });
  }

  if (playerIdRaw) {
    const { data: player } = await supabase
      .from("players")
      .select("id")
      .eq("id", playerIdRaw)
      .eq("team_id", match.team_id)
      .maybeSingle();
    if (!player) {
      return NextResponse.json({ error: "Ese jugador no pertenece a este equipo" }, { status: 400 });
    }
  }

  const admin = isAdminConfigured ? createAdminClient() : null;
  if (!admin) {
    return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  }

  const update: Record<string, unknown> = {
    label,
    player_id: playerIdRaw,
    shared_with_team: shared,
    notas: notas || null,
  };

  // Si cambian los tiempos, se corta un clip nuevo (primero el nuevo, así si
  // falla no se pierde el que ya existía).
  const timesChanged = start !== hl.start_seconds || end !== hl.end_seconds;
  if (timesChanged && (hl as any).source_photo_id) {
    return NextResponse.json(
      { error: "Este highlight viene de un video de la galería: sus tiempos no se pueden cambiar (la etiqueta, la nota y el jugador sí)." },
      { status: 400 }
    );
  }
  let oldAssetId: string | null = null;
  if (timesChanged) {
    if (!isMuxConfigured || !mux || match.video_status !== "ready" || !match.video_asset_id) {
      return NextResponse.json(
        { error: "No se pueden cambiar los tiempos: el video completo de este partido ya no está disponible" },
        { status: 400 }
      );
    }
    const clipAsset = await mux.video.assets.create({
      input: [{ url: `mux://assets/${match.video_asset_id}`, start_time: start, end_time: end }],
      playback_policy: ["public"],
      video_quality: "basic",
      mp4_support: "capped-1080p",
      passthrough: `highlight:${hl.id}`,
    } as any);
    oldAssetId = hl.clip_asset_id ?? null;
    update.start_seconds = start;
    update.end_seconds = end;
    update.clip_asset_id = (clipAsset as any).id;
    update.clip_playback_id = null; // el webhook lo completa cuando el clip nuevo esté listo
  }

  const { error } = await admin.from("highlights").update(update).eq("id", hl.id);
  if (error) {
    return NextResponse.json({ error: "No se pudo guardar el cambio" }, { status: 500 });
  }

  if (oldAssetId) {
    try {
      await mux!.video.assets.delete(oldAssetId);
    } catch (err) {
      console.error("No se pudo borrar el clip anterior en Mux:", err);
    }
  }

  return NextResponse.json({ ok: true, regenerating: timesChanged });
}
