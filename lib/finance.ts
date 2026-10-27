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
