import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import EventEditForm from "@/components/EventEditForm";
import TournamentGames from "@/components/TournamentGames";
import { getTeamBySlug, getTournamentGames } from "@/lib/data";
import { clubParts, clubTime } from "@/lib/tz";
import { createClient } from "@/lib/supabase/server";

export default async function EditarEventoPage({ params }: { params: { teamSlug: string; eventId: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  if (team.role !== "coach" && team.role !== "assistant") notFound();

  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: event } = await supabase.from("events").select("*").eq("id", params.eventId).single();
  if (!event || event.team_id !== team.id) notFound();

  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const games =
    event.type === "tournament"
      ? (await getTournamentGames([event.id])).map((g) => {
          const p = clubParts(g.start_at);
          return {
            id: g.id,
            opponent: g.opponent,
            location: g.location && g.location !== event.location ? g.location : null,
            label: `${DIAS[p.dow]} ${p.day} ${MESES[p.month]} · ${clubTime(g.start_at)}`,
          };
        })
      : [];

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="calendario" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="text-xs text-muted mb-1">
          <Link href={`/${team.slug}/calendario`} className="font-bold hover:text-text">
            Calendario
          </Link>{" "}
          / Editar evento
        </div>
        <div className="font-display text-2xl font-bold mb-6">Editar evento</div>
        <EventEditForm
          teamSlug={team.slug}
          initial={{
            id: event.id,
            type: event.type,
            title: event.title,
            opponent: event.opponent,
            league: event.league,
            location: event.location,
            start_at: event.start_at,
            end_at: event.end_at,
            notes: event.notes,
          }}
        />
        {event.type === "tournament" && (
          <TournamentGames
            teamSlug={team.slug}
            tournamentId={event.id}
            league={event.league}
            location={event.location}
            startDate={clubParts(event.start_at).ymd}
            games={games}
          />
        )}
      </div>
    </div>
  );
}
