"use client";

// components/PhysicalResultForm.tsx
//
// Captura un resultado nuevo (con fecha) para cada métrica configurada
// del equipo, y muestra el historial de resultados ya guardados.

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Metric {
  id: string;
  nombre: string;
  unidad: string;
  mejor_direccion: "menor" | "mayor";
}

interface Resultado {
  id: string;
  valor: number;
  fecha: string;
}

export default function PhysicalResultForm({
  playerId,
  metrics,
  historial,
}: {
  playerId: string;
  metrics: Metric[];
  historial: Record<string, Resultado[]>;
}) {
  const router = useRouter();
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [valores, setValores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function setValor(metricId: string, valor: string) {
    setValores((v) => ({ ...v, [metricId]: valor }));
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const resultados = metrics
      .map((m) => ({ metric_id: m.id, valor: parseFloat(valores[m.id]) }))
      .filter((r) => !Number.isNaN(r.valor));

    if (resultados.length === 0) {
      setError("Captura al menos un valor.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/evaluaciones/fisico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId, fecha, resultados }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo guardar.");
        setSaving(false);
        return;
      }
      setValores({});
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="bg-amberBg text-amberText border border-borderMuted rounded-lg p-3 text-sm font-semibold">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-panel2 text-gold border border-borderMuted rounded-lg p-3 text-sm font-semibold">
            ✓ Resultados guardados
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Fecha de la prueba</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {metrics.map((m) => (
            <div key={m.id}>
              <label className="block text-xs font-bold text-muted mb-1.5">
                {m.nombre} <span className="text-mutedDim">({m.unidad})</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={valores[m.id] ?? ""}
                onChange={(e) => setValor(m.id, e.target.value)}
                placeholder="0.0"
                className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
              />
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold self-start disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar resultados"}
        </button>
      </form>

      <div>
        <div className="text-sm font-bold mb-3">Historial</div>
        <div className="flex flex-col gap-4">
          {metrics.map((m) => {
            const rows = historial[m.id] || [];
            return (
              <div key={m.id} className="bg-panel border border-border rounded-xl p-4">
                <div className="text-xs font-bold text-gold uppercase tracking-wide mb-2">
                  {m.nombre}
                </div>
                {rows.length === 0 ? (
                  <div className="text-xs text-muted">Sin resultados todavía.</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {rows.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted">{r.fecha}</span>
                        <span className="font-bold">
                          {r.valor} {m.unidad}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
