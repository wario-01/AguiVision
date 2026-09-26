"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelInvitationButton({ invitationId }: { invitationId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleCancel() {
    if (!confirm("¿Cancelar esta invitación?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      if (!res.ok) {
        alert("No se pudo cancelar la invitación");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      alert("Ocurrió un error");
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={busy}
      className="text-xs font-bold text-red hover:opacity-80 disabled:opacity-50"
    >
      Cancelar
    </button>
  );
}
