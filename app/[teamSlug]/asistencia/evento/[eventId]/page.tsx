// app/[teamSlug]/asistencia/evento/[eventId]/page.tsx
//
// Tomar (o corregir) la asistencia de un entrenamiento, partido o torneo.

import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AttendanceForm from "@/components/AttendanceForm";
import { getTeamBySlug, getPlayers } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getEventAttendance } from "@/lib/data-asistencia";
import { eventName, formatEventDate } from "@/lib/asistencia";

export default async function TomarAsistenciaPage({
  params,
}: {
  params: { teamSlug: string; eventId: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  if (team.role !== "coach" && team.role !== "assistant") notFound();

  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: event } = await supabase.from("events").select("*").eq("id", params.eventId).single();
  if (!event || event.team_id !== team.id) notFound();

  const [players, initial] = await Promise.all([getPlayers(team.slug), getEventAttendance(event.id)]);
  const name = eventName({ event_type: event.type, title: event.title, opponent: event.opponent });

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="asistencia" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="text-xs text-muted mb-1">
          <Link href={`/${team.slug}/asistencia`} className="font-bold hover:text-text">
            Asistencia
          </Link>{" "}
          / Tomar asistencia
        </div>
        <div className="font-display text-2xl font-bold mb-1">{name}</div>
        <div className="text-sm text-muted mb-6">
          {team.name} · {formatEventDate(event.start_at)}
        </div>

        <AttendanceForm
          eventId={event.id}
          teamSlug={team.slug}
          players={players.map((p) => ({ id: p.id, full_name: p.full_name, jersey_number: p.jersey_number ?? null }))}
          initial={initial}
        />
      </div>
    </div>
  );
}
