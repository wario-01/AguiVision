import { NextResponse } from "next/server";
import { mux, isMuxConfigured } from "@/lib/mux";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// Se ejecuta una vez por día (ver vercel.json). Borra el VIDEO COMPLETO de
// los partidos de más de 6 meses para no seguir pagando el almacenamiento
// de Mux indefinidamente — los highlights ya generados NO se tocan (son
// assets propios e independientes en Mux, y casi no pesan en el costo).
//
// El partido en sí no se borra de la base de datos (se conserva el rival,
// la fecha, etc.) — solo se le saca el video y vuelve a video_status='none'.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Supabase admin no está configurado" }, { status: 500 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: oldMatches, error } = await admin
    .from("matches")
    .select("id, video_asset_id")
    .eq("video_status", "ready")
    .lt("match_date", sixMonthsAgo.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { matchId: string; deleted: boolean }[] = [];

  for (const match of oldMatches ?? []) {
    if (isMuxConfigured && mux && match.video_asset_id) {
      try {
        // TODO: si esta línea da error, revisar el nombre exacto del método
        // en la versión instalada de @mux/mux-node (a veces es .del() en
        // vez de .delete() según la versión).
        await mux.video.assets.delete(match.video_asset_id);
      } catch (err) {
        // Si Mux ya no lo tiene (por ejemplo, borrado a mano antes), seguimos igual
        console.error(`No se pudo borrar el asset de Mux ${match.video_asset_id}:`, err);
      }
    }

    await admin
      .from("matches")
      .update({ video_status: "none", video_asset_id: null, video_playback_id: null })
      .eq("id", match.id);

    results.push({ matchId: match.id, deleted: true });
  }

  return NextResponse.json({ checked: oldMatches?.length ?? 0, cleaned: results.length });
}
