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
