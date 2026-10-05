// app/[teamSlug]/evaluaciones/fisico/page.tsx

import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getTeamBySlug, getPlayers } from "@/lib/data";
import {
  getPhysicalEvalEnabled,
  getPhysicalMetrics,
  getPhysicalResultsForPlayer,
} from "@/lib/data-evaluaciones";

export default async function FisicoPage({
  params,
}: {
  params: { teamSlug: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  // Datos de menores: solo entrenador/asistente.
  if (team.role !== "coach" && team.role !== "assistant") notFound();

  const enabled = await getPhysicalEvalEnabled(team.id);
  if (!enabled) {
    return (
      <div className="flex h-screen w-full">
        <Sidebar currentTeamSlug={team.slug} active="evaluaciones" />
        <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
          <div className="font-display text-2xl font-bold mb-6">Evaluación físico-técnica</div>
          <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-8 text-center">
            Esta categoría no tiene activada la evaluación físico-técnica.
          </div>
        </div>
      </div>
    );
  }

  const [players, metrics] = await Promise.all([
    getPlayers(team.slug),
    getPhysicalMetrics(team.id),
  ]);

  const playersWithProgress = await Promise.all(
    players.map(async (player) => {
      const resultados = await getPhysicalResultsForPlayer(player.id);
      const metricasConDato = Object.keys(resultados).length;
      return { ...player, metricasConDato };
    })
  );

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="evaluaciones" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="text-xs text-muted mb-1">
          <Link href={`/${team.slug}/evaluaciones`} className="font-bold hover:text-text">
            Evaluaciones
          </Link>{" "}
          / Físico-técnica
        </div>
        <div className="font-display text-2xl font-bold mb-1">Evaluación físico-técnica</div>
        <div className="text-sm text-muted mb-6">
          {team.name} · {metrics.length} métricas: {metrics.map((m) => m.nombre).join(", ")}
        </div>

        <div className="flex flex-col gap-2">
          {playersWithProgress.map((player) => (
            <div
              key={player.id}
              className="flex items-center justify-between bg-panel border border-border rounded-xl px-4 py-3.5 hover:border-borderMuted transition"
            >
              <Link
                href={`/${team.slug}/evaluaciones/fisico/${player.id}`}
                className="font-bold text-sm flex-grow"
              >
                {player.full_name}
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">
                  {player.metricasConDato} / {metrics.length} métricas con dato
                </span>
                <Link
                  href={`/${team.slug}/jugador/${player.id}`}
                  className="text-xs font-bold text-gold hover:underline"
                >
                  Ver perfil
                </Link>
              </div>
            </div>
          ))}
          {players.length === 0 && (
            <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-8 text-center">
              Este equipo todavía no tiene jugadores.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
