import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isR2Configured, r2UploadUrl, r2Delete } from "@/lib/r2";

const MAX_BYTES = 25 * 1024 * 1024;
const EXT: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/aac": "aac" };

async function context(highlightId: unknown) {
  if (typeof highlightId !== "string") return { error: "Faltan datos", status: 400 } as const;
  if (!isR2Configured) return { error: "Falta conectar el almacenamiento (Cloudflare R2).", status: 503 } as const;
  const supabase = await createClient();
  if (!supabase) return { error: "No se pudo conectar con la base de datos", status: 500 } as const;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Tienes que iniciar sesión", status: 401 } as const;
  const { data: hl } = await supabase
    .from("highlights")
    .select("id, matches!inner(team_id, teams!inner(slug))")
    .eq("id", highlightId)
    .maybeSingle();
  const m = (hl as any)?.matches;
  if (!hl || !m?.team_id) return { error: "Highlight no encontrado", status: 404 } as const;
  const { data: me } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", m.team_id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!me || (me.role !== "coach" && me.role !== "assistant")) {
    return { error: "Solo el cuerpo técnico puede grabar la voz de un highlight", status: 403 } as const;
  }
  const admin = isAdminConfigured ? createAdminClient() : null;
  if (!admin) return { error: "Falta configurar el servidor", status: 500 } as const;
  const teamSlug = (Array.isArray(m.teams) ? m.teams[0]?.slug : m.teams?.slug) as string;
  return { admin, hl, teamSlug } as const;
}

async function currentKey(admin: any, id: string): Promise<string | null | "missing"> {
  const { data, error } = await admin.from("highlights").select("voice_key").eq("id", id).maybeSingle();
  if (error) return "missing";
  return (data as any)?.voice_key ?? null;
}

// POST { highlightId, mime, size } -> { uploadUrl, key }
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const ctx = await context(body?.highlightId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const mime = String(body.mime ?? "").split(";")[0].trim().toLowerCase();
  const size = Number(body.size);
  if (!EXT[mime]) return NextResponse.json({ error: "Formato de audio no compatible" }, { status: 400 });
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
    return NextResponse.json({ error: "El audio pesa demasiado (máximo 25 MB)" }, { status: 400 });
  }
  const key = `voz/${ctx.teamSlug}/${ctx.hl.id}_${randomUUID().slice(0, 8)}.${EXT[mime]}`;
  return NextResponse.json({ uploadUrl: r2UploadUrl(key, 900), key });
}

// PATCH { highlightId, key, start, duration } -> guarda la voz en el highlight
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const ctx = await context(body?.highlightId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const key = typeof body.key === "string" ? body.key : "";
  if (!key.startsWith(`voz/${ctx.teamSlug}/${ctx.hl.id}_`) || key.includes("..")) {
    return NextResponse.json({ error: "Audio inválido" }, { status: 400 });
  }
  const start = Math.max(0, Math.min(3600, Number(body.start) || 0));
  const duration = Math.max(0, Math.min(3600, Number(body.duration) || 0));
  const old = await currentKey(ctx.admin, ctx.hl.id);
  if (old === "missing") {
    return NextResponse.json({ error: "Falta correr el SQL de voz en Supabase (highlights-voz.sql)." }, { status: 500 });
  }
  const { error } = await ctx.admin
    .from("highlights")
    .update({ voice_key: key, voice_start: Math.round(start * 100) / 100, voice_duration: Math.round(duration * 100) / 100 })
    .eq("id", ctx.hl.id);
  if (error) return NextResponse.json({ error: "No se pudo guardar la voz" }, { status: 500 });
  if (old && old !== key) await r2Delete(old);
  return NextResponse.json({ ok: true });
}

// DELETE { highlightId } -> quita la voz
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  const ctx = await context(body?.highlightId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const old = await currentKey(ctx.admin, ctx.hl.id);
  if (old === "missing") return NextResponse.json({ ok: true });
  const { error } = await ctx.admin
    .from("highlights")
    .update({ voice_key: null, voice_start: 0, voice_duration: null })
    .eq("id", ctx.hl.id);
  if (error) return NextResponse.json({ error: "No se pudo quitar la voz" }, { status: 500 });
  if (old) await r2Delete(old);
  return NextResponse.json({ ok: true });
}
