import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { mux, isMuxConfigured } from "@/lib/mux";

// POST /api/live-streams
// body: { teamSlug, title }
// Crea la fila en la base (status='scheduled') y, si Mux está conectado,
// una transmisión real en Mux — devuelve el Server URL y la Stream Key
// para configurar la cámara.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.teamSlug || !body?.title) {
    return NextResponse.json({ error: "Faltan datos de la transmisión" }, { status: 400 });
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

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("slug", body.teamSlug)
    .single();

  if (!team) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  // Se crea un partido en la base de datos ANTES de transmitir: cuando Mux
  // termine de grabar la transmisión, ese video va a quedar guardado en
  // ESTE partido — aparece solo en "Inicio", se puede ver y marcar
  // highlights, igual que un video subido a mano.
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({ team_id: team.id, opponent: body.title, match_date: new Date().toISOString(), video_status: "none" })
    .select("id")
    .single();

  if (matchError || !match) {
    return NextResponse.json({ error: "No tenés permiso para transmitir en este equipo" }, { status: 403 });
  }

  // insert respeta RLS: solo entrenadores/asistentes de este equipo pueden crear
  const { data: liveStream, error: insertError } = await supabase
    .from("live_streams")
    .insert({ team_id: team.id, match_id: match.id, title: body.title, status: "scheduled" })
    .select("id")
    .single();

  if (insertError || !liveStream) {
    return NextResponse.json({ error: "No tenés permiso para transmitir en este equipo" }, { status: 403 });
  }

  if (!isMuxConfigured || !mux) {
    return NextResponse.json({
      liveStreamId: liveStream.id,
      note: "Transmisión creada. Falta conectar Mux para obtener la llave de transmisión.",
    });
  }

  try {
    const muxLiveStream = await mux.video.liveStreams.create({
      playback_policy: ["public"],
      new_asset_settings: {
        playback_policy: ["public"],
        video_quality: "plus",
      },
      // Mux exige que la transmisión y la grabación que genera compartan el
      // MISMO passthrough — acá metemos los dos ids juntos (separados por
      // "|") y el webhook los separa según qué evento le llegue.
      passthrough: `live:${liveStream.id}|match:${match.id}`,
      // Baja el retraso de ~30s a ~12-20s. Si la conexión de la cámara es
      // estable, se puede probar "low" (hasta 5s) más adelante.
      latency_mode: "reduced",
    });

    await supabase
      .from("live_streams")
      .update({
        playback_id: muxLiveStream.playback_ids?.[0]?.id ?? null,
        mux_live_stream_id: muxLiveStream.id,
      })
      .eq("id", liveStream.id);

    return NextResponse.json({
      liveStreamId: liveStream.id,
      serverUrl: "rtmp://global-live.mux.com:5222/app",
      serverUrlSecure: "rtmps://global-live.mux.com:443/app",
      streamKey: muxLiveStream.stream_key,
      playbackId: muxLiveStream.playback_ids?.[0]?.id ?? null,
    });
  } catch (err: any) {
    console.error("Error creando el live stream en Mux:", err);
    return NextResponse.json(
      { error: `Mux rechazó la transmisión: ${err?.message ?? "error desconocido"}` },
      { status: 500 }
    );
  }
}

// DELETE /api/live-streams
// body: { liveStreamId }
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.liveStreamId) {
    return NextResponse.json({ error: "Falta el id de la transmisión" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: liveStream } = await supabase
    .from("live_streams")
    .select("team_id, mux_live_stream_id")
    .eq("id", body.liveStreamId)
    .single();

  if (!liveStream) {
    return NextResponse.json({ error: "Transmisión no encontrada" }, { status: 404 });
  }

  // Verificar el rol ANTES de tocar Mux (si no, cualquier miembro podría
  // cortar la transmisión en Mux aunque la base de datos le niegue el cambio).
  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", liveStream.team_id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (!membership || (membership.role !== "coach" && membership.role !== "assistant")) {
    return NextResponse.json({ error: "No tenés permiso para terminar esta transmisión" }, { status: 403 });
  }

  if (isMuxConfigured && mux && liveStream?.mux_live_stream_id) {
    try {
      // TODO: revisar el nombre exacto del método contra la versión
      // instalada de @mux/mux-node si esto da error (a veces es
      // .complete() o .disable() según la versión del SDK).
      await mux.video.liveStreams.complete(liveStream.mux_live_stream_id);
    } catch (err) {
      console.error("No se pudo terminar la transmisión en Mux:", err);
    }
  }

  const { error } = await supabase
    .from("live_streams")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", body.liveStreamId);

  if (error) {
    return NextResponse.json({ error: "No tenés permiso para terminar esta transmisión" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
