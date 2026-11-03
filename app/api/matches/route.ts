import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mux, isMuxConfigured } from "@/lib/mux";

// DELETE /api/matches
// body: { matchId, mode: "video" | "all" }
//   "video" → borra solo el video (y sus highlights, con sus clips en Mux);
//             el partido en sí queda, sin video, para volver a subir uno.
//   "all"   → borra el partido completo (rival, fecha, video, highlights).
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.matchId || (body.mode !== "video" && body.mode !== "all")) {
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

  const { data: match } = await supabase
    .from("matches")
    .select("team_id, video_asset_id")
    .eq("id", body.matchId)
    .single();

  if (!match) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  // Verificar el rol ANTES de borrar nada en Mux (si no, cualquier miembro
  // podía borrar videos y clips aunque la base de datos le negara el cambio).
  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", match.team_id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (!membership || (membership.role !== "coach" && membership.role !== "assistant")) {
    return NextResponse.json({ error: "No tenés permiso para borrar este partido" }, { status: 403 });
  }

  // Borrar primero los clips de los highlights de este partido en Mux
  // (si no, quedarían huérfanos pagando almacenamiento para siempre).
  const { data: highlights } = await supabase
    .from("highlights")
    .select("clip_asset_id")
    .eq("match_id", body.matchId);

  if (isMuxConfigured && mux) {
    for (const h of highlights ?? []) {
      if (h.clip_asset_id) {
        try {
          await mux.video.assets.delete(h.clip_asset_id);
        } catch (err) {
          console.error("No se pudo borrar un clip en Mux:", err);
        }
      }
    }
    if (match.video_asset_id) {
      try {
        await mux.video.assets.delete(match.video_asset_id);
      } catch (err) {
        console.error("No se pudo borrar el video del partido en Mux:", err);
      }
    }
  }

  if (body.mode === "all") {
    // RLS exige ser coach/assistant del equipo — si no, esto falla solo.
    // Los highlights se borran solos por el "on delete cascade" del esquema.
    const { error } = await supabase.from("matches").delete().eq("id", body.matchId);
    if (error) {
      return NextResponse.json({ error: "No tenés permiso para borrar este partido" }, { status: 403 });
    }
  } else {
    await supabase.from("highlights").delete().eq("match_id", body.matchId);
    const { error } = await supabase
      .from("matches")
      .update({ video_status: "none", video_asset_id: null, video_playback_id: null, duration_seconds: null })
      .eq("id", body.matchId);
    if (error) {
      return NextResponse.json({ error: "No tenés permiso para borrar este video" }, { status: 403 });
    }
  }

  return NextResponse.json({ ok: true });
}

// PATCH /api/matches
// body: { matchId, opponent, jornada (número o vacío), matchDate? (ISO, solo si se cambió) }
// Corrige el nombre del rival, la jornada y la fecha de un partido. Solo coach/assistant.
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.matchId !== "string" || typeof body.opponent !== "string" || !body.opponent.trim()) {
    return NextResponse.json({ error: "Escribe el nombre del rival" }, { status: 400 });
  }
  let jornada: number | null = null;
  if (body.jornada !== null && body.jornada !== undefined && body.jornada !== "") {
    const n = Number(body.jornada);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      return NextResponse.json({ error: "La jornada tiene que ser un número entre 1 y 99" }, { status: 400 });
    }
    jornada = n;
  }
  if (body.matchDate && isNaN(Date.parse(body.matchDate))) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Tienes que iniciar sesión" }, { status: 401 });

  const { data: match } = await supabase.from("matches").select("*").eq("id", body.matchId).maybeSingle();
  if (!match) return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  const { data: me } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", match.team_id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!me || (me.role !== "coach" && me.role !== "assistant")) {
    return NextResponse.json({ error: "No tienes permiso para editar este partido" }, { status: 403 });
  }

  // La columna "jornada" solo se toca si se pone un número o si ya existe (así editar el rival
  // sigue funcionando aunque todavía no se haya corrido el SQL).
  const hasColumn = "jornada" in match;
  if (jornada !== null && !hasColumn) {
    return NextResponse.json(
      { error: "Falta correr el SQL de jornadas en Supabase (partidos-jornada.sql)." },
      { status: 500 }
    );
  }
  const update: Record<string, unknown> = { opponent: body.opponent.trim().slice(0, 120) };
  if (hasColumn) update.jornada = jornada;
  if (body.matchDate) update.match_date = new Date(body.matchDate).toISOString();

  const { data: updated, error } = await supabase.from("matches").update(update).eq("id", match.id).select("id");
  if (error || !updated || updated.length === 0) {
    return NextResponse.json({ error: "No tienes permiso para editar este partido" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
