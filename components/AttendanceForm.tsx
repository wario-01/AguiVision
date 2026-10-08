"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AttStatus, STATUSES, STATUS_LABELS } from "@/lib/asistencia";

type P = { id: string; full_name: string; jersey_number: number | null };

const ON: Record<AttStatus, string> = {
  presente: "bg-gold text-bg border-gold",
  tarde: "bg-goldBgDim text-gold border-gold",
  ausente: "bg-red text-redText border-red",
  justificado: "bg-panel2 text-text border-text",
};

export default function AttendanceForm({
  eventId,
  teamSlug,
  players,
  initial,
}: {
  eventId: string;
  teamSlug: string;
  players: P[];
  initial: Record<string, AttStatus>;
}) {
  const [marks, setMarks] = useState<Record<string, AttStatus>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const counts = useMemo(() => {
    const c: Record<AttStatus | "sin", number> = { presente: 0, tarde: 0, ausente: 0, justificado: 0, sin: 0 };
    for (const p of players) {
      const s = marks[p.id];
      if (s) c[s]++;
      else c.sin++;
    }
    return c;
  }, [marks, players]);

  function mark(id: string, s: AttStatus) {
    setMarks((m) => ({ ...m, [id]: s }));
    setSaved(false);
  }

  function allPresent() {
    const next: Record<string, AttStatus> = {};
    for (const p of players) next[p.id] = "presente";
    setMarks(next);
    setSaved(false);
  }

  async function save() {
    const records = Object.entries(marks).map(([playerId, status]) => ({ playerId, status }));
    if (records.length === 0) {
      setError("Marca la asistencia de al menos un jugador");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/asistencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, records }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Ocurrió un error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted">
          <span className="font-bold text-text">{counts.presente}</span> presentes ·{" "}
          <span className="font-bold text-text">{counts.tarde}</span> tarde ·{" "}
          <span className="font-bold text-text">{counts.ausente}</span> ausentes ·{" "}
          <span className="font-bold text-text">{counts.justificado}</span> justificados ·{" "}
          <span className="font-bold text-text">{counts.sin}</span> sin marcar
        </div>
        <button
          type="button"
          onClick={allPresent}
          className="bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-xs font-extrabold"
        >
          Todos presentes
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {players.map((p) => (
          <div key={p.id} className="bg-panel border border-border rounded-xl p-3">
            <div className="text-sm font-bold mb-2 truncate">
              {p.jersey_number != null && <span className="text-gold">#{p.jersey_number} </span>}
              {p.full_name}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {STATUSES.map((s) => {
                const active = marks[p.id] === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => mark(p.id, s)}
                    className={`rounded-lg border px-1 py-2.5 text-[11px] sm:text-xs font-extrabold ${
                      active ? ON[s] : "border-borderMuted text-muted"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {players.length === 0 && (
          <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-8 text-center">
            Este equipo todavía no tiene jugadores en la Plantilla.
          </div>
        )}
      </div>

      {error && <div className="text-sm text-red font-semibold">{error}</div>}
      {saved && <div className="text-sm text-gold font-semibold">✓ Asistencia guardada</div>}

      <button
        type="button"
        onClick={save}
        disabled={busy || players.length === 0}
        className="bg-gold text-bg rounded-lg px-5 py-3 text-sm font-extrabold disabled:opacity-50 self-start"
      >
        {busy ? "Guardando…" : "Guardar asistencia"}
      </button>
    </div>
  );
}
