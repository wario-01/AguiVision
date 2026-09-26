import { createClient, isSupabaseConfigured } from "./supabase/server";

export type Role = "coach" | "assistant" | "player" | "parent";

export type Team = {
  id: string;
  slug: string;
  name: string;
  age_category: string;
  active: boolean;
  role?: Role; // presente cuando viene de getMyTeams()
};

export type CurrentUser = {
  id: string;
  email: string;
  full_name: string;
};

export type Match = {
  id: string;
  team_id: string;
  opponent: string;
  match_date: string;
  duration_seconds: number | null;
  video_status: "none" | "uploading" | "processing" | "ready";
  video_playback_id?: string | null;
};

export type Highlight = {
  id: string;
  match_id: string;
  player_name: string;
  label: string;
  minute: number;
  duration: string;
  clip_playback_id?: string | null;
};

export type LiveStream = {
  id: string;
  team_id: string;
  team_name: string;
  title: string;
  status: "scheduled" | "live" | "ended";
  viewer_count: number;
};

// ---------- Datos de ejemplo (modo demo, sin Supabase configurado) ----------

const SEED_TEAMS: Team[] = [
  { id: "t-u9", slug: "u9", name: "Sub-9 Águilas", age_category: "U9", active: false },
  { id: "t-u11", slug: "u11", name: "Sub-11 Águilas", age_category: "U11", active: true, role: "coach" },
  { id: "t-u12", slug: "u12", name: "Sub-12 Águilas", age_category: "U12", active: false },
  { id: "t-u14", slug: "u14", name: "Sub-14 Águilas", age_category: "U14", active: true, role: "coach" },
];

const SEED_MATCHES: Record<string, Match[]> = {
  u11: [
    { id: "m1", team_id: "t-u11", opponent: "Tigres", match_date: "2026-09-14", duration_seconds: 3480, video_status: "ready" },
    { id: "m2", team_id: "t-u11", opponent: "Cóndores", match_date: "2026-09-07", duration_seconds: 3660, video_status: "processing" },
  ],
  u14: [
    { id: "m3", team_id: "t-u14", opponent: "Halcones", match_date: "2026-09-13", duration_seconds: 5280, video_status: "ready" },
    { id: "m4", team_id: "t-u14", opponent: "Leones", match_date: "2026-09-06", duration_seconds: 5100, video_status: "ready" },
  ],
};

const SEED_HIGHLIGHTS: Record<string, Highlight[]> = {
  u11: [
    { id: "h1", match_id: "m1", player_name: "Mateo Contreras", label: "Gol", minute: 34, duration: "0:18" },
    { id: "h2", match_id: "m1", player_name: "Sofía Ramírez", label: "Atajada", minute: 51, duration: "0:24" },
  ],
  u14: [
    { id: "h3", match_id: "m3", player_name: "Iker Paredes", label: "Asistencia", minute: 62, duration: "0:15" },
    { id: "h4", match_id: "m3", player_name: "Lucía Torres", label: "Gol", minute: 9, duration: "0:20" },
  ],
};

const SEED_LIVE_STREAMS: LiveStream[] = [
  { id: "ls-u11", team_id: "t-u11", team_name: "Sub-11 Águilas", title: "Sub-11 vs Tigres", status: "live", viewer_count: 22 },
  { id: "ls-u14", team_id: "t-u14", team_name: "Sub-14 Águilas", title: "Sub-14 vs Halcones", status: "live", viewer_count: 38 },
];

const DEMO_USER: CurrentUser = { id: "demo", email: "demo@aguivision.app", full_name: "Diego Castillo" };

// ---------- Usuario y equipos por rol ----------

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isSupabaseConfigured) return DEMO_USER;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", data.user.id)
    .single();
  if (profileError) {
    // TEMPORAL: esto muestra el error real en pantalla en vez de ocultarlo,
    // para diagnosticar por qué no se encuentra el nombre. Sacar después.
    return {
      id: data.user.id,
      email: data.user.email ?? "",
      full_name: `[DEBUG: ${profileError.message} | code:${profileError.code}]`,
    };
  }
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    full_name: profile?.full_name ?? data.user.email ?? "Usuario",
  };
}

