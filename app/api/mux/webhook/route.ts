import { NextResponse } from "next/server";
import { mux, isMuxConfigured } from "@/lib/mux";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// Mux llama a esta URL solo (nunca el navegador del usuario) cuando pasa algo
// con un video. El "passthrough" nos dice qué es lo que terminó — puede
// traer más de un dato junto, separados por "|", por ejemplo
// "live:<id>|match:<id>" cuando es una transmisión en vivo (Mux exige que
// la transmisión y su grabación compartan el mismo passthrough).
//
// Configurar en Mux Dashboard → Settings → Webhooks:
//   URL: https://tu-app.vercel.app/api/mux/webhook
//   Eventos: video.asset.ready, video.asset.live_stream_completed,
//   video.asset.errored, video.live_stream.active, video.live_stream.idle,
//   video.live_stream.disconnected (o "todos", no molesta)
function parsePassthrough(passthrough: string | undefined): Record<string, string> {
  const tags: Record<string, string> = {};
  if (!passthrough) return tags;
  passthrough.split("|").forEach((part) => {
    const [k, v] = part.split(":");
    if (k && v) tags[k] = v;
  });
  return tags;
}

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

  const tags = parsePassthrough(event.data?.passthrough);

  if (isAdminConfigured && (tags.match || tags.highlight || tags.live)) {
    const admin = createAdminClient();
    if (admin) {
      // "video.asset.ready" cubre los partidos subidos a mano. Para una
      // transmisión en vivo, la grabación final llega con
      // "video.asset.live_stream_completed" (con la duración ya definitiva)
      // — tratamos los dos igual porque actualizan el mismo tipo de partido.
      if (event.type === "video.asset.ready" || event.type === "video.asset.live_stream_completed") {
        const asset = event.data;
        const playbackId = asset.playback_ids?.[0]?.id ?? null;

        if (tags.match) {
          await admin
            .from("matches")
            .update({
              video_status: "ready",
              video_asset_id: asset.id,
              video_playback_id: playbackId,
              duration_seconds: asset.duration ? Math.round(asset.duration) : null,
            })
            .eq("id", tags.match);
        } else if (tags.highlight) {
          await admin.from("highlights").update({ clip_playback_id: playbackId }).eq("id", tags.highlight);
        }
      }

      if (event.type === "video.asset.errored" && tags.match) {
        await admin.from("matches").update({ video_status: "none" }).eq("id", tags.match);
      }

      if (event.type === "video.live_stream.active" && tags.live) {
        await admin
          .from("live_streams")
          .update({ status: "live", started_at: new Date().toISOString() })
          .eq("id", tags.live);
      }

      if (
        (event.type === "video.live_stream.idle" || event.type === "video.live_stream.disconnected") &&
        tags.live
      ) {
        await admin
          .from("live_streams")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("id", tags.live);
      }
    }
  }

  return NextResponse.json({ received: true });
}
