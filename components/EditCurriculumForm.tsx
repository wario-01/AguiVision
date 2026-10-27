"use client";

// Editar las competencias de un ciclo que ya existe. Cambiar texto no afecta las
// calificaciones ya capturadas; quitar una competencia sí borra sus calificaciones.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AREA_LABELS } from "@/lib/eval-shared";

type Item = { id: string; period_label: string; period_order: number; area: string; descripcion: string; item_order: number };
type NewItem = { tmp: number; period_label: string; period_order: number; area: string; descripcion: string };

export default function EditCurriculumForm({
  cycleId,
  teamSlug,
  items,
  areaOptions,
}: {
  cycleId: string;
  teamSlug: string;
  items: Item[];
  areaOptions: string[];
}) {
  const router = useRouter();
  const [texts, setTexts] = useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.id, i.descripcion])));
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<NewItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periods = Array.from(new Map(items.map((i) => [i.period_label, i.period_order])).entries()).sort((a, b) => a[1] - b[1]);
  const maxOrder = Math.max(0, ...items.map((i) => i.item_order));

  function addItem(period_label: string, period_order: number, area: string) {
    setAdded((a) => [...a, { tmp: Date.now() + a.length, period_label, period_order, area, descripcion: "" }]);
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const updates = items
        .filter((i) => !removed.has(i.id) && texts[i.id] !== i.descripcion && texts[i.id].trim())
        .map((i) => ({ id: i.id, descripcion: texts[i.id] }));
      const res = await fetch("/api/evaluaciones/curriculo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleId,
          updates,
          removals: Array.from(removed),
          additions: added.map((a, idx) => ({ ...a, item_order: maxOrder + 1 + idx })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo guardar.");
        setSaving(false);
        return;
      }
      router.push(`/${teamSlug}/evaluaciones/${cycleId}`);
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setSaving(false);
    }
  }

  function quitar(id: string) {
    if (!confirm("Al quitar esta competencia también se borran las calificaciones que ya se capturaron en ella. ¿Quitarla?")) return;
    setRemoved((r) => new Set(r).add(id));
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="bg-amberBg text-amberText border border-borderMuted rounded-lg p-3 text-sm font-semibold">{error}</div>
      )}
      {periods.map(([label]) => (
        <div key={label}>
          {periods.length > 1 && (
            <div className="text-xs font-extrabold uppercase tracking-wider text-gold mb-2">{label}</div>
          )}
          <div className="flex flex-col gap-2.5">
            {items
              .filter((i) => i.period_label === label && !removed.has(i.id))
              .map((i) => (
                <div key={i.id} className="bg-panel border border-border rounded-xl p-3">
                  <div className="text-[11px] font-bold text-muted mb-1.5">{AREA_LABELS[i.area] ?? i.area}</div>
                  <div className="flex gap-2 items-start">
                    <textarea
                      value={texts[i.id]}
                      onChange={(e) => setTexts((t) => ({ ...t, [i.id]: e.target.value }))}
                      rows={3}
                      className="flex-grow box-border bg-bg border border-border rounded-lg px-3 py-2 text-xs font-medium"
                    />
                    <button type="button" onClick={() => quitar(i.id)} className="text-xs font-bold text-red shrink-0 pt-1">
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            {added
              .filter((a) => a.period_label === label)
              .map((a) => (
                <div key={a.tmp} className="bg-panel border border-goldBorderDim rounded-xl p-3">
                  <div className="text-[11px] font-bold text-gold mb-1.5">Nueva · {AREA_LABELS[a.area] ?? a.area}</div>
                  <div className="flex gap-2 items-start">
                    <textarea
                      value={a.descripcion}
                      onChange={(e) =>
                        setAdded((all) => all.map((x) => (x.tmp === a.tmp ? { ...x, descripcion: e.target.value } : x)))
                      }
                      rows={3}
                      placeholder="Competencia..."
                      className="flex-grow box-border bg-bg border border-border rounded-lg px-3 py-2 text-xs font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setAdded((all) => all.filter((x) => x.tmp !== a.tmp))}
                      className="text-xs font-bold text-red shrink-0 pt-1"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {areaOptions.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => addItem(label, periods.find((p) => p[0] === label)![1], area)}
                  className="text-xs font-bold text-gold hover:underline"
                >
                  + {AREA_LABELS[area] ?? area}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold self-start disabled:opacity-60"
      >
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
}
