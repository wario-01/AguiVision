"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function parseTimeToSeconds(value: string): number | null {
  if (value.includes(":")) {
    const [mm, ss] = value.split(":");
    const m = parseInt(mm, 10);
    const s = parseInt(ss, 10);
    if (isNaN(m) || isNaN(s)) return null;
    return m * 60 + s;
  }
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function HighlightEditForm({
  teamSlug,
  highlight,
  players,
}: {
  teamSlug: string;
  highlight: {
    id: string;
    label: string;
    player_id: string | null;
    shared_with_team: boolean;
    notas: string | null;
    start_seconds: number;
    end_seconds: number;
  };
  players: { id: string; full_name: string }[];
}) {
  const [playerId, setPlayerId] = useState(highlight.player_id ?? "");
  const [label, setLabel] = useState(highlight.label);
  const [notas, setNotas] = useState(highlight.notas ?? "");
  const [shared, setShared] = useState(highlight.shared_with_team);
  const [start, setStart] = useState(fmt(highlight.start_seconds));
  const [end, setEnd] = useState(fmt(highlight.end_seconds));
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  const input = "w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const startSeconds = parseTimeToSeconds(start);
    const endSeconds = parseTimeToSeconds(end);
    if (!label.trim() || startSeconds === null || endSeconds === null) {
      setStatus("error");
      setMessage("Completa la etiqueta y los tiempos en formato mm:ss (ej: 34:20).");
      return;
    }
    if (endSeconds <= startSeconds) {
      setStatus("error");
      setMessage('El tiempo "hasta" tiene que ser mayor al de "desde".');
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      const res = await fetch("/api/highlights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          highlightId: highlight.id,
          label,
          playerId: playerId || null,
          shared: playerId ? shared : true,
          notas,
          startSeconds,
          endSeconds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      router.push(`/${teamSlug}/highlights/${highlight.id}`);
      router.refresh();
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message ?? "Ocurrió un error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-panel border border-border rounded-2xl p-5">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Jugador</label>
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className={input}>
            <option value="">Todo el equipo (sin jugador)</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Etiqueta</label>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} className={input} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-1">
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Desde (mm:ss)</label>
          <input type="text" value={start} onChange={(e) => setStart(e.target.value)} className={input} />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Hasta (mm:ss)</label>
          <input type="text" value={end} onChange={(e) => setEnd(e.target.value)} className={input} />
        </div>
      </div>
      <div className="text-xs text-muted mb-4">
        Si cambias los tiempos, el clip se vuelve a generar y tarda un momento en estar listo.
      </div>

      <div className="mb-3">
        <label className="block text-xs font-bold text-muted mb-1.5">Nota (opcional)</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          maxLength={500}
          className={`${input} resize-none`}
        />
      </div>

      <label className="flex items-center gap-2 text-xs font-bold text-muted mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={playerId ? shared : true}
          disabled={!playerId}
          onChange={(e) => setShared(e.target.checked)}
        />
        {playerId
          ? "Compartir con todo el equipo (lo verán también las demás familias)"
          : "Se comparte con todo el equipo (no tiene jugador)"}
      </label>

      <button
        type="submit"
        disabled={status === "saving"}
        className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold disabled:opacity-60"
      >
        {status === "saving" ? "Guardando..." : "Guardar cambios"}
      </button>
      {message && <div className="mt-3 text-sm text-red">{message}</div>}
    </form>
  );
}
