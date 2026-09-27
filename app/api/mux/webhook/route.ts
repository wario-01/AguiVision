import { NextResponse } from "next/server";
import { mux, isMuxConfigured } from "@/lib/mux";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// Mux llama a esta URL solo (nunca el navegador del usuario) cuando pasa algo
// con un video. El "passthrough" nos dice qué es lo que terminó: un
// partido completo ("match:<id>"), el clip de un highlight ("highlight:<id>"),
// o una transmisión en vivo ("live:<id>").
//
// Configurar en Mux Dashboard → Settings → Webhooks:
//   URL: https://tu-app.vercel.app/api/mux/webhook
//   Eventos: video.asset.ready, video.asset.errored, video.live_stream.active,
//   video.live_stream.idle, video.live_stream.disconnected (o "todos", no molesta)
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("mux-signature");

  if (isMuxConfigured && mux && process.env.MUX_WEBHOOK_SECRET && signature) {
    try {
      // TODO: si esta línea da error de tipos o de método no encontrado,
      // revisar el nombre exacto en la versión de @mux/mux-node instalada.
      mux.webhooks.verifySignature(
        rawBody,
        Object.fromEntries(req.headers as any),
        process.env.MUX_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Firma de webhook de Mux inválida:", err);
      return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
    }
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const passthrough: string | undefined = event.data?.passthrough;
  const [kind, id] = passthrough ? passthrough.split(":") : [undefined, undefined];

  if (isAdminConfigured && id) {
    const admin = createAdminClient();
    if (admin) {
      if (event.type === "video.asset.ready") {
        const asset = event.data;
        const playbackId = asset.playback_ids?.[0]?.id ?? null;

        if (kind === "match") {
          await admin
            .from("matches")
            .update({
              video_status: "ready",
              video_asset_id: asset.id,
              video_playback_id: playbackId,
              duration_seconds: asset.duration ? Math.round(asset.duration) : null,
            })
            .eq("id", id);
        } else if (kind === "highlight") {
          await admin.from("highlights").update({ clip_playback_id: playbackId }).eq("id", id);
        }
      }

      if (event.type === "video.asset.errored" && kind === "match") {
        await admin.from("matches").update({ video_status: "none" }).eq("id", id);
      }

      if (event.type === "video.live_stream.active" && kind === "live") {
        await admin
          .from("live_streams")
          .update({ status: "live", started_at: new Date().toISOString() })
          .eq("id", id);
      }

      if (
        (event.type === "video.live_stream.idle" || event.type === "video.live_stream.disconnected") &&
        kind === "live"
      ) {
        await admin
          .from("live_streams")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("id", id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
