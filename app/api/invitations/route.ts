import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

// POST /api/invitations
// body: { teamSlug, email, role }
// Crea una invitación pendiente. RLS exige que quien llama sea coach/assistant
// de ese equipo — si no lo es, la base de datos rechaza el insert solo.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.teamSlug || !body?.email || !body?.role) {
    return NextResponse.json({ error: "Faltan datos de la invitación" }, { status: 400 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Modo demo: Supabase no está configurado." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("slug", body.teamSlug)
    .single();

  if (!team) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  const { error } = await supabase.from("team_invitations").insert({
    team_id: team.id,
    email: body.email.trim().toLowerCase(),
    role: body.role,
  });

  if (error) {
    return NextResponse.json({ error: "No se pudo crear la invitación (¿ya existía?)" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/invitations
// body: { invitationId }
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.invitationId) {
    return NextResponse.json({ error: "Falta el id de la invitación" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { error } = await supabase.from("team_invitations").delete().eq("id", body.invitationId);
  if (error) {
    return NextResponse.json({ error: "No se pudo borrar la invitación" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
