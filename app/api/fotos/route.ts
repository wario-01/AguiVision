import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isR2Configured, r2UploadUrl, r2Delete } from "@/lib/r2";
import { clubParts } from "@/lib/tz";

const MAX_FILES = 60;
const MAX_BYTES = 15 * 1024 * 1024; // las fotos se reducen en el teléfono antes de subir
const MAX_THUMB_BYTES = 1 * 1024 * 1024;

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40) || "album";

async function context(teamSlug: unknown) {
  if (!isSupabaseConfigured) return { error: "Modo demo: Supabase no está configurado.", status: 400 } as const;
  if (!isR2Configured) return { error: "Falta conectar el almacenamiento de fotos (Cloudflare R2).", status: 503 } as const;
  const supabase = await createClient();
  if (!supabase) return { error: "No se pudo conectar con la base de datos", status: 500 } as const;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Tenés que iniciar sesión", status: 401 } as const;
  if (typeof teamSlug !== "string") return { error: "Falta el equipo", status: 400 } as const;
  const { data: team } = await supabase.from("teams").select("id, slug").eq("slug", teamSlug).single();
  if (!team) return { error: "Equipo no encontrado", status: 404 } as const;
  const { data: me } = await supabase
    .from("team_members")
    .select("role, photo_access")
    .eq("team_id", team.id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  const role = me?.role as string | undefined;
  if (!role || !(["coach", "assistant", "collaborator"].includes(role) || me?.photo_access === true)) {
    return { error: "No tenés permiso para las fotos de este equipo", status: 403 } as const;
  }
  return { supabase, user: userData.user, team, role } as const;
}

// POST /api/fotos
// body: { teamSlug, matchId?, album, files: [{ name, size, thumbSize }] }
// Crea el registro de cada foto y devuelve las URLs firmadas para que el
// navegador suba la foto y su miniatura DIRECTO a Cloudflare R2.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const ctx = await context(body?.teamSlug);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase, user, team } = ctx;

  const files: { name: string; size: number; thumbSize: number }[] = Array.isArray(body.files) ? body.files : [];
  if (files.length === 0 || files.length > MAX_FILES) {
    return NextResponse.json({ error: `Elegí entre 1 y ${MAX_FILES} fotos por vez` }, { status: 400 });
  }
  for (const f of files) {
    if (
      typeof f?.name !== "string" ||
      !Number.isFinite(f.size) || f.size <= 0 || f.size > MAX_BYTES ||
      !Number.isFinite(f.thumbSize) || f.thumbSize <= 0 || f.thumbSize > MAX_THUMB_BYTES
    ) {
      return NextResponse.json({ error: "Alguna foto es demasiado grande o no es válida" }, { status: 400 });
    }
  }

  let album = typeof body.album === "string" ? body.album.trim().slice(0, 80) : "";
  let albumDate = clubParts(new Date()).ymd;
  let matchId: string | null = null;
  if (typeof body.matchId === "string" && body.matchId) {
    const { data: match } = await supabase
      .from("matches")
      .select("id, opponent, match_date")
      .eq("id", body.matchId)
      .eq("team_id", team.id)
      .maybeSingle();
    if (!match) return NextResponse.json({ error: "Partido no encontrado en este equipo" }, { status: 404 });
    matchId = match.id;
    albumDate = clubParts(match.match_date).ymd;
    if (!album) album = `vs ${match.opponent}`;
  }
  if (!album) return NextResponse.json({ error: "Falta el nombre del álbum" }, { status: 400 });

  const folder = `${team.slug}/${albumDate}_${slug(album)}`;
  const rows = files.map((f) => {
    const id = randomUUID();
    const base = f.name.replace(/\.[^.]+$/, "").replace(/[^\w\- ]+/g, "_").slice(0, 60) || "foto";
    const fileName = `${base}.jpg`;
    return {
      id,
      team_id: team.id,
      match_id: matchId,
      album,
      album_date: albumDate,
      r2_key: `${folder}/${id.slice(0, 8)}_${fileName}`,
      thumb_key: `${folder}/thumbs/${id}.jpg`,
      file_name: fileName,
      size_bytes: f.size,
      uploaded_by: user.id,
    };
  });

  const { error } = await supabase.from("photos").insert(rows);
  if (error) {
    return NextResponse.json({ error: "No tenés permiso para subir fotos a este equipo" }, { status: 403 });
  }

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      uploadUrl: r2UploadUrl(r.r2_key),
      thumbUploadUrl: r2UploadUrl(r.thumb_key),
    })),
  });
}

// DELETE /api/fotos
// body: { teamSlug, ids: string[] }
// Borra las fotos de la galería Y de Cloudflare R2. Solo entrenador/asistente
// o quien las subió (la base de datos también lo exige).
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  const ctx = await context(body?.teamSlug);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase, team } = ctx;

  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string").slice(0, 200) : [];
  if (ids.length === 0) return NextResponse.json({ error: "No hay fotos elegidas" }, { status: 400 });

  // delete respeta RLS: devuelve solo las filas que de verdad pudo borrar
  const { data: deleted, error } = await supabase
    .from("photos")
    .delete()
    .in("id", ids)
    .eq("team_id", team.id)
    .select("id, r2_key, thumb_key");
  if (error) return NextResponse.json({ error: "No se pudieron borrar las fotos" }, { status: 403 });

  for (const p of deleted ?? []) {
    await r2Delete(p.r2_key);
    await r2Delete(p.thumb_key);
  }
  return NextResponse.json({ ok: true, deleted: (deleted ?? []).length });
}

// PATCH /api/fotos
// body: { teamSlug, ids: string[], keep: boolean }
// "Guardar": las fotos marcadas no se borran solas a los 60 días.
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const ctx = await context(body?.teamSlug);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase, team, role } = ctx;
  if (role !== "coach" && role !== "assistant") {
    return NextResponse.json({ error: "Solo el cuerpo técnico puede guardar fotos" }, { status: 403 });
  }
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string").slice(0, 200) : [];
  if (ids.length === 0 || typeof body.keep !== "boolean") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("photos")
    .update({ keep: body.keep })
    .in("id", ids)
    .eq("team_id", team.id)
    .select("id");
  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 403 });
  }
  return NextResponse.json({ ok: true, updated: data.length });
}
