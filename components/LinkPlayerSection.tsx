"use client";

// components/LinkPlayerSection.tsx
//
// Para niños que juegan en más de un equipo: vincula este registro con el
// del mismo niño en el otro equipo. Los papás ven así los highlights de las
// dos categorías juntos. Las evaluaciones siguen separadas por equipo.

import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = { id: string; full_name: string; team_name: string };

export default function LinkPlayerSection({
  playerId,
  linked,
  candidates,
}: {
  playerId: string;
  linked: Row[];
  candidates: Row[];
}) {
  const [otherId, setOtherId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/players/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar el vínculo");
        return;
      }
      setOtherId("");
      router.refresh();
    } catch {
      setError("Ocurrió un error");
    } finally {
      setBusy(false);
    }
  }

  if (linked.length === 0 && candidates.length === 0) return null;

  return (
    <div className="bg-panel border border-border rounded-xl p-5 mt-6 flex flex-col gap-3">
      <div className="text-sm font-bold">Juega en más de un equipo</div>
      <div className="text-xs text-muted">
        Vincula este registro con el del mismo niño en el otro equipo. Los papás ven juntos los highlights de las dos
        categorías; las evaluaciones y los datos siguen separados por equipo.
      </div>

      {linked.length > 0 && (
        <div className="flex flex-col gap-2">
          {linked.map((r) => (
            <div key={r.id} className="text-sm">
              Vinculado con <span className="font-bold">{r.full_name}</span>{" "}
              <span className="text-gold">· {r.team_name}</span>
            </div>
          ))}
          <div>
            <button
              onClick={() => send({ unlink: true })}
              disabled={busy}
              className="text-xs font-bold text-red hover:opacity-80 disabled:opacity-50"
            >
              Desvincular a este jugador
            </button>
          </div>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={otherId}
            onChange={(e) => setOtherId(e.target.value)}
            className="bg-panel2 border border-borderMuted rounded-lg px-3 py-1.5 text-xs"
          >
            <option value="">Vincular con…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name} — {c.team_name}
              </option>
            ))}
          </select>
          <button
            onClick={() => send({ otherPlayerId: otherId })}
            disabled={busy || !otherId}
            className="text-xs font-bold text-gold hover:underline disabled:opacity-50"
          >
            {busy ? "Guardando…" : "Vincular"}
          </button>
        </div>
      )}

      {error && <div className="text-xs text-red font-semibold">{error}</div>}
    </div>
  );
}
