import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// Vincula las invitaciones pendientes (por correo) a la persona que acaba de
// entrar. El trigger de la base solo lo hace en el PRIMER registro; esto lo
// hace en cada login, para quien ya tenía cuenta y lo invitaron a otro equipo.
export async function linkPendingInvitations(user: { id: string; email?: string | null }) {
  const email = user.email?.toLowerCase();
  if (!email || !isAdminConfigured) return;
  const admin = createAdminClient();
  if (!admin) return;

  const { data: invitations } = await admin
    .from("team_invitations")
    .select("team_id, role, player_id")
    .eq("email", email);

  if (invitations && invitations.length > 0) {
    for (const inv of invitations) {
      await admin
        .from("team_members")
        .insert({ team_id: inv.team_id, profile_id: user.id, role: inv.role, player_id: inv.player_id })
        .select()
        .maybeSingle(); // ignora si ya existía (no rompe el login)
    }
    await admin.from("team_invitations").delete().eq("email", email);
  }
}

// Solo rutas internas: evita redirigir a otro sitio (open redirect).
export function safeNext(nextParam: string | null | undefined): string {
  const n = nextParam ?? "/";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}
