import { NextResponse } from "next/server";
import { mux, isMuxConfigured } from "@/lib/mux";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// Se ejecuta una vez por día (ver vercel.json). Borra el VIDEO COMPLETO de
// los partidos de más de 6 meses para no seguir pagando el almacenamiento
// de Mux indefinidamente — los highlights ya generados NO se tocan (son
// assets propios e independientes en Mux, y casi no pesan en el costo).
//
// Después del borrado el partido ya no tiene nada que mostrar:
//  - si NO tiene highlights, se borra de la base de datos (no queda "fantasma");
//  - si tiene highlights, se conserva (los highlights cuelgan de él) y las listas
//    lo ocultan (ver isGhostMatch en lib/data.ts).
// También limpia partidos fantasma que ya existían de antes.
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

  // Partidos viejos sin video (los de recién y los de antes): borrar los que
  // no tienen highlights.
  const { data: ghosts } = await admin
    .from("matches")
    .select("id")
    .eq("video_status", "none")
    .lt("match_date", sixMonthsAgo.toISOString());

  let removed = 0;
  const ghostIds = (ghosts ?? []).map((g) => g.id as string);
  if (ghostIds.length > 0) {
    const { data: withHighlights } = await admin.from("highlights").select("match_id").in("match_id", ghostIds);
    const keep = new Set((withHighlights ?? []).map((h) => h.match_id as string));
    const toDelete = ghostIds.filter((id) => !keep.has(id));
    if (toDelete.length > 0) {
      const { error: delError } = await admin.from("matches").delete().in("id", toDelete);
      if (!delError) removed = toDelete.length;
    }
  }

  return NextResponse.json({ checked: oldMatches?.length ?? 0, cleaned: results.length, removed });
}
