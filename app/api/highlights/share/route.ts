import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// POST /api/highlights/share  json: { highlightId, shared: boolean }
// Solo entrenador/asistente del equipo del partido.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.highlightId !== "string" || typeof body.shared !== "boolean") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  }

  const { data: hl } = await admin
    .from("highlights")
    .select("id, matches(team_id)")
    .eq("id", body.highlightId)
    .maybeSingle();
  const teamId = (hl as any)?.matches?.team_id as string | undefined;
  if (!hl || !teamId) {
    return NextResponse.json({ error: "Highlight no encontrado" }, { status: 404 });
  }

  const { data: membership } = await admin
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("profile_id", userData.user.id);
  const isStaff = (membership ?? []).some((m) => m.role === "coach" || m.role === "assistant");
  if (!isStaff) {
    return NextResponse.json({ error: "No tenés permiso" }, { status: 403 });
  }

  const { error } = await admin
    .from("highlights")
    .update({ shared_with_team: body.shared })
    .eq("id", hl.id);
  if (error) {
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
