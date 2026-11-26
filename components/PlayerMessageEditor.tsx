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
  playerName,
  initial,
}: {
  playerId: string;
  cycleId: string;
  playerName: string;
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
    <div className="bg-panel border border-gold/60 rounded-xl p-4">
      <div className="text-[11px] font-extrabold uppercase tracking-wider text-gold mb-1">Mensaje final</div>
      <div className="text-sm font-bold mb-1">Unas palabras para {playerName.split(" ")[0]}</div>
      <div className="text-xs text-muted mb-3">
        Opcional. Sale al final del informe en PDF que reciben los papás, con tu nombre. Si lo dejas vacío, no se muestra.
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        rows={5}
        placeholder={`Ej.: ${playerName.split(" ")[0]}, este cuatrimestre mostraste mucho compromiso. Sigue así, estoy orgulloso de ti.`}
        className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-gold"
      />
      <div className="flex items-center justify-between mt-2 gap-3">
        <div className="text-xs text-muted">
          {text.length}/{MAX}
          {msg && <span className={`ml-3 font-bold ${msg.ok ? "text-ok" : "text-red"}`}>{msg.ok ? "✓ " : ""}{msg.text}</span>}
        </div>
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="bg-gold text-bg rounded-lg px-4 py-2 text-sm font-extrabold disabled:opacity-40 shrink-0"
        >
          {busy ? "Guardando…" : "Guardar mensaje"}
        </button>
      </div>
    </div>
  );
}
