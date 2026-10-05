import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  // Solo rutas internas: evita redirigir a otro sitio (open redirect).
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error, data } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // El trigger de la base de datos solo vincula invitaciones cuando
        // alguien se registra por PRIMERA VEZ. Para alguien que ya tenía
        // cuenta y lo invitaron a un equipo nuevo después, esto lo vincula
        // acá — en cada login, no solo en el primero.
        const email = data.user?.email;
        if (email && isAdminConfigured) {
          const admin = createAdminClient();
          if (admin) {
            const { data: invitations } = await admin
              .from("team_invitations")
              .select("team_id, role, player_id")
              .eq("email", email.toLowerCase());

            if (invitations && invitations.length > 0 && data.user) {
              for (const inv of invitations) {
                await admin
                  .from("team_members")
                  .insert({
                    team_id: inv.team_id,
                    profile_id: data.user.id,
                    role: inv.role,
                    player_id: inv.player_id,
                  })
                  .select()
                  .maybeSingle(); // ignora si ya existía (no rompe el login)
              }
              await admin.from("team_invitations").delete().eq("email", email.toLowerCase());
            }
          }
        }

        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=No se pudo iniciar sesión`);
}
