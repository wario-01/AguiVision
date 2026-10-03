"use client";

import { useState } from "react";

const NIVELES = [
  { value: "emergente", label: "Emergente" },
  { value: "en_desarrollo", label: "En desarrollo" },
  { value: "consistente", label: "Consistente" },
  { value: "autonomo_funcional", label: "Autónomo funcional" },
  { value: "competente", label: "Competente" },
];

const AREA_LABELS: Record<string, string> = {
  tactico: "Táctico",
  tecnico: "Técnico",
  fisico: "Físico",
  actitudinal: "Actitudinal",
};

interface CurriculumItem {
  id: string;
  period_label: string;
  area: string;
  descripcion: string;
}

interface Evaluacion {
  nivel: string;
  notas: string | null;
}

export default function PlayerEvalForm({
  playerId,
  groups,
  evaluaciones,
}: {
  playerId: string;
  groups: { period_label: string; items: CurriculumItem[] }[];
  evaluaciones: Record<string, Evaluacion>;
}) {
  const [valores, setValores] = useState<Record<string, { nivel: string; notas: string }>>(
    () => {
      const init: Record<string, { nivel: string; notas: string }> = {};
      for (const [itemId, ev] of Object.entries(evaluaciones)) {
        init[itemId] = { nivel: ev.nivel, notas: ev.notas || "" };
      }
      return init;
    }
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  function setNivel(itemId: string, nivel: string) {
    setValores((v) => ({ ...v, [itemId]: { nivel, notas: v[itemId]?.notas || "" } }));
  }

  function setNotas(itemId: string, notas: string) {
    setValores((v) => ({ ...v, [itemId]: { nivel: v[itemId]?.nivel || "", notas } }));
  }

  async function guardar(itemId: string) {
    const valor = valores[itemId];
    if (!valor?.nivel) return;

    setSavingId(itemId);
    try {
      const res = await fetch("/api/evaluaciones/calificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: playerId,
          curriculum_item_id: itemId,
          nivel: valor.nivel,
          notas: valor.notas,
        }),
      });
      if (res.ok) {
        setSavedId(itemId);
        setTimeout(() => setSavedId(null), 1500);
      }
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <div key={group.period_label}>
          <div className="text-xs font-bold uppercase tracking-wide text-gold mb-3">
            {group.period_label}
          </div>
          <div className="flex flex-col gap-3">
            {group.items.map((item) => {
              const valor = valores[item.id] || { nivel: "", notas: "" };
              return (
                <div key={item.id} className="bg-panel border border-border rounded-xl p-4">
                  <div className="text-[11px] font-bold text-muted mb-1">
                    {AREA_LABELS[item.area] || item.area}
                  </div>
                  <div className="text-sm mb-3">{item.descripcion}</div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {NIVELES.map((n) => {
                      const isSelected = valor.nivel === n.value;
                      return (
                        <button
                          key={n.value}
                          type="button"
                          onClick={() => setNivel(item.id, n.value)}
                          className={`rounded-full px-3 py-1.5 text-xs font-bold border ${
                            isSelected
                              ? "bg-gold text-bg border-gold"
                              : "border-border text-muted hover:text-text"
                          }`}
                        >
                          {n.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={valor.notas}
                      onChange={(e) => setNotas(item.id, e.target.value)}
                      placeholder="Nota opcional del coach..."
                      className="flex-grow box-border bg-bg border border-border rounded-lg px-3 py-1.5 text-xs font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => guardar(item.id)}
                      disabled={!valor.nivel || savingId === item.id}
                      className="bg-gold text-bg rounded-lg px-4 py-1.5 text-xs font-extrabold disabled:opacity-40 shrink-0"
                    >
                      {savingId === item.id
                        ? "Guardando..."
                        : savedId === item.id
                        ? "✓ Guardado"
                        : "Guardar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