// Equipos donde el usuario actual tiene membresía real (team_members).
// En modo demo (sin Supabase) devuelve los dos equipos piloto como si
// fueras entrenador, para poder navegar la app sin configurar nada todavía.
export async function getMyTeams(): Promise<Team[]> {
  if (!isSupabaseConfigured) return SEED_TEAMS.filter((t) => t.role);

  const supabase = await createClient();
  if (!supabase) return [];
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from("team_members")
    .select("role, teams(id, slug, name, age_category, active)")
    .eq("profile_id", userData.user.id);

  if (error || !data) return [];

  return data
    .map((row: any) => (row.teams ? { ...row.teams, role: row.role } : null))
    .filter(Boolean) as Team[];
}

export async function getTeamBySlug(slug: string): Promise<Team | null> {
  const teams = await getMyTeams();
  return teams.find((t) => t.slug === slug) ?? null;
}

export async function getMatches(teamSlug: string): Promise<Match[]> {
  if (isSupabaseConfigured) {
    const team = await getTeamBySlug(teamSlug);
    const supabase = await createClient();
    if (team && supabase) {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("team_id", team.id)
        .order("match_date", { ascending: false });
      if (!error && data) return data as Match[];
    }
    return [];
  }
  return SEED_MATCHES[teamSlug] ?? [];
}

export async function getHighlights(teamSlug: string): Promise<Highlight[]> {
  if (isSupabaseConfigured) {
    const team = await getTeamBySlug(teamSlug);
    const supabase = await createClient();
    if (!team || !supabase) return [];

    const { data, error } = await supabase
      .from("highlights")
      .select("id, match_id, label, start_seconds, end_seconds, clip_playback_id, players(full_name), matches!inner(team_id)")
      .eq("matches.team_id", team.id)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => {
      const durationSeconds = Math.max(0, row.end_seconds - row.start_seconds);
      const mm = Math.floor(durationSeconds / 60);
      const ss = String(Math.round(durationSeconds % 60)).padStart(2, "0");
      return {
        id: row.id,
        match_id: row.match_id,
        player_name: row.players?.full_name ?? "Jugador",
        label: row.label,
        minute: Math.floor(row.start_seconds / 60),
        duration: `${mm}:${ss}`,
        clip_playback_id: row.clip_playback_id,
      };
    });
  }
  return SEED_HIGHLIGHTS[teamSlug] ?? [];
}

export async function getLiveStreams(): Promise<LiveStream[]> {
  if (isSupabaseConfigured) {
    const myTeams = await getMyTeams();
    const teamIds = myTeams.map((t) => t.id);
    if (teamIds.length === 0) return [];
    const supabase = await createClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("live_streams")
      .select("*, teams(name)")
      .eq("status", "live")
      .in("team_id", teamIds);
    if (!error && data) {
      return data.map((row: any) => ({
        id: row.id,
        team_id: row.team_id,
        team_name: row.teams?.name ?? "Equipo",
        title: row.title,
        status: row.status,
        viewer_count: row.viewer_count,
      }));
    }
    return [];
  }
  return SEED_LIVE_STREAMS;
}

export async function getLiveStreamById(id: string): Promise<LiveStream | null> {
  const streams = await getLiveStreams();
  return streams.find((s) => s.id === id) ?? null;
}

// ---------- Miembros del equipo e invitaciones ----------

export type TeamMember = {
  id: string;
  profile_id: string;
  role: Role;
  full_name: string;
  email: string;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: Role;
};

export async function getTeamMembers(teamSlug: string): Promise<TeamMember[]> {
  if (!isSupabaseConfigured) return [];
  const team = await getTeamBySlug(teamSlug);
  const supabase = await createClient();
  if (!team || !supabase) return [];

  const { data, error } = await supabase
    .from("team_members")
    .select("id, profile_id, role, profiles(full_name, email)")
    .eq("team_id", team.id);

  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    profile_id: row.profile_id,
    role: row.role,
    full_name: row.profiles?.full_name ?? "—",
    email: row.profiles?.email ?? "—",
  }));
}

export async function getPendingInvitations(teamSlug: string): Promise<PendingInvitation[]> {
  if (!isSupabaseConfigured) return [];
  const team = await getTeamBySlug(teamSlug);
  const supabase = await createClient();
  if (!team || !supabase) return [];

  const { data, error } = await supabase
    .from("team_invitations")
    .select("id, email, role")
    .eq("team_id", team.id);

  if (error || !data) return [];
  return data as PendingInvitation[];
}
