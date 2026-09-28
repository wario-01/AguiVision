"use client";

import { useState } from "react";
import type { Player } from "@/lib/data";

function parseTimeToSeconds(value: string): number | null {
  // acepta "34:20" (mm:ss) o "204" (segundos sueltos)
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

export default function HighlightForm({ matchId, players }: { matchId: string; players: Player[] }) {
  const [playerId, setPlayerId] = useState(players[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const startSeconds = parseTimeToSeconds(start);
    const endSeconds = parseTimeToSeconds(end);

    if (!playerId || !label || startSeconds === null || endSeconds === null) {
      setStatus("error");
      setMessage("Completá jugador, etiqueta, y los tiempos en formato mm:ss (ej: 34:20).");
      return;
    }
    if (endSeconds <= startSeconds) {
      setStatus("error");
      setMessage("El tiempo \"hasta\" tiene que ser mayor al de \"desde\".");
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      const res = await fetch("/api/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, playerId, label, startSeconds, endSeconds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear el highlight");

      setStatus("done");
      setMessage(data.note ?? "Highlight guardado. Mux está generando el clip — aparece solo cuando esté listo.");
      setLabel("");
      setStart("");
      setEnd("");
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message ?? "Ocurrió un error");
    }
  }

  if (players.length === 0) {
    return (
      <div className="bg-panel border border-border rounded-2xl p-5 mt-6">
        <div className="font-display text-base font-semibold mb-2">Marcar highlight</div>
        <div className="text-sm text-muted">
          Todavía no hay jugadores en este equipo. Agregalos invitando a un jugador o madre/padre desde{" "}
          <b>Equipo</b> — ahí se les vincula un jugador, y recién aparecen acá para poder etiquetarlos.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-panel border border-border rounded-2xl p-5 mt-6">
      <div className="font-display text-base font-semibold mb-4">Marcar highlight</div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Jugador</label>
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Etiqueta</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej: Jugada ofensiva"
            className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Desde (mm:ss)</label>
          <input
            type="text"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder="34:00"
            className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Hasta (mm:ss)</label>
          <input
            type="text"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            placeholder="34:20"
            className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={status === "saving"}
        className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold disabled:opacity-60"
      >
        {status === "saving" ? "Guardando..." : "Crear highlight"}
      </button>

      {message && (
        <div className={`mt-3 text-sm ${status === "error" ? "text-red" : "text-muted"}`}>{message}</div>
      )}
    </form>
  );
}
