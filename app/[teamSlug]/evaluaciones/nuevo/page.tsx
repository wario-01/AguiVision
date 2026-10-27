import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getTeamBySlug } from "@/lib/data";
import NewCycleForm from "@/components/NewCycleForm";
import NewCycleFormU14 from "@/components/NewCycleFormU14";
import { getEvalCycles, getCurriculumItems } from "@/lib/data-evaluaciones";
import { U14_AREAS, U14_TEMPLATE, PORTERO_AREA, PORTERO_TEMPLATE } from "@/lib/eval-shared";

export default async function NuevoCicloPage({
  params,
}: {
  params: { teamSlug: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  // Datos de menores: solo entrenador/asistente.
  if (team.role !== "coach" && team.role !== "assistant") notFound();

  // U14 evalúa por competencias: se precarga con el ciclo anterior (o con la plantilla).
  const isU14 = team.age_category?.toUpperCase() === "U14";
  let u14Initial = [...U14_TEMPLATE, ...PORTERO_TEMPLATE];
  let u14Source = "el documento de competencias U14";
  if (isU14) {
    const cycles = await getEvalCycles(team.id);
    for (const c of cycles) {
      const prev = (await getCurriculumItems(c.id)).filter((i) => (U14_AREAS as readonly string[]).includes(i.area) || i.area === PORTERO_AREA);
      if (prev.length > 0) {
        u14Initial = prev.map((i) => ({ area: i.area, descripcion: i.descripcion }));
        if (!u14Initial.some((i) => i.area === PORTERO_AREA)) u14Initial = [...u14Initial, ...PORTERO_TEMPLATE];
        u14Source = `el ciclo anterior (${c.name})`;
        break;
      }
    }
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="evaluaciones" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="font-display text-2xl font-bold mb-1">Nuevo ciclo de evaluación</div>
        <div className="text-sm text-muted mb-6">{team.name}</div>
        {isU14 ? (
          <NewCycleFormU14 teamId={team.id} teamSlug={team.slug} initial={u14Initial} source={u14Source} />
        ) : (
          <NewCycleForm teamId={team.id} teamSlug={team.slug} />
        )}
      </div>
    </div>
  );
}
