// app/[teamSlug]/mi-evaluacion/page.tsx
//
// Evaluación del jugador para su familia (papá/mamá o jugador vinculado).
// Solo se ve lo que el entrenador PUBLICÓ y solo del hijo vinculado: lo exige
// la base de datos (RLS), no solo esta página.

import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { getTeamBySlug, getPlayers } from "@/lib/data";
import {
  NIVELES,
  AREAS,
  getEvalCycles,
  getCurriculumItems,
  groupCurriculumByPeriod,
  getFormativeEvaluationsForPlayer,
  getProgresoFormativo,
  getPhysicalEvalEnabled,
  getPhysicalMetrics,
  getPhysicalResultsForPlayer,
} from "@/lib/data-evaluaciones";

const NIVEL_NUM: Record<string, number> = {
  emergente: 1,
  en_desarrollo: 2,
  consistente: 3,
  autonomo_funcional: 4,
  competente: 5,
};

function nivelLabel(v: string) {
  return NIVELES.find((n) => n.value === v)?.label ?? v;
}
function areaLabel(v: string) {
  return AREAS.find((a) => a.value === v)?.label ?? v;
}
function fechaCorta(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function NivelBar({ nivel }: { nivel: string }) {
  const n = NIVEL_NUM[nivel] ?? 0;
  return (
    <div className="flex gap-1" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 w-6 rounded-full ${i <= n ? "bg-gold" : "bg-borderMuted"}`} />
      ))}
    </div>
  );
}

export default async function MiEvaluacionPage({ params }: { params: { teamSlug: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  if ((team.role !== "parent" && team.role !== "player") || !team.player_id) notFound();

  // Todos los hijos vinculados a esta cuenta en este equipo (puede ser más de uno).
  const supabase = await createClient();
  const { data: userData } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  let playerIds: string[] = [team.player_id];
  if (supabase && userData.user) {
    const { data: links } = await supabase
      .from("team_members")
      .select("player_id")
      .eq("team_id", team.id)
      .eq("profile_id", userData.user.id)
      .not("player_id", "is", null);
    const ids = (links ?? []).map((r: any) => r.player_id as string);
    if (ids.length > 0) playerIds = Array.from(new Set(ids));
  }

  const allPlayers = await getPlayers(team.slug);
  const kids = playerIds
    .map((id) => allPlayers.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);

  const [cycles, physicalEnabled, metrics] = await Promise.all([
    getEvalCycles(team.id), // la base de datos solo devuelve los ciclos publicados
    getPhysicalEvalEnabled(team.id),
    getPhysicalMetrics(team.id),
  ]);

  const cycleData = await Promise.all(
    cycles.map(async (c) => ({ cycle: c, items: await getCurriculumItems(c.id) }))
  );

  const perKid = await Promise.all(
    kids.map(async (kid) => {
      const formativo = await Promise.all(
        cycleData.map(async ({ cycle, items }) => ({
          cycle,
          groups: groupCurriculumByPeriod(items),
          evals: await getFormativeEvaluationsForPlayer(kid.id, cycle.id),
        }))
      );
      const progreso = await getProgresoFormativo(kid.id, team.id);
      const fisico = physicalEnabled ? await getPhysicalResultsForPlayer(kid.id) : {};
      return { kid, formativo, progreso, fisico };
    })
  );

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="evaluaciones" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="font-display text-2xl font-bold mb-1">Evaluación</div>
        <div className="text-sm text-muted mb-6">{team.name}</div>

        {perKid.map(({ kid, formativo, progreso, fisico }) => {
          const conEval = formativo.filter((f) => Object.keys(f.evals).length > 0);
          const hayFisico = Object.values(fisico).some((arr) => arr.length > 0);
          return (
            <div key={kid.id} className="mb-12">
              {perKid.length > 1 && (
                <div className="font-display text-xl font-bold mb-4 text-gold">{kid.full_name}</div>
              )}

              {conEval.length === 0 && !hayFisico && (
                <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-8 text-center">
                  Todavía no hay evaluaciones publicadas para {kid.full_name}. Cuando el entrenador las publique,
                  aparecerán aquí.
                </div>
              )}

              {/* Progreso entre ciclos */}
              {progreso.length >= 2 && (
                <div className="mb-8">
                  <div className="font-display text-lg font-semibold mb-3">Progreso</div>
                  <div className="bg-panel border border-border rounded-2xl overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted text-left border-b border-border">
                          <th className="px-4 py-2.5 font-bold">Ciclo</th>
                          {AREAS.map((a) => (
                            <th key={a.value} className="px-3 py-2.5 font-bold">
                              {a.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {progreso.map((row: any) => (
                          <tr key={row.ciclo} className="border-b border-border last:border-0">
                            <td className="px-4 py-2.5 font-bold">{row.ciclo}</td>
                            {AREAS.map((a) => (
                              <td key={a.value} className="px-3 py-2.5 text-muted">
                                {row[a.value] != null ? `${Number(row[a.value]).toFixed(1)} / 5` : "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-xs text-muted mt-2">
                    Promedio por área en una escala de 1 (Emergente) a 5 (Competente).
                  </div>
                </div>
              )}

              {/* Evaluación formativa por ciclo */}
              {conEval.map(({ cycle, groups, evals }) => (
                <div key={cycle.id} className="mb-8">
                  <div className="font-display text-lg font-semibold">{cycle.name}</div>
                  <div className="text-xs text-muted mb-3">
                    {fechaCorta(cycle.start_date)} – {fechaCorta(cycle.end_date)}
                  </div>
                  {groups.map((g: any) => {
                    const rows = g.items.filter((it: any) => evals[it.id]);
                    if (rows.length === 0) return null;
                    return (
                      <div key={g.label ?? g.period_label} className="mb-4">
                        <div className="text-xs font-bold text-muted uppercase tracking-wide mb-2">
                          {g.label ?? g.period_label}
                        </div>
                        <div className="bg-panel border border-border rounded-2xl overflow-hidden">
                          {rows.map((it: any, i: number) => {
                            const ev = evals[it.id];
                            return (
                              <div
                                key={it.id}
                                className={`px-4 py-3 ${i < rows.length - 1 ? "border-b border-border" : ""}`}
                              >
                                <div className="text-xs font-bold text-gold mb-0.5">{areaLabel(it.area)}</div>
                                <div className="text-sm mb-2">{it.descripcion}</div>
                                <div className="flex items-center gap-3">
                                  <NivelBar nivel={ev.nivel} />
                                  <span className="text-xs font-bold">{nivelLabel(ev.nivel)}</span>
                                </div>
                                {ev.notas && <div className="text-xs text-muted mt-2">{ev.notas}</div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Evaluación físico-técnica */}
              {hayFisico && (
                <div className="mb-4">
                  <div className="font-display text-lg font-semibold mb-3">Pruebas físico-técnicas</div>
                  <div className="flex flex-col gap-3">
                    {metrics
                      .filter((m) => (fisico[m.id] ?? []).length > 0)
                      .map((m) => {
                        const hist = fisico[m.id]; // más reciente primero
                        const ultimo = hist[0];
                        const primero = hist[hist.length - 1];
                        const mejoro =
                          hist.length > 1 &&
                          (m.mejor_direccion === "menor" ? ultimo.valor < primero.valor : ultimo.valor > primero.valor);
                        const empeoro =
                          hist.length > 1 &&
                          (m.mejor_direccion === "menor" ? ultimo.valor > primero.valor : ultimo.valor < primero.valor);
                        return (
                          <div key={m.id} className="bg-panel border border-border rounded-2xl px-4 py-3">
                            <div className="flex items-baseline justify-between gap-3">
                              <div className="text-sm font-bold">{m.nombre}</div>
                              <div className="font-display text-lg font-bold">
                                {ultimo.valor} <span className="text-xs text-muted font-medium">{m.unidad}</span>
                              </div>
                            </div>
                            <div className="text-xs text-muted mt-1">
                              Último resultado: {fechaCorta(ultimo.fecha)}
                              {hist.length > 1 && (
                                <>
                                  {" · "}
                                  {mejoro ? "mejoró" : empeoro ? "bajó" : "igual"} desde {primero.valor}{" "}
                                  ({fechaCorta(primero.fecha)})
                                </>
                              )}
                            </div>
                            {hist.length > 1 && (
                              <div className="text-xs text-muted mt-1">
                                Historial: {[...hist].reverse().map((r) => r.valor).join(" → ")}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
