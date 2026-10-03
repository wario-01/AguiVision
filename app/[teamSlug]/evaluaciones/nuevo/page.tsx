// app/[teamSlug]/evaluaciones/nuevo/page.tsx

import { getTeamBySlug } from '@/lib/data';
import NewCycleForm from '@/components/NewCycleForm';

export default async function NuevoCicloPage({
  params,
}: {
  params: { teamSlug: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) {
    return <div className="p-8">Equipo no encontrado.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-8" style={{ color: '#0A1830' }}>
        Nuevo ciclo de evaluación
      </h1>
      <NewCycleForm teamId={team.id} teamSlug={team.slug} />
    </div>
  );
}
