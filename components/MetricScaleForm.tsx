"use client";

// Escala de la ficha técnica: por cada prueba, qué resultado vale 40 ("flojo") y cuál 99
// ("excelente"). En las pruebas de tiempo el "excelente" es menor que el "flojo".

import { useState } from "react";
import { useRouter } from "next/navigation";

type Metric = { id: string; nombre: string; unidad: string; valor_bajo: number | null; valor_alto: number | null; grupo: string | null };

const GRUPOS: Record<string, string> = { vel: "Velocidad", res: "Resistencia", pot: "Potencia", flx: "Flexibilidad" };

export default function MetricScaleForm({ metrics }: { metrics: Metric[] }) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, { bajo: string; alto: string }>>(() =>
    Object.fromEntries(metrics.map((m) => [m.id, { bajo: m.valor_bajo?.toString() ?? "", alto: m.valor_alto?.toString() ?? "" }]))
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setMsg(null);
    setSaving(true);
    try {
      const updates = metrics.map((m) => ({ id: m.id, valor_bajo: vals[m.id].bajo, valor_alto: vals[m.id].alto }));
      const res = await fetch("/api/evaluaciones/metricas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: data.error || "No se pudo guardar." });
      else {
        setMsg({ ok: true, text: "✓ Escala guardada" });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Error de conexión." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-panel border border-border rounded-2xl p-4">
      <div className="text-sm font-bold mb-1">Escala de la ficha técnica</div>
      <div className="text-xs text-muted mb-4 leading-relaxed">
        Para cada prueba, escribe qué resultado vale <b className="text-text">40</b> (flojo) y cuál vale{" "}
        <b className="text-text">99</b> (excelente). Lo que queda en medio se calcula solo. En las pruebas de tiempo, el
        excelente es el número menor.
      </div>
      <div className="flex flex-col gap-3">
        {metrics.map((m) => (
          <div key={m.id}>
            <div className="text-xs font-bold mb-1.5">
              {m.nombre} <span className="text-mutedDim">({m.unidad})</span>
              {m.grupo && <span className="text-gold"> · cuenta para {GRUPOS[m.grupo] ?? m.grupo}</span>}
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                step="any"
                value={vals[m.id].bajo}
                onChange={(e) => setVals((v) => ({ ...v, [m.id]: { ...v[m.id], bajo: e.target.value } }))}
                placeholder="Flojo (=40)"
                className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
              />
              <input
                type="number"
                step="any"
                value={vals[m.id].alto}
                onChange={(e) => setVals((v) => ({ ...v, [m.id]: { ...v[m.id], alto: e.target.value } }))}
                placeholder="Excelente (=99)"
                className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-gold text-bg rounded-lg px-5 py-2 text-sm font-extrabold disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar escala"}
        </button>
        {msg && <span className={`text-xs font-bold ${msg.ok ? "text-ok" : "text-red"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
