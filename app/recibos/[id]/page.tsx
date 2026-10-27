import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import RecibosShell from "@/components/RecibosShell";
import ReceiptCard from "@/components/ReceiptCard";
import ReceiptActions from "@/components/ReceiptActions";
import { getFinanceAccess, receiptNo, Receipt } from "@/lib/finance";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ReciboPage({ params }: { params: { id: string } }) {
  const access = await getFinanceAccess();
  if (!access) redirect("/");
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const admin = createAdminClient()!;
  const { data } = await admin.from("receipts").select("*").eq("id", params.id).maybeSingle();
  if (!data) notFound();
  const r = data as Receipt;
  if (r.legacy) redirect("/recibos?tab=historial"); // los pagos previos no tienen recibo imprimible

  return (
    <RecibosShell access={access} active="reportes">
      <style>{`@media print { @page { size: 5.5in 8.5in; margin: 0.2in; } .receipt-wrap { width: 100%; max-width: none; margin: 0; } }`}</style>
      <div className="no-print mb-3">
        <Link href="/recibos?tab=historial" className="text-xs font-bold text-muted hover:text-text">← Historial de recibos</Link>
      </div>
      <ReceiptActions id={r.id} canVoid={access.level === "owner"} voided={r.voided} />
      <div className="receipt-wrap max-w-md mx-auto md:mx-0">
        <ReceiptCard
          r={{
            number: r.number as number,
            playerName: r.player_name,
            teamName: r.team_name,
            reason: r.reason,
            description: r.description,
            season: r.season,
            totalCents: r.total_cents,
            amountCents: r.amount_cents,
            balanceCents: r.balance_cents,
            method: (r.method ?? "cash") as any,
            issuedBy: r.issued_by_name,
            date: r.receipt_date,
            voided: r.voided,
          }}
        />
      </div>
      {r.voided && (
        <div className="no-print mt-4 text-sm text-red">
          Recibo {receiptNo(r.number)} anulado: {r.void_reason}
        </div>
      )}
    </RecibosShell>
  );
}
