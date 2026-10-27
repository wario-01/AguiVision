import { redirect } from "next/navigation";
import RecibosShell from "@/components/RecibosShell";
import AccessManager from "@/components/AccessManager";
import { getFinanceAccess } from "@/lib/finance";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AccesosPage() {
  const access = await getFinanceAccess();
  if (!access) redirect("/");
  if (access.level !== "owner") redirect("/recibos");
  const { data } = await createAdminClient()!
    .from("finance_access")
    .select("id, email, full_name, level, can_issue")
    .order("created_at");
  return (
    <RecibosShell access={access} active="accesos">
      <div className="font-display text-2xl font-bold mb-1">Accesos a Recibos</div>
      <div className="text-sm text-muted mb-6">
        Solo las personas de esta lista ven el menú de Recibos. “Expide: Sí” significa que puede generar recibos (aparecen con su nombre en “Recibo generado por”).
      </div>
      <AccessManager rows={(data ?? []) as any} />
    </RecibosShell>
  );
}
