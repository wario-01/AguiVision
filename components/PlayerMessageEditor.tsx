"use client";

// components/PlayerMessageEditor.tsx
//
// Cuadro para que el entrenador escriba un mensaje de aliento al jugador.
// Se imprime al final del informe en PDF. Un mensaje por jugador y ciclo.

import { useState } from "react";
import { useRouter } from "next/navigation";

const MAX = 1200;

export default function PlayerMessageEditor({
  playerId,
  cycleId,
  cycleName,
  initial,
}: {
  playerId: string;
  cycleId: string;
  cycleName: string;
  initial: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/evaluaciones/mensaje", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId, cycle_id: cycleId, mensaje: text }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: j.error ?? "No se pudo guardar." });
      } else {
        setSaved(text.trim());
        setText(text.trim());
        setMsg({ ok: true, text: text.trim() ? "Mensaje guardado." : "Mensaje borrado." });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Sin conexión. Intenta de nuevo." });
    }
    setBusy(false);
  }

  const dirty = text.trim() !== saved.trim();

  return (
    <div className="bg-panel border border-border rounded-xl p-4">
      <div className="text-xs text-muted mb-2">
        Aparece al final del informe en PDF ({cycleName}). Si lo dejas vacío, no se muestra.
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        rows={5}
        placeholder="Unas palabras de aliento para el jugador…"
        className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-gold"
      />
      <div className="flex items-center justify-between mt-2 gap-3">
        <div className="text-xs text-muted">
          {text.length}/{MAX}
          {msg && <span className={`ml-3 font-bold ${msg.ok ? "text-ok" : "text-red"}`}>{msg.text}</span>}
        </div>
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="bg-gold text-bg rounded-lg px-4 py-2 text-sm font-extrabold disabled:opacity-40"
        >
          {busy ? "Guardando…" : "Guardar mensaje"}
        </button>
      </div>
    </div>
  );
}
