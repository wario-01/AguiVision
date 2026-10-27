"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReceiptActions({ id, canVoid, voided }: { id: string; canVoid: boolean; voided: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function voidIt() {
    const reason = prompt("¿Por qué se anula este recibo? (queda registrado)");
    if (!reason?.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/recibos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "No se pudo anular");
    router.refresh();
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-3 mb-5">
      <button onClick={() => window.print()} className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold">
        Descargar PDF
      </button>
      {canVoid && !voided && (
        <button onClick={voidIt} disabled={busy} className="text-xs font-bold rounded-full px-3.5 py-2 border border-red text-red disabled:opacity-60">
          Anular recibo
        </button>
      )}
      {error && <span className="text-xs text-red">{error}</span>}
    </div>
  );
}
