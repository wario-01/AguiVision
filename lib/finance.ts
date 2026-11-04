import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import type { FinanceAccess, FinanceLevel } from "@/lib/finance-shared";

export * from "@/lib/finance-shared";

/** Quién está llamando y qué nivel de acceso a recibos tiene (null = ninguno). */
export async function getFinanceAccess(): Promise<FinanceAccess | null> {
  if (!isSupabaseConfigured || !isAdminConfigured) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  if (!email) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: row } = await admin
    .from("finance_access")
    .select("level, full_name, email, can_issue")
    .eq("email", email)
    .maybeSingle();
  if (!row) return null;
  return { level: row.level as FinanceLevel, name: row.full_name, email: row.email, canIssue: row.can_issue === true };
}

/** Cuota acordada vigente (la más reciente) por jugador, para una temporada. */
export async function currentFees(admin: any, season: string): Promise<Map<string, import("@/lib/finance-shared").PlayerFee>> {
  const { data } = await admin
    .from("player_fees")
    .select("*")
    .eq("season", season)
    .order("created_at", { ascending: false })
    .limit(5000);
  const m = new Map<string, any>();
  for (const f of data ?? []) if (!m.has(f.player_id)) m.set(f.player_id, f);
  return m;
}
