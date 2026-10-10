// lib/data-personas.ts
//
// Jugadores que juegan en más de un equipo: cada equipo tiene su propio
// registro del niño, y los registros que comparten person_id son "el mismo".

import { createClient } from "@/lib/supabase/server";
import { getMyTeams } from "@/lib/data";

export interface PlayerLinkRow {
  id: string;
  full_name: string;
  team_name: string;
}

// Registros del mismo niño en OTROS equipos de los que quien mira es
// entrenador/asistente (linked), y los que podría vincular (candidates).
export async function getLinkOptions(
  personId: string,
  currentTeamId: string
): Promise<{ linked: PlayerLinkRow[]; candidates: PlayerLinkRow[]; teams: { id: string; name: string }[] }> {
  const supabase = await createClient();
  if (!supabase) return { linked: [], candidates: [], teams: [] };

  const teams = (await getMyTeams()).filter(
    (t) => t.id !== currentTeamId && (t.role === "coach" || t.role === "assistant")
  );
  if (teams.length === 0) return { linked: [], candidates: [], teams: [] };

  const { data } = await supabase
    .from("players")
    .select("id, full_name, person_id, team_id, teams(name)")
    .in(
      "team_id",
      teams.map((t) => t.id)
    )
    .order("full_name");

  const rows = (data ?? []).map((p: any) => ({
    id: p.id as string,
    full_name: p.full_name as string,
    person_id: p.person_id as string,
    team_name: (p.teams?.name ?? "") as string,
  }));

  return {
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
    linked: rows.filter((r) => r.person_id === personId).map(({ id, full_name, team_name }) => ({ id, full_name, team_name })),
    candidates: rows
      .filter((r) => r.person_id !== personId)
      .map(({ id, full_name, team_name }) => ({ id, full_name, team_name })),
  };
}
