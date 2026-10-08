import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// POST /api/team-standings
// json: { teamSlug, url }   (url vacío = quitar el enlace)
// Solo coach/assistant del equipo puede cambiar el enlace de la liga.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.teamSlug !== "string") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  let url: string | null = null;
  const raw = typeof body.url === "string" ? body.url.trim() : "";
  if (raw) {
    if (raw.length > 500) {
      return NextResponse.json({ error: "El enlace es demasiado largo" }, { status: 400 });
    }
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return NextResponse.json({ error: "El enlace no es válido" }, { status: 400 });
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json({ error: "El enlace debe empezar con https://" }, { status: 400 });
    }
    url = parsed.toString();
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: team } = await supabase.from("teams").select("id").eq("slug", body.teamSlug).single();
  if (!team) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", team.id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!membership || (membership.role !== "coach" && membership.role !== "assistant")) {
    return NextResponse.json({ error: "No tenés permiso para cambiar este enlace" }, { status: 403 });
  }

  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  }

  const { error } = await admin.from("teams").update({ standings_url: url }).eq("id", team.id);
  if (error) {
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url });
}
