"use client";

// components/ShareHighlightToggle.tsx
// Interruptor para que el entrenador comparta un highlight con todo el equipo.

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ShareHighlightToggle({
  highlightId,
  initial,
}: {
  highlightId: string;
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function toggle() {
    const next = !on;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/highlights/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightId, shared: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      setOn(next);
      router.refresh();
    } catch {
      setError("Ocurrió un error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-panel border border-border rounded-xl p-4 mt-6 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-bold">Compartir con todo el equipo</div>
          <div className="text-xs text-muted">
            {on
              ? "Todos los papás y jugadores del equipo pueden ver este highlight."
              : "Solo lo ven el entrenador y los papás del jugador."}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={toggle}
          disabled={busy}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
            on ? "bg-gold" : "bg-borderMuted"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              on ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
      {error && <div className="text-xs text-red font-semibold">{error}</div>}
    </div>
  );
}
