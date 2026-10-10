import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { linkPendingInvitations } from "@/lib/postLogin";

// POST /auth/linked
// Se llama justo después de entrar con el código de 6 dígitos (el código se
// verifica directo contra Supabase desde el navegador de la persona, así los
// límites de intentos son por persona y no compartidos). Aquí solo se vinculan
// las invitaciones pendientes de quien ya tiene sesión.
export async function POST() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "No se pudo conectar" }, { status: 500 });
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  await linkPendingInvitations(data.user);
  return NextResponse.json({ ok: true });
}
