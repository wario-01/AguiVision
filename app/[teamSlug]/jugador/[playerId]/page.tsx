// app/[teamSlug]/jugador/[playerId]/page.tsx
//
// Perfil de jugador unificado — foto, evaluación formativa, evaluación
// físico-técnica (si el equipo la tiene activada) e highlights
// recientes. Funciona para cualquier categoría: cada sección se
// muestra solo si hay datos para esa categoría.

import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PrintButton from "@/components/PrintButton";
import { getTeamBySlug } from "@/lib/data";
import {
  getPlayerProfile,
  getPlayerHighlights,
  getLatestFormativeSnapshot,
  getPhysicalEvalEnabled,
  getPhysicalMetrics,
  getPhysicalResultsForPlayer,
  getPhysicalTeamAverages,
  PERFIL_LABELS,
} from "@/lib/data-evaluaciones";
import FormativeRadarChart from "@/components/charts/FormativeRadarChart";
import PhysicalLineChart from "@/components/charts/PhysicalLineChart";
import PhysicalCompareBar from "@/components/charts/PhysicalCompareBar";

export default async function PerfilJugadorPage({
  params,
}: {
  params: { teamSlug: string; playerId: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  // Datos de menores: solo entrenador/asistente.
  if (team.role !== "coach" && team.role !== "assistant") notFound();

  const player = await getPlayerProfile(params.playerId);
  if (!player || player.team_id !== team.id) notFound();

  const canEdit = team.role === "coach" || team.role === "assistant";

  const physicalEnabled = await getPhysicalEvalEnabled(team.id);

  const [formativeSnapshot, highlights, metrics] = await Promise.all([
    getLatestFormativeSnapshot(player.id, team.id),
    getPlayerHighlights(player.id, 5),
    physicalEnabled ? getPhysicalMetrics(team.id) : Promise.resolve([]),
  ]);

  const historial = physicalEnabled ? await getPhysicalResultsForPlayer(player.id) : {};
  const teamAverages =
    physicalEnabled && metrics.length > 0
      ? await getPhysicalTeamAverages(team.id, metrics.map((m) => m.id))
      : {};

  const compareData = metrics
    .map((m) => {
      const ultimo = historial[m.id]?.[0];
      const promedio = teamAverages[m.id];
      if (ultimo === undefined && promedio === undefined) return null;
      return {
        metrica: m.nombre,
        jugador: ultimo?.valor ?? 0,
        equipo: promedio ?? 0,
      };
    })
    .filter(Boolean) as { metrica: string; jugador: number; equipo: number }[];

  const initials = player.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-screen w-full">
      <div className="no-print">
        <Sidebar currentTeamSlug={team.slug} active="evaluaciones" />
      </div>
      <div className="print-area flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-panel2 border border-borderMuted flex items-center justify-center font-display text-lg font-bold text-muted overflow-hidden shrink-0">
              {player.photo_url ? (
                <img src={player.photo_url} alt={player.full_name} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div>
              <div className="font-display text-2xl font-bold">{player.full_name}</div>
              <div className="text-sm text-muted">
                {team.name}
                {player.jersey_number != null && ` · #${player.jersey_number}`}
                {player.position && ` · ${player.position}`}
              </div>
              <div className="text-xs text-muted mt-0.5">
                {player.peso != null && `${player.peso} kg`}
                {player.peso != null && player.altura != null && " · "}
                {player.altura != null && `${player.altura} cm`}
                {(player.peso != null || player.altura != null) && player.perfil && " · "}
                {player.perfil && PERFIL_LABELS[player.perfil]}
              </div>
            </div>
          </div>
          <div className="no-print flex items-center gap-3">
            {canEdit && (
              <Link
                href={`/${team.slug}/jugador/${player.id}/editar`}
                className="text-xs font-bold text-gold hover:underline"
              >
                Editar datos
              </Link>
            )}
            <PrintButton />
          </div>
        </div>

        {/* ---------- Evaluación formativa ---------- */}
        <div className="mb-8">
          <div className="text-sm font-bold mb-3">Evaluación formativa</div>
          {formativeSnapshot ? (
            <div className="bg-panel border border-border rounded-xl p-4">
              <div className="text-xs text-muted mb-2">
                Último ciclo: <span className="font-bold text-text">{formativeSnapshot.cycleName}</span>
              </div>
              <FormativeRadarChart areas={formativeSnapshot.areas} />
            </div>
          ) : (
            <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-6 text-center">
              Este jugador todavía no tiene evaluaciones formativas.
            </div>
          )}
        </div>

        {/* ---------- Evaluación físico-técnica ---------- */}
        {physicalEnabled && (
          <div className="mb-8">
            <div className="text-sm font-bold mb-3">Evaluación físico-técnica</div>
            {compareData.length === 0 ? (
              <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-6 text-center">
                Este jugador todavía no tiene resultados físico-técnicos.
              </div>
            ) : (
              <>
                <div className="bg-panel border border-border rounded-xl p-4 mb-4">
                  <div className="text-xs text-muted mb-2">Jugador vs. promedio del equipo</div>
                  <PhysicalCompareBar data={compareData} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {metrics.map((m) => {
                    const rows = historial[m.id] || [];
                    if (rows.length < 2) return null;
                    return (
                      <div key={m.id} className="bg-panel border border-border rounded-xl p-4">
                        <div className="text-xs font-bold text-gold uppercase tracking-wide mb-2">
                          {m.nombre}
                        </div>
                        <PhysicalLineChart
                          data={rows.map((r) => ({ fecha: r.fecha, valor: r.valor }))}
                          unidad={m.unidad}
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ---------- Highlights recientes ---------- */}
        <div>
          <div className="text-sm font-bold mb-3">Highlights recientes</div>
          {highlights.length === 0 ? (
            <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-6 text-center">
              Este jugador todavía no tiene highlights.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {highlights.map((h) => (
                <Link
                  key={h.id}
                  href={`/${team.slug}/highlights/${h.id}`}
                  className="no-print flex items-center justify-between bg-panel border border-border rounded-xl px-4 py-3 hover:border-borderMuted transition"
                >
                  <div>
                    <div className="font-bold text-sm">{h.label}</div>
                    <div className="text-xs text-muted">
                      vs {h.match_opponent} · {h.match_date} · min {h.minute}
                    </div>
                  </div>
                  <div className="text-xs text-muted">{h.duration}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
