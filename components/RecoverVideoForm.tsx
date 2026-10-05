"use client";

// components/RecoverVideoForm.tsx
//
// Elige un video que ya existe en Mux (y que no está en ningún partido) y
// crea un partido nuevo con él.

import { useState } from "react";
import { useRouter } from "next/navigation";

export type RecoverCandidate = {
  id: string;
  playbackId: string;
  createdAt: string; // ISO
  duration: number | null; // segundos
  isLive: boolean;
};

function formatDuration(seconds: number | null) {
  if (!seconds) return "duración desconocida";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toDateInput(iso: string) {
  // YYYY-MM-DD en hora de Austin
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export default function RecoverVideoForm({
  teamSlug,
  candidates,
}: {
  teamSlug: string;
  candidates: RecoverCandidate[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function pick(c: RecoverCandidate) {
    setSelected(c.id);
    setDate(toDateInput(c.createdAt));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/matches/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamSlug, assetId: selected, opponent, matchDate: date }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo recuperar el video");
        return;
      }
      router.push(`/${data.teamSlug}/partidos/${data.matchId}`);
      router.refresh();
    } catch {
      setError("Ocurrió un error");
    } finally {
      setBusy(false);
    }
  }

  if (candidates.length === 0) {
    return (
      <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-8 text-center">
        No hay videos sueltos en Mux: todos los que encontré ya están en algún partido de la app.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        {candidates.map((c) => (
          <label
            key={c.id}
            className={`flex items-center gap-3 bg-panel border rounded-xl p-3 cursor-pointer ${
              selected === c.id ? "border-gold" : "border-border hover:border-borderMuted"
            }`}
          >
            <input type="radio" name="asset" checked={selected === c.id} onChange={() => pick(c)} />
            <img
              src={`https://image.mux.com/${c.playbackId}/thumbnail.jpg?width=240&time=10`}
              alt=""
              className="w-28 h-16 object-cover rounded-lg bg-panel2 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-bold">{formatDate(c.createdAt)}</div>
              <div className="text-xs text-muted">
                {formatDuration(c.duration)}
                {c.isLive && " · grabación de transmisión en vivo"}
              </div>
            </div>
          </label>
        ))}
      </div>

      {selected && (
        <div className="bg-panel border border-border rounded-xl p-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-muted">Rival (o nombre del partido)</span>
            <input
              required
              maxLength={100}
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              className="bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-sm"
              placeholder="Ej. Halcones"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-muted">Fecha del partido</span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-sm"
            />
          </label>

          {error && <div className="text-xs text-red font-semibold">{error}</div>}

          <div>
            <button
              type="submit"
              disabled={busy}
              className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold disabled:opacity-50"
            >
              {busy ? "Recuperando…" : "Recuperar este video"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
