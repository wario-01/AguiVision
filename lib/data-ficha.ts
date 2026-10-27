// Datos de la ficha técnica de un jugador. Usa el cliente del usuario, así que la base de
// datos decide qué ve cada quien (el cuerpo técnico todo; las familias solo lo publicado).

import {
  getPhysicalMetrics,
  getPhysicalResultsForPlayer,
  getLatestFormativeSnapshot,
} from "@/lib/data-evaluaciones";
import { getPlayerAttendance } from "@/lib/data-asistencia";
import { statsOf } from "@/lib/asistencia";
import { computeFicha, isGoalkeeper, FichaStat } from "@/lib/ficha-shared";

export async function getFicha(player: { id: string; position?: string | null }, teamId: string) {
  const [metrics, historial, snapshot, attendance] = await Promise.all([
    getPhysicalMetrics(teamId),
    getPhysicalResultsForPlayer(player.id),
    getLatestFormativeSnapshot(player.id, teamId),
    getPlayerAttendance(player.id, new Date().getFullYear()),
  ]);

  const latest: Record<string, number> = {};
  for (const [metricId, rows] of Object.entries(historial)) {
    if (rows[0]) latest[metricId] = Number(rows[0].valor);
  }

  const att = attendance.length > 0 ? statsOf(attendance).total.pct : null;
  const goalkeeper = isGoalkeeper(player.position);
  const { ovr, stats } = computeFicha({
    metrics: metrics.map((m: any) => ({
      id: m.id,
      grupo: m.grupo ?? null,
      valor_bajo: m.valor_bajo != null ? Number(m.valor_bajo) : null,
      valor_alto: m.valor_alto != null ? Number(m.valor_alto) : null,
    })),
    latest,
    areas: snapshot?.areas ?? {},
    attendancePct: att,
    goalkeeper,
  });
  return { ovr, stats: stats as FichaStat[], goalkeeper, snapshot };
}
