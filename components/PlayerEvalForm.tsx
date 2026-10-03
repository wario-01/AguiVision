'use client';

// components/PlayerEvalForm.tsx
//
// Formulario de calificación: agrupado por periodo (mes), un selector
// de nivel (5 opciones) por cada ítem de currículo. Guarda cada
// calificación individualmente al hacer click en "Guardar" de esa
// fila (autosave simple, sin tener que llenar todo antes de guardar
// nada).

import { useState } from 'react';

const NIVELES = [
  { value: 'emergente', label: 'Emergente', color: '#E6483C' },
  { value: 'en_desarrollo', label: 'En desarrollo', color: '#E08A3C' },
  { value: 'consistente', label: 'Consistente', color: '#2E7D32' },
  { value: 'autonomo_funcional', label: 'Autónomo funcional', color: '#1565C0' },
  { value: 'competente', label: 'Competente', color: '#0A1830' },
];

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

const AREA_LABELS: Record<string, string> = {
  tactico: 'Táctico',
  tecnico: 'Técnico',
  fisico: 'Físico',
  actitudinal: 'Actitudinal',
};

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
        init[itemId] = { nivel: ev.nivel, notas: ev.notas || '' };
      }
      return init;
    }
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  function setNivel(itemId: string, nivel: string) {
    setValores((v) => ({ ...v, [itemId]: { nivel, notas: v[itemId]?.notas || '' } }));
  }

  function setNotas(itemId: string, notas: string) {
    setValores((v) => ({ ...v, [itemId]: { nivel: v[itemId]?.nivel || '', notas } }));
  }

  async function guardar(itemId: string) {
    const valor = valores[itemId];
    if (!valor?.nivel) return;

    setSavingId(itemId);
    try {
      const res = await fetch('/api/evaluaciones/calificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          <h3
            className="text-sm font-bold uppercase tracking-wide mb-3"
            style={{ color: '#8CA0C7' }}
          >
            {group.period_label}
          </h3>
          <div className="flex flex-col gap-4">
            {group.items.map((item) => {
              const valor = valores[item.id] || { nivel: '', notas: '' };
              return (
                <div
                  key={item.id}
                  className="border rounded-xl p-4"
                  style={{ borderColor: '#D9D2BE' }}
                >
                  <p className="text-xs font-bold text-gray-500 mb-1">
                    {AREA_LABELS[item.area] || item.area}
                  </p>
                  <p className="text-sm mb-3">{item.descripcion}</p>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {NIVELES.map((n) => (
                      <button
                        key={n.value}
                        type="button"
                        onClick={() => setNivel(item.id, n.value)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition"
                        style={
                          valor.nivel === n.value
                            ? { background: n.color, color: '#fff', borderColor: n.color }
                            : { borderColor: '#D9D2BE', color: '#555' }
                        }
                      >
                        {n.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={valor.notas}
                      onChange={(e) => setNotas(item.id, e.target.value)}
                      placeholder="Nota opcional del coach..."
                      className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => guardar(item.id)}
                      disabled={!valor.nivel || savingId === item.id}
                      className="px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-40"
                      style={{ background: '#0A1830', color: '#F5EFD6' }}
                    >
                      {savingId === item.id
                        ? 'Guardando...'
                        : savedId === item.id
                        ? '✓ Guardado'
                        : 'Guardar'}
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
