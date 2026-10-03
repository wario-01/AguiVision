import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getTeamBySlug } from "@/lib/data";
import { getEvalCycles, getPhysicalEvalEnabled } from "@/lib/data-evaluaciones";

export default async function EvaluacionesPage({
  params,
}: {
  params: { teamSlug: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  const isCoach = team.role === "coach";
  const [cycles, physicalEnabled] = await Promise.all([
    getEvalCycles(team.id),
    getPhysicalEvalEnabled(team.id),
  ]);

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="evaluaciones" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <div className="font-display text-2xl font-bold">Evaluación del jugador</div>
          {isCoach && (
            <Link
              href={`/${team.slug}/evaluaciones/nuevo`}
              className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold"
            >
              + Nuevo ciclo
            </Link>
          )}
        </div>
        <div className="text-sm text-muted mb-6">{team.name}</div>

        {physicalEnabled && (
          <Link
            href={`/${team.slug}/evaluaciones/fisico`}
            className="flex items-center justify-between bg-panel2 border border-borderMuted rounded-xl px-4 py-3.5 hover:border-border transition mb-6"
          >
            <span className="font-bold text-sm">Evaluación físico-técnica</span>
            <span className="text-xs text-gold font-bold">Ver →</span>
          </Link>
        )}

        {cycles.length === 0 ? (
          <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-8 text-center">
            Todavía no hay ciclos de evaluación para {team.name}.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {cycles.map((cycle) => (
              <Link
                key={cycle.id}
                href={`/${team.slug}/evaluaciones/${cycle.id}`}
                className="bg-panel border border-border rounded-xl px-4 py-3.5 hover:border-borderMuted transition"
              >
                <div className="font-bold text-sm">{cycle.name}</div>
                <div className="text-xs text-muted mt-0.5">
                  {cycle.start_date} — {cycle.end_date} · {cycle.period_type}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
