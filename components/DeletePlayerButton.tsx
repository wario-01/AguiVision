"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeletePlayerButton({
  playerId,
  playerName,
  teamSlug,
}: {
  playerId: string;
  playerName: string;
  teamSlug: string;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (
      !confirm(
        `¿Borrar a ${playerName}? Se borran también todas sus evaluaciones (formativas y físico-técnicas). Sus highlights se quedan, pero sin jugador asignado. No se puede deshacer.`
      )
    )
      return;

    setBusy(true);
    try {
      const res = await fetch("/api/players", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "No se pudo borrar el jugador");
        setBusy(false);
        return;
      }
      router.push(`/${teamSlug}/equipo`);
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
      {busy ? "Borrando…" : "Borrar jugador"}
    </button>
  );
}
