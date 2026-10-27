"use client";

// Ciclo de evaluación por competencias (U14): un solo periodo (cuatrimestre) con las
// competencias agrupadas por área. Todo es editable: se pueden cambiar los textos,
// quitar competencias o agregar nuevas. Viene precargado con el ciclo anterior
// (o con la plantilla del documento si es el primero).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AREA_LABELS, U14_AREAS, PORTERO_AREA, CompetenciaInput, DURACIONES, endDateFor } from "@/lib/eval-shared";

export default function NewCycleFormU14({
  teamId,
  teamSlug,
  initial,
  source,
}: {
  teamId: string;
  teamSlug: string;
  initial: CompetenciaInput[];
  source: string; // de dónde viene lo precargado
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [periodType, setPeriodType] = useState("bimestral");
  const [endTouched, setEndTouched] = useState(false);
  const [items, setItems] = useState<CompetenciaInput[]>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El fin se sugiere solo según la duración, pero se puede cambiar a mano.
  function suggestEnd(start: string, tipo: string, touched: boolean) {
    const meses = DURACIONES.find((d) => d.value === tipo)?.meses ?? 0;
    if (!touched && start && meses > 0) setEndDate(endDateFor(start, meses));
  }

  function update(idx: number, descripcion: string) {
    setItems((all) => all.map((it, i) => (i === idx ? { ...it, descripcion } : it)));
  }
  function remove(idx: number) {
    setItems((all) => all.filter((_, i) => i !== idx));
  }
  function add(area: string) {
    setItems((all) => {
      // se inserta al final de su área para conservar el orden por área
      let last = -1;
      all.forEach((it, i) => {
        if (it.area === area) last = i;
      });
      const next = [...all];
      next.splice(last + 1, 0, { area, descripcion: "" });
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name || !startDate || !endDate) {
      setError("Completa nombre, fecha de inicio y fecha de fin.");
      return;
    }
    const clean = items.filter((it) => it.descripcion.trim());
    if (clean.length === 0) {
      setError("Agrega al menos una competencia.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/evaluaciones/ciclos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: teamId,
          name,
          period_type: periodType,
          start_date: startDate,
          end_date: endDate,
          periodos: [
            {
              period_label: name.trim().slice(0, 60) || "Periodo",
              period_order: 0,
              items: clean.map((it, i) => ({ area: it.area, descripcion: it.descripcion, item_order: i })),
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo crear el ciclo.");
        setSaving(false);
        return;
      }
      router.push(`/${teamSlug}/evaluaciones/${data.cycle_id}`);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="bg-amberBg text-amberText border border-borderMuted rounded-lg p-3 text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Nombre del ciclo</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bimestre 1 · Jul–Ago 2026"
            className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-bold text-muted mb-1.5">Duración</label>
            <select
              value={periodType}
              onChange={(e) => {
                setPeriodType(e.target.value);
                suggestEnd(startDate, e.target.value, endTouched);
              }}
              className="bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
            >
              {DURACIONES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted mb-1.5">Inicio</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                suggestEnd(e.target.value, periodType, endTouched);
              }}
              className="bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted mb-1.5">Fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setEndTouched(true);
              }}
              className="bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="text-sm font-bold mb-1">Competencias a evaluar</div>
        <div className="text-xs text-muted mb-4">
          Precargadas desde {source}. Puedes editar cualquier texto, quitar una competencia o agregar nuevas; solo
          afecta a este ciclo.
        </div>
        <div className="flex flex-col gap-6">
          {[...U14_AREAS, PORTERO_AREA].map((area) => (
            <div key={area}>
              <div className="text-xs font-extrabold uppercase tracking-wider text-gold mb-2">
                {AREA_LABELS[area]}
              </div>
              {area === PORTERO_AREA && (
                <div className="text-[11px] text-muted -mt-1 mb-2">
                  Solo se califica a los jugadores con posición Portero. Son ejemplos: edítalos, quítalos o agrega los tuyos.
                </div>
              )}
              <div className="flex flex-col gap-2.5">
                {items.map((it, idx) =>
                  it.area !== area ? null : (
                    <div key={idx} className="bg-panel border border-border rounded-xl p-3 flex gap-2 items-start">
                      <textarea
                        value={it.descripcion}
                        onChange={(e) => update(idx, e.target.value)}
                        rows={3}
                        placeholder="Competencia..."
                        className="flex-grow box-border bg-bg border border-border rounded-lg px-3 py-2 text-xs font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        className="text-xs font-bold text-red shrink-0 pt-1"
                      >
                        Quitar
                      </button>
                    </div>
                  )
                )}
                <button
                  type="button"
                  onClick={() => add(area)}
                  className="self-start text-xs font-bold text-gold hover:underline"
                >
                  + Agregar competencia
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold self-start disabled:opacity-60"
      >
        {saving ? "Guardando..." : "Crear ciclo"}
      </button>
    </form>
  );
}
