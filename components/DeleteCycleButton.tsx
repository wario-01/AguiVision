"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteCycleButton({
  cycleId,
  cycleName,
  teamSlug,
}: {
  cycleId: string;
  cycleName: string;
  teamSlug: string;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (
      !confirm(
        `¿Borrar el ciclo "${cycleName}"? Se borran también su currículo y todas las calificaciones de los jugadores en este ciclo. Los resultados físico-técnicos se conservan. No se puede deshacer.`
      )
    )
      return;

    setBusy(true);
    try {
      const res = await fetch("/api/evaluaciones/ciclos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "No se pudo borrar el ciclo");
        setBusy(false);
        return;
      }
      router.push(`/${teamSlug}/evaluaciones`);
      router.refresh();
    } catch {
      alert("Ocurrió un error");
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      className="text-xs font-bold text-red hover:opacity-80 disabled:opacity-50"
    >
      {busy ? "Borrando…" : "Borrar ciclo"}
    </button>
  );
}
