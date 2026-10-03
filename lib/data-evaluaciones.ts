// lib/data-evaluaciones.ts
//
// Funciones de datos para la evaluación formativa (niveles) y la
// evaluación físico-técnica (métricas numéricas).
//
// Este es un archivo NUEVO — no reemplaza tu lib/data.ts existente.
// Usa el mismo patrón de cliente de Supabase que ya usas en lib/data.ts
// (createClient desde '@/lib/supabase/server'). Si tu import real tiene
// otro nombre o ruta, ajusta la línea de abajo.

import { createClient } from '@/lib/supabase/server';

export const NIVELES = [
  { value: 'emergente', label: 'Emergente' },
  { value: 'en_desarrollo', label: 'En desarrollo' },
  { value: 'consistente', label: 'Consistente' },
  { value: 'autonomo_funcional', label: 'Autónomo funcional' },
  { value: 'competente', label: 'Competente' },
] as const;

export const AREAS = [
  { value: 'tactico', label: 'Táctico' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'fisico', label: 'Físico' },
  { value: 'actitudinal', label: 'Actitudinal' },
] as const;

export type Nivel = typeof NIVELES[number]['value'];
export type Area = typeof AREAS[number]['value'];

export interface EvalCycle {
  id: string;
  team_id: string;
  name: string;
  period_type: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface CurriculumItem {
  id: string;
  cycle_id: string;
  period_label: string;
  period_order: number;
  area: Area;
  descripcion: string;
}

export interface FormativeEvaluation {
  id: string;
  player_id: string;
  curriculum_item_id: string;
  nivel: Nivel;
  notas: string | null;
  updated_at: string;
}

// ---------- Ciclos ----------

export async function getEvalCycles(teamId: string): Promise<EvalCycle[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('eval_cycles')
    .select('*')
    .eq('team_id', teamId)
    .order('start_date', { ascending: false });

  if (error) {
    console.error('getEvalCycles error', error);
    return [];
  }
  return data ?? [];
}

export async function getEvalCycle(cycleId: string): Promise<EvalCycle | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('eval_cycles')
    .select('*')
    .eq('id', cycleId)
    .single();

  if (error) {
    console.error('getEvalCycle error', error);
    return null;
  }
  return data;
}

// ---------- Currículo ----------

export async function getCurriculumItems(cycleId: string): Promise<CurriculumItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('eval_curriculum_items')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('period_order', { ascending: true });

  if (error) {
    console.error('getCurriculumItems error', error);
    return [];
  }
  return data ?? [];
}

// Agrupa los items de currículo por periodo (mes), para pintar la
// pantalla de calificación agrupada por "Marzo", "Abril", etc.
export function groupCurriculumByPeriod(items: CurriculumItem[]) {
  const groups = new Map<string, CurriculumItem[]>();
  for (const item of items) {
    const key = item.period_label;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries()).map(([period_label, items]) => ({
    period_label,
    items,
  }));
}

// ---------- Evaluaciones por jugador ----------

export async function getFormativeEvaluationsForPlayer(
  playerId: string,
  cycleId: string
): Promise<Record<string, FormativeEvaluation>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('formative_evaluations')
    .select('*, eval_curriculum_items!inner(cycle_id)')
    .eq('player_id', playerId)
    .eq('eval_curriculum_items.cycle_id', cycleId);

  if (error) {
    console.error('getFormativeEvaluationsForPlayer error', error);
    return {};
  }

  const byItem: Record<string, FormativeEvaluation> = {};
  for (const row of data ?? []) {
    byItem[row.curriculum_item_id] = row;
  }
  return byItem;
}

// Progreso de un jugador a través de TODOS los ciclos — para la
// gráfica de línea en el perfil del jugador. Devuelve, por ciclo,
// el nivel promedio (como número 1-5) para poder graficarlo.
const NIVEL_A_NUMERO: Record<Nivel, number> = {
  emergente: 1,
  en_desarrollo: 2,
  consistente: 3,
  autonomo_funcional: 4,
  competente: 5,
};

export async function getProgresoFormativo(playerId: string, teamId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('formative_evaluations')
    .select(
      'nivel, eval_curriculum_items!inner(area, cycle_id, eval_cycles!inner(name, start_date, team_id))'
    )
    .eq('player_id', playerId);

  if (error) {
    console.error('getProgresoFormativo error', error);
    return [];
  }

  // Agrupa por ciclo, calcula promedio de nivel (1-5) por área
  const porCiclo = new Map<
    string,
    { cycleName: string; startDate: string; areas: Record<string, number[]> }
  >();

  for (const row of data ?? []) {
    const item: any = row.eval_curriculum_items;
    const cycle = item?.eval_cycles;
    if (!cycle || cycle.team_id !== teamId) continue;
    const cycleKey = cycle.name + cycle.start_date;
    if (!porCiclo.has(cycleKey)) {
      porCiclo.set(cycleKey, { cycleName: cycle.name, startDate: cycle.start_date, areas: {} });
    }
    const entry = porCiclo.get(cycleKey)!;
    if (!entry.areas[item.area]) entry.areas[item.area] = [];
    entry.areas[item.area].push(NIVEL_A_NUMERO[row.nivel as Nivel]);
  }

  return Array.from(porCiclo.values())
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((entry) => {
      const promedios: Record<string, number> = {};
      for (const [area, valores] of Object.entries(entry.areas)) {
        promedios[area] = valores.reduce((a, b) => a + b, 0) / valores.length;
      }
      return { ciclo: entry.cycleName, ...promedios };
    });
}
