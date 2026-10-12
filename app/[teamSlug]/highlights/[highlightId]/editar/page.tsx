import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import HighlightEditForm from "@/components/HighlightEditForm";
import { getTeamBySlug, getPlayers } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function EditarHighlightPage({
  params,
}: {
  params: { teamSlug: string; highlightId: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  if (team.role !== "coach" && team.role !== "assistant") notFound();

  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: hl } = await supabase
    .from("highlights")
    .select("id, label, player_id, shared_with_team, notas, start_seconds, end_seconds, matches!inner(team_id)")
    .eq("id", params.highlightId)
    .maybeSingle();
  if (!hl || (hl as any).matches?.team_id !== team.id) notFound();

  const players = await getPlayers(team.slug);

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="highlights" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="text-xs text-muted mb-1">
          <Link href={`/${team.slug}/highlights/${hl.id}`} className="font-bold hover:text-text">
            {hl.label}
          </Link>{" "}
          / Editar
        </div>
        <div className="font-display text-2xl font-bold mb-6">Editar highlight</div>
        <HighlightEditForm
          teamSlug={team.slug}
          highlight={{
            id: hl.id,
            label: hl.label,
            player_id: hl.player_id,
            shared_with_team: Boolean(hl.shared_with_team),
            notas: hl.notas,
            start_seconds: hl.start_seconds,
            end_seconds: hl.end_seconds,
          }}
          players={players.map((p) => ({ id: p.id, full_name: p.full_name }))}
        />
      </div>
    </div>
  );
}
