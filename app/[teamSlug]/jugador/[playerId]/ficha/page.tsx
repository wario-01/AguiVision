// Ficha técnica imprimible. La ve el cuerpo técnico (cualquier jugador) y cada familia
// (solo su hijo). Los datos salen del mismo lugar que el perfil, así que la base de datos
// decide qué se ve (las familias solo ven lo que el entrenador publicó).

import Link from "next/link";
import { notFound } from "next/navigation";
import PlayerCard from "@/components/PlayerCard";
import PrintButton from "@/components/PrintButton";
import { createClient } from "@/lib/supabase/server";
import { getTeamBySlug, getPlayers } from "@/lib/data";
import { getFicha } from "@/lib/data-ficha";
import { cardName, positionAbbr, isGoalkeeper } from "@/lib/ficha-shared";

export default async function FichaPage({ params }: { params: { teamSlug: string; playerId: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  const isStaff = team.role === "coach" || team.role === "assistant";
  if (!isStaff) {
    // Familia: solo los hijos vinculados a su cuenta.
    if ((team.role !== "parent" && team.role !== "player") || !team.player_id) notFound();
    const supabase = await createClient();
    const { data: userData } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
    if (!supabase || !userData.user) notFound();
    const { data: links } = await supabase
      .from("team_members")
      .select("player_id")
      .eq("team_id", team.id)
      .eq("profile_id", userData.user.id)
      .not("player_id", "is", null);
    const ids = (links ?? []).map((r: any) => r.player_id as string);
    if (!ids.includes(params.playerId)) notFound();
  }

  const players = await getPlayers(team.slug);
  const player = players.find((p) => p.id === params.playerId);
  if (!player) notFound();

  const ficha = await getFicha(player, team.id);
  const backHref = isStaff ? `/${team.slug}/jugador/${player.id}` : `/${team.slug}/mi-evaluacion`;
  const sub = [player.jersey_number != null ? `#${player.jersey_number}` : null, isGoalkeeper(player.position) ? "Portero" : player.position]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="ficha-page min-h-screen bg-bg px-5 py-8 flex flex-col items-center">
      <div className="no-print w-full max-w-sm mb-5 flex items-center justify-between">
        <Link href={backHref} className="text-sm text-muted font-semibold">
          ← Volver
        </Link>
        <PrintButton />
      </div>
      <div className="ficha-card w-full max-w-sm">
        <PlayerCard
          uid="ficha"
          ovr={ficha.ovr}
          pos={positionAbbr(player.position)}
          team={team.age_category}
          name={cardName(player.full_name)}
          sub={sub || "Nido Austin"}
          photoUrl={player.photo_url}
          stats={ficha.stats}
        />
      </div>
      <div className="no-print text-xs text-muted text-center mt-5 max-w-sm leading-relaxed">
        Cada dato va de 40 a 99 y sale de las pruebas físicas y de la evaluación del jugador. El número grande es el
        promedio. Los datos con “--” todavía no tienen resultados.
      </div>
    </div>
  );
}
