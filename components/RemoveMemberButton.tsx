"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RemoveMemberButton({
  memberId,
  memberName,
  isSelf,
}: {
  memberId: string;
  memberName: string;
  isSelf: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleRemove() {
    const confirmMsg = isSelf
      ? `¿Salir del equipo vos mismo? Vas a perder el acceso.`
      : `¿Quitar a ${memberName} del equipo?`;
    if (!confirm(confirmMsg)) return;

    setBusy(true);
    try {
      const res = await fetch("/api/team-members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "No se pudo quitar al miembro");
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
      onClick={handleRemove}
      disabled={busy}
      className="text-xs font-bold text-red hover:opacity-80 disabled:opacity-50"
    >
      {isSelf ? "Salir" : "Quitar"}
    </button>
  );
}
