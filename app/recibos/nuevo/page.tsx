import { redirect } from "next/navigation";
import RecibosShell from "@/components/RecibosShell";
import NewReceiptForm from "@/components/NewReceiptForm";
import { getFinanceAccess } from "@/lib/finance";
import { createAdminClient } from "@/lib/supabase/admin";
import { clubParts } from "@/lib/tz";

export default async function NuevoRecibo() {
  const access = await getFinanceAccess();
  if (!access) redirect("/");
  if (!access.canIssue) redirect("/recibos");
  const admin = createAdminClient()!;

  // La lista de equipos y jugadores se lee con la clave de servidor porque
  // quien expide recibos no tiene por qué ser miembro de todos los equipos.
  const [{ data: teams }, { data: players }] = await Promise.all([
    admin.from("teams").select("id, name, active").order("name"),
    admin.from("players").select("id, team_id, full_name").order("full_name"),
  ]);

  return (
    <RecibosShell access={access} active="nuevo">
      <div className="font-display text-2xl font-bold mb-1">Nuevo recibo</div>
      <div className="text-sm text-muted mb-6">Al guardar se genera el recibo en PDF y queda registrado en los reportes.</div>
      <NewReceiptForm
        teams={(teams ?? []).filter((t: any) => t.active !== false).map((t: any) => ({ id: t.id, name: t.name }))}
        players={(players ?? []) as any}
        issuerName={access.name}
        today={clubParts(new Date()).ymd}
      />
    </RecibosShell>
  );
}
