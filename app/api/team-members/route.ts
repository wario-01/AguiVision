import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DELETE /api/team-members
// body: { memberId }
// RLS exige que quien llama sea coach/assistant del mismo equipo — si no
// lo es, la base de datos rechaza el delete solo (no hace falta chequearlo
// dos veces acá).
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.memberId) {
    return NextResponse.json({ error: "Falta el id del miembro" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { error } = await supabase.from("team_members").delete().eq("id", body.memberId);
  if (error) {
    return NextResponse.json({ error: "No tenés permiso para quitar a este miembro" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
