// Verifica que quien llama sea entrenador/asistente del equipo del highlight.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export async function coachContext(highlightId: unknown) {
  if (typeof highlightId !== "string") return { error: "Faltan datos", status: 400 } as const;
  const supabase = await createClient();
  if (!supabase) return { error: "No se pudo conectar con la base de datos", status: 500 } as const;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Tienes que iniciar sesión", status: 401 } as const;
  const { data: hl } = await supabase
    .from("highlights")
    .select("id, clip_asset_id, clip_playback_id, start_seconds, end_seconds, source_photo_id, matches!inner(id, team_id, video_asset_id, video_status)")
    .eq("id", highlightId)
    .maybeSingle();
  const match = (hl as any)?.matches;
  if (!hl || !match?.team_id) return { error: "Highlight no encontrado", status: 404 } as const;
  const { data: me } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", match.team_id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!me || (me.role !== "coach" && me.role !== "assistant")) {
    return { error: "Solo el cuerpo técnico puede hacer esto", status: 403 } as const;
  }
  const admin = isAdminConfigured ? createAdminClient() : null;
  if (!admin) return { error: "Falta configurar el servidor", status: 500 } as const;
  return { supabase, admin, hl: hl as any, match } as const;
}
