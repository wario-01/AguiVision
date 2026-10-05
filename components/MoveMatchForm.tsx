"use client";

// components/MoveMatchForm.tsx
//
// Mueve un partido (con su video) a otro equipo del que el usuario también
// es entrenador/asistente — para corregir un video subido al equipo equivocado.

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MoveMatchForm({
  matchId,
  teams,
}: {
  matchId: string;
  teams: { id: string; name: string }[];
}) {
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleMove() {
    const target = teams.find((t) => t.id === targetId);
    if (!target) return;
    if (
      !confirm(
        `¿Mover este video a ${target.name}? Los highlights ya marcados se quedan con el video, pero se les quita el jugador asignado.`
      )
    )
      return;

    setBusy(true);
    try {
      const res = await fetch("/api/matches/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, targetTeamId: targetId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "No se pudo mover el video");
        setBusy(false);
        return;
      }
      router.push(`/${data.targetSlug}/partidos/${matchId}`);
      router.refresh();
    } catch {
      alert("Ocurrió un error");
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 mt-3 flex-wrap">
      <span className="text-xs text-muted font-semibold">¿Equipo equivocado?</span>
      <select
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        className="bg-panel2 border border-borderMuted rounded-lg px-3 py-1.5 text-xs"
      >
        <option value="">Mover a…</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        onClick={handleMove}
        disabled={busy || !targetId}
        className="text-xs font-bold text-gold hover:underline disabled:opacity-50"
      >
        {busy ? "Moviendo…" : "Mover"}
      </button>
    </div>
  );
}
