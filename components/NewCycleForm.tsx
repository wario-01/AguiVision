"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const AREAS = [
  { value: "tactico", label: "Táctico" },
  { value: "tecnico", label: "Técnico" },
  { value: "fisico", label: "Físico" },
  { value: "actitudinal", label: "Actitudinal" },
];

interface Periodo {
  period_label: string;
  items: Record<string, string>; // area -> descripcion
}

export default function NewCycleForm({
  teamId,
  teamSlug,
}: {
  teamId: string;
  teamSlug: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [periodType, setPeriodType] = useState("trimestral");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [periodos, setPeriodos] = useState<Periodo[]>([{ period_label: "", items: {} }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addPeriodo() {
    setPeriodos([...periodos, { period_label: "", items: {} }]);
  }

  function removePeriodo(index: number) {
    setPeriodos(periodos.filter((_, i) => i !== index));
  }

  function updatePeriodoLabel(index: number, label: string) {
    const next = [...periodos];
    next[index].period_label = label;
    setPeriodos(next);
  }

  function updateItem(index: number, area: string, descripcion: string) {
    const next = [...periodos];
    next[index].items[area] = descripcion;
    setPeriodos(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name || !startDate || !endDate) {
      setError("Completa nombre, fecha de inicio y fecha de fin.");
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
          periodos: periodos
            .filter((p) => p.period_label.trim())
            .map((p, i) => ({
              period_label: p.period_label.trim(),
              period_order: i,
              items: Object.entries(p.items).map(([area, descripcion]) => ({
                area,
                descripcion,
              })),
            })),
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
            placeholder="Trimestre 1 · 2026"
            className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-bold text-muted mb-1.5">Duración</label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
            >
              <option value="mensual">Mensual</option>
              <option value="trimestral">Trimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted mb-1.5">Inicio</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted mb-1.5">Fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold">Currículo por periodo</div>
          <button type="button" onClick={addPeriodo} className="text-xs font-bold text-gold">
            + Agregar periodo
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {periodos.map((periodo, i) => (
            <div key={i} className="bg-panel border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 gap-3">
                <input
                  value={periodo.period_label}
                  onChange={(e) => updatePeriodoLabel(i, e.target.value)}
                  placeholder="Marzo"
                  className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm font-bold w-40"
                />
                {periodos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePeriodo(i)}
                    className="text-xs font-bold text-red"
                  >
                    Quitar periodo
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AREAS.map((area) => (
                  <div key={area.value}>
                    <label className="block text-[11px] font-bold text-muted mb-1">
                      {area.label}
                    </label>
                    <textarea
                      value={periodo.items[area.value] || ""}
                      onChange={(e) => updateItem(i, area.value, e.target.value)}
                      placeholder="Descripción del currículo..."
                      rows={2}
                      className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-xs font-medium"
                    />
                  </div>
                ))}
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
