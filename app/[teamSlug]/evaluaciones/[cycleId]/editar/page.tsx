import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import EditCurriculumForm from "@/components/EditCurriculumForm";
import { getTeamBySlug } from "@/lib/data";
import { getEvalCycle, getCurriculumItems } from "@/lib/data-evaluaciones";
import { U14_AREAS } from "@/lib/eval-shared";

export default async function EditarCurriculoPage({
  params,
}: {
  params: { teamSlug: string; cycleId: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  // Solo el entrenador (la base de datos también lo exige).
  if (team.role !== "coach") notFound();

  const cycle = await getEvalCycle(params.cycleId);
  if (!cycle || cycle.team_id !== team.id) notFound();

  const items = await getCurriculumItems(cycle.id);
  const isU14Style = items.some((i) => (U14_AREAS as readonly string[]).includes(i.area));
  const areaOptions = [...(isU14Style ? [...U14_AREAS] : ["tactico", "tecnico", "fisico", "actitudinal"]), "portero"];

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="evaluaciones" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="text-xs text-muted mb-1">
          <Link href={`/${team.slug}/evaluaciones`} className="font-bold hover:text-text">
            Evaluaciones
          </Link>{" "}
          /{" "}
          <Link href={`/${team.slug}/evaluaciones/${cycle.id}`} className="font-bold hover:text-text">
            {cycle.name}
          </Link>
        </div>
        <div className="font-display text-2xl font-bold mb-1">Editar competencias</div>
        <div className="text-sm text-muted mb-6">
          Cambiar el texto no afecta las calificaciones ya capturadas. Quitar una competencia sí borra sus
          calificaciones.
        </div>
        <EditCurriculumForm
          cycleId={cycle.id}
          teamSlug={team.slug}
          items={items.map((i) => ({
            id: i.id,
            period_label: i.period_label,
            period_order: i.period_order,
            area: i.area,
            descripcion: i.descripcion,
            item_order: (i as any).item_order ?? 0,
          }))}
          areaOptions={areaOptions}
        />
      </div>
    </div>
  );
}
