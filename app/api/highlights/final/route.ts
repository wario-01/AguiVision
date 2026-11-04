import { NextResponse } from "next/server";
import { mux, isMuxConfigured } from "@/lib/mux";
import { coachContext } from "@/lib/highlight-auth";

// POST  { highlightId } -> { uploadUrl }   (URL de subida directa a Mux para el video final)
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const ctx = await coachContext(body?.highlightId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (!isMuxConfigured || !mux) return NextResponse.json({ error: "Falta conectar Mux." }, { status: 503 });
  const upload = await mux.video.uploads.create({
    cors_origin: process.env.NEXT_PUBLIC_APP_URL || "*",
    new_asset_settings: {
      playback_policy: ["public"],
      video_quality: "basic",
      mp4_support: "capped-1080p",
      passthrough: `final:${ctx.hl.id}`,
    } as any,
  });
  return NextResponse.json({ uploadUrl: upload.url });
}

// PATCH { highlightId } -> avisa que el video ya se subió (queda "procesando" hasta que Mux termine)
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const ctx = await coachContext(body?.highlightId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { error } = await ctx.admin.from("highlights").update({ final_status: "processing" }).eq("id", ctx.hl.id);
  if (error) {
    const missing = /final_status|video_edited/.test(error.message ?? "");
    return NextResponse.json(
      { error: missing ? "Falta correr el SQL del video final en Supabase (highlights-video-final.sql)." : "No se pudo guardar" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

// GET ?highlightId=... -> { videoEdited, finalStatus }  (para saber si Mux ya terminó)
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("highlightId");
  const ctx = await coachContext(id);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { data } = await ctx.admin.from("highlights").select("video_edited, final_status").eq("id", ctx.hl.id).maybeSingle();
  return NextResponse.json({ videoEdited: Boolean((data as any)?.video_edited), finalStatus: (data as any)?.final_status ?? null });
}
