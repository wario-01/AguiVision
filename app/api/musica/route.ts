import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isR2Configured, r2UploadUrl, r2ViewUrl, r2Delete } from "@/lib/r2";

const MAX_BYTES = 15 * 1024 * 1024;
const EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
};

async function context(teamSlug: unknown) {
  if (typeof teamSlug !== "string") return { error: "Falta el equipo", status: 400 } as const;
  if (!isR2Configured) return { error: "Falta conectar el almacenamiento (Cloudflare R2).", status: 503 } as const;
  const supabase = await createClient();
  if (!supabase) return { error: "No se pudo conectar con la base de datos", status: 500 } as const;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Tienes que iniciar sesión", status: 401 } as const;
  const { data: team } = await supabase.from("teams").select("id, slug").eq("slug", teamSlug).maybeSingle();
  if (!team) return { error: "Equipo no encontrado", status: 404 } as const;
  const { data: me } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", team.id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!me || (me.role !== "coach" && me.role !== "assistant")) {
    return { error: "Solo el cuerpo técnico puede manejar la música", status: 403 } as const;
  }
  const admin = isAdminConfigured ? createAdminClient() : null;
  if (!admin) return { error: "Falta configurar el servidor", status: 500 } as const;
  return { admin, team, user: userData.user } as const;
}

// POST { teamSlug, title, mime, size } -> { uploadUrl, track: { id, title, url } }
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const ctx = await context(body?.teamSlug);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const mime = String(body.mime ?? "").split(";")[0].trim().toLowerCase();
  const size = Number(body.size);
  const title = String(body.title ?? "").trim().slice(0, 80);
  if (!title) return NextResponse.json({ error: "Falta el nombre de la canción" }, { status: 400 });
  if (!EXT[mime]) return NextResponse.json({ error: "Formato no compatible. Usa MP3, M4A, WAV u OGG." }, { status: 400 });
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
    return NextResponse.json({ error: "La canción pesa más de 15 MB" }, { status: 400 });
  }
  const { count } = await ctx.admin.from("music_tracks").select("id", { count: "exact", head: true }).eq("team_id", ctx.team.id);
  if ((count ?? 0) >= 40) return NextResponse.json({ error: "La biblioteca ya tiene 40 canciones. Borra alguna." }, { status: 400 });
  const key = `musica/${ctx.team.slug}/${randomUUID()}.${EXT[mime]}`;
  const { data, error } = await ctx.admin
    .from("music_tracks")
    .insert({ team_id: ctx.team.id, title, r2_key: key, size_bytes: size, created_by: ctx.user.id })
    .select("id")
    .single();
  if (error || !data) {
    const missing = /music_tracks/.test(error?.message ?? "");
    return NextResponse.json(
      { error: missing ? "Falta correr el SQL de música en Supabase (highlights-musica.sql)." : "No se pudo guardar la canción" },
      { status: 500 }
    );
  }
  return NextResponse.json({
    uploadUrl: r2UploadUrl(key, 900),
    track: { id: data.id, title, url: r2ViewUrl(key) },
  });
}

// DELETE { teamSlug, id } -> borra la canción de la biblioteca y del almacenamiento
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  const ctx = await context(body?.teamSlug);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (typeof body.id !== "string") return NextResponse.json({ error: "Falta la canción" }, { status: 400 });
  const { data: row } = await ctx.admin
    .from("music_tracks")
    .select("id, r2_key")
    .eq("id", body.id)
    .eq("team_id", ctx.team.id)
    .maybeSingle();
  if (!row) return NextResponse.json({ ok: true });
  const { error } = await ctx.admin.from("music_tracks").delete().eq("id", row.id);
  if (error) return NextResponse.json({ error: "No se pudo borrar la canción" }, { status: 500 });
  await r2Delete(row.r2_key);
  return NextResponse.json({ ok: true });
}
