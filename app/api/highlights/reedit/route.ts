import { NextResponse } from "next/server";
import { mux, isMuxConfigured } from "@/lib/mux";
import { coachContext } from "@/lib/highlight-auth";
import { isR2Configured, r2ViewUrl } from "@/lib/r2";

// POST { highlightId }
// "Volver a editar": vuelve a sacar el clip limpio (sin dibujos pegados) del partido o del video
// de la galería, y reemplaza el video final. Los dibujos, la voz y la música guardados no se tocan.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const ctx = await coachContext(body?.highlightId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { admin, hl, match } = ctx;
  if (!isMuxConfigured || !mux) return NextResponse.json({ error: "Falta conectar Mux." }, { status: 503 });

  let input: any;
  if (hl.source_photo_id) {
    const { data: photo } = await admin.from("photos").select("r2_key").eq("id", hl.source_photo_id).maybeSingle();
    if (!photo || !isR2Configured) {
      return NextResponse.json(
        { error: "El video original de la galería ya no está (se borra a los 60 días si no se marca «Guardar»). Este highlight se queda con su video final." },
        { status: 400 }
      );
    }
    input = [{ url: r2ViewUrl((photo as any).r2_key) }];
  } else {
    if (match.video_status !== "ready" || !match.video_asset_id) {
      return NextResponse.json(
        { error: "El video completo de este partido ya no está disponible (se borra a los 6 meses). Este highlight se queda con su video final." },
        { status: 400 }
      );
    }
    input = [{ url: `mux://assets/${match.video_asset_id}`, start_time: hl.start_seconds, end_time: hl.end_seconds }];
  }

  const clip = await mux.video.assets.create({
    input,
    playback_policy: ["public"],
    video_quality: "basic",
    mp4_support: "capped-1080p",
    passthrough: `highlight:${hl.id}`,
  } as any);

  const oldAssetId = hl.clip_asset_id as string | null;
  const { error } = await admin
    .from("highlights")
    .update({ clip_asset_id: (clip as any).id, clip_playback_id: null, video_edited: false, final_status: null })
    .eq("id", hl.id);
  if (error) {
    try {
      await mux.video.assets.delete((clip as any).id);
    } catch {}
    return NextResponse.json({ error: "No se pudo guardar el cambio" }, { status: 500 });
  }
  if (oldAssetId) {
    try {
      await mux.video.assets.delete(oldAssetId);
    } catch (err) {
      console.error("No se pudo borrar el video final anterior en Mux:", err);
    }
  }
  return NextResponse.json({ ok: true });
}
