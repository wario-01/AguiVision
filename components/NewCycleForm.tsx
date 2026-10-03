"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const AREAS = [
  { value: "tactico", label: "Táctico" },
  { value: "tecnico", label: "Técnico" },
  { value: "fisico", label: "Físico" },
  { value: "actitudinal", label: "Actitudinal" },
];

const DURACIONES = [
  { value: "mensual", label: "Mensual", meses: 1 },
  { value: "trimestral", label: "Trimestral", meses: 3 },
  { value: "cuatrimestral", label: "Cuatrimestral", meses: 4 },
  { value: "semestral", label: "Semestral", meses: 6 },
  { value: "anual", label: "Anual", meses: 12 },
];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface Periodo {
  period_label: string;
  items: Record<string, string>; // area -> descripcion
}

// A partir de la fecha de inicio y la duración elegida, genera un
// periodo por cada mes (ej. trimestral desde marzo => Marzo, Abril, Mayo).
// Si ya había texto de currículo escrito para un mes, lo conserva.
function generarPeriodos(startDate: string, periodType: string, anteriores: Periodo[]): Periodo[] {
  const duracion = DURACIONES.find((d) => d.value === periodType);
  const cantidadMeses = duracion?.meses ?? 1;

  if (!startDate) {
    return Array.from({ length: cantidadMeses }, () => ({ period_label: "", items: {} }));
  }

  const [y, m] = startDate.split("-").map(Number);
  const anterioresPorLabel = new Map(anteriores.map((p) => [p.period_label, p.items]));

  return Array.from({ length: cantidadMeses }, (_, i) => {
    const mesIndex = (m - 1 + i) % 12;
    const label = MESES[mesIndex];
    return { period_label: label, items: anterioresPorLabel.get(label) ?? {} };
  });
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
  const [periodos, setPeriodos] = useState<Periodo[]>(generarPeriodos("", "trimestral", []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Regenera los meses cada vez que cambia la fecha de inicio o la
  // duración — sin que el coach tenga que agregarlos ni nombrarlos.
  useEffect(() => {
    setPeriodos((anteriores) => generarPeriodos(startDate, periodType, anteriores));
  }, [startDate, periodType]);

  function updateItem(index: number, area: string, descripcion: string) {
    const next = [...periodos];
    next[index] = { ...next[index], items: { ...next[index].items, [area]: descripcion } };
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
        {!startDate && (
          <div className="text-xs text-muted">
            Elige la fecha de inicio para que se generen los meses automáticamente.
          </div>
        )}
      </div>

      {startDate && (
        <div>
          <div className="text-sm font-bold mb-3">
            Currículo por mes ({periodos.map((p) => p.period_label).join(", ")})
          </div>

          <div className="flex flex-col gap-4">
            {periodos.map((periodo, i) => (
              <div key={periodo.period_label + i} className="bg-panel border border-border rounded-xl p-4">
                <div className="text-sm font-bold text-gold mb-3 uppercase tracking-wide">
                  {periodo.period_label}
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
      )}

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
