import { createClient, isSupabaseConfigured } from "./supabase/server";
import { createAdminClient, isAdminConfigured } from "./supabase/admin";

export type Role = "coach" | "assistant" | "player" | "parent";

export type Team = {
  id: string;
  slug: string;
  name: string;
  age_category: string;
  active: boolean;
  sponsor_logo_url?: string | null;
  role?: Role; // presente cuando viene de getMyTeams()
  player_id?: string | null; // el jugador vinculado, si el rol es player/parent
};

export type CurrentUser = {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
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
  match_opponent: string;
  match_date: string;
  player_name: string;
  label: string;
  minute: number;
  duration: string;
  clip_playback_id?: string | null;
  // Solo en la vista de papás/jugadores (que juntan highlights de varios equipos):
  team_id?: string;
  team_name?: string;
};

export type LiveStream = {
  id: string;
  team_id: string;
  team_name: string;
  title: string;
  status: "scheduled" | "live" | "ended";
  viewer_count: number;
  playback_id?: string | null;
  sponsor_logo_url?: string | null;
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
    { id: "h1", match_id: "m1", match_opponent: "Tigres", match_date: "2026-09-14", player_name: "Mateo Contreras", label: "Gol", minute: 34, duration: "0:18" },
    { id: "h2", match_id: "m1", match_opponent: "Tigres", match_date: "2026-09-14", player_name: "Sofía Ramírez", label: "Atajada", minute: 51, duration: "0:24" },
  ],
  u14: [
    { id: "h3", match_id: "m3", match_opponent: "Halcones", match_date: "2026-09-13", player_name: "Iker Paredes", label: "Asistencia", minute: 62, duration: "0:15" },
    { id: "h4", match_id: "m3", match_opponent: "Halcones", match_date: "2026-09-13", player_name: "Lucía Torres", label: "Gol", minute: 9, duration: "0:20" },
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
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", data.user.id)
    .single();
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    full_name: profile?.full_name ?? data.user.email ?? "Usuario",
    avatar_url: profile?.avatar_url ?? null,
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
    .select("role, player_id, teams(id, slug, name, age_category, active, sponsor_logo_url)")
    .eq("profile_id", userData.user.id);

  if (error || !data) return [];

  return data
    .map((row: any) => (row.teams ? { ...row.teams, role: row.role, player_id: row.player_id } : null))
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

    let query = supabase
      .from("highlights")
      .select("id, match_id, label, start_seconds, end_seconds, clip_playback_id, players(full_name), matches!inner(team_id, opponent, match_date)")
      .eq("matches.team_id", team.id)
      .order("created_at", { ascending: false });

    // Un jugador o madre/padre vinculado a un jugador específico solo ve
    // los highlights de ESE jugador — y, si el niño juega en más de un
    // equipo, los de todos sus equipos juntos. Entrenadores y asistentes
    // ven todos los de su equipo.
    if (team.role === "player" || team.role === "parent") {
      return getLinkedPlayerHighlights(supabase);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map((row: any) => {
      const durationSeconds = Math.max(0, row.end_seconds - row.start_seconds);
      const mm = Math.floor(durationSeconds / 60);
      const ss = String(Math.round(durationSeconds % 60)).padStart(2, "0");
      return {
        id: row.id,
        match_id: row.match_id,
        match_opponent: row.matches?.opponent ?? "?",
        match_date: row.matches?.match_date ?? "",
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

// Highlights de los jugadores a los que esta persona está vinculada, en TODOS
// los equipos donde juega ese niño (los registros que comparten person_id).
// Usa el cliente de servicio porque el papá no es miembro del otro equipo;
// la autorización sale de SUS propias filas de team_members.
async function getLinkedPlayerHighlights(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>
): Promise<Highlight[]> {
  if (!isAdminConfigured) return [];
  const admin = createAdminClient();
  if (!admin) return [];

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data: mine } = await supabase
    .from("team_members")
    .select("player_id")
    .eq("profile_id", userData.user.id)
    .not("player_id", "is", null);
  const myPlayerIds = (mine ?? []).map((r: any) => r.player_id as string);
  if (myPlayerIds.length === 0) return [];

  const { data: people } = await admin.from("players").select("person_id").in("id", myPlayerIds);
  const personIds = Array.from(new Set((people ?? []).map((p: any) => p.person_id as string)));
  if (personIds.length === 0) return [];

  const { data: sameKid } = await admin.from("players").select("id").in("person_id", personIds);
  const playerIds = (sameKid ?? []).map((p: any) => p.id as string);
  if (playerIds.length === 0) return [];

  const { data, error } = await admin
    .from("highlights")
    .select(
      "id, match_id, label, start_seconds, end_seconds, clip_playback_id, players(full_name), matches!inner(team_id, opponent, match_date, teams(name))"
    )
    .in("player_id", playerIds)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => {
    const durationSeconds = Math.max(0, row.end_seconds - row.start_seconds);
    const mm = Math.floor(durationSeconds / 60);
    const ss = String(Math.round(durationSeconds % 60)).padStart(2, "0");
    return {
      id: row.id,
      match_id: row.match_id,
      match_opponent: row.matches?.opponent ?? "?",
      match_date: row.matches?.match_date ?? "",
      player_name: row.players?.full_name ?? "Jugador",
      label: row.label,
      minute: Math.floor(row.start_seconds / 60),
      duration: `${mm}:${ss}`,
      clip_playback_id: row.clip_playback_id,
      team_id: row.matches?.team_id,
      team_name: row.matches?.teams?.name ?? undefined,
    };
  });
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
        playback_id: row.playback_id,
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
  player_name?: string | null;
  avatar_url?: string | null;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: Role;
  player_id?: string | null;
  player_name?: string | null;
};

export async function getTeamMembers(teamSlug: string): Promise<TeamMember[]> {
  if (!isSupabaseConfigured) return [];
  const team = await getTeamBySlug(teamSlug);
  const supabase = await createClient();
  if (!team || !supabase) return [];

  const { data, error } = await supabase
    .from("team_members")
    .select("id, profile_id, role, profiles(full_name, email, avatar_url), players(full_name)")
    .eq("team_id", team.id);

  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    profile_id: row.profile_id,
    role: row.role,
    full_name: row.profiles?.full_name ?? "—",
    email: row.profiles?.email ?? "—",
    player_name: row.players?.full_name ?? null,
    avatar_url: row.profiles?.avatar_url ?? null,
  }));
}

export async function getPendingInvitations(teamSlug: string): Promise<PendingInvitation[]> {
  if (!isSupabaseConfigured) return [];
  const team = await getTeamBySlug(teamSlug);
  const supabase = await createClient();
  if (!team || !supabase) return [];

  const { data, error } = await supabase
    .from("team_invitations")
    .select("id, email, role, player_id, players(full_name)")
    .eq("team_id", team.id);

  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    player_id: row.player_id,
    player_name: row.players?.full_name ?? null,
  }));
}

export type Player = { id: string; full_name: string; photo_url?: string | null };

export async function getPlayers(teamSlug: string): Promise<Player[]> {
  if (!isSupabaseConfigured) return [];
  const team = await getTeamBySlug(teamSlug);
  const supabase = await createClient();
  if (!team || !supabase) return [];

  const { data, error } = await supabase
    .from("players")
    .select("id, full_name, photo_url")
    .eq("team_id", team.id)
    .order("full_name");

  if (error || !data) return [];
  return data as Player[];
}

// Transmisiones del equipo que todavía no terminaron (scheduled o live) —
// para que el entrenador siempre pueda encontrarlas y cortarlas, aunque se
// haya perdido la pantalla donde se crearon (recarga de página, error, etc.)
export type ActiveLiveStream = { id: string; title: string; status: "scheduled" | "live" };

export async function getActiveLiveStreamsForTeam(teamSlug: string): Promise<ActiveLiveStream[]> {
  if (!isSupabaseConfigured) return [];
  const team = await getTeamBySlug(teamSlug);
  const supabase = await createClient();
  if (!team || !supabase) return [];

  const { data, error } = await supabase
    .from("live_streams")
    .select("id, title, status")
    .eq("team_id", team.id)
    .in("status", ["scheduled", "live"])
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as ActiveLiveStream[];
}

// ---------- Vista pública de transmisiones (sin login) ----------
// Un visitante que llega por un link compartido (Facebook, etc.) no tiene
// cuenta — estas funciones usan el cliente admin (sin RLS) para mostrarle
// SOLO lo necesario para mirar (equipo, título, video), nunca datos
// privados como el roster o los highlights.

export async function getPublicLiveStreamById(id: string): Promise<LiveStream | null> {
  if (!isAdminConfigured) return null;
  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("live_streams")
    .select("id, team_id, title, status, viewer_count, playback_id, teams(name, sponsor_logo_url)")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    team_id: data.team_id,
    team_name: (data as any).teams?.name ?? "Equipo",
    title: data.title,
    status: data.status,
    viewer_count: data.viewer_count,
    playback_id: data.playback_id,
    sponsor_logo_url: (data as any).teams?.sponsor_logo_url ?? null,
  };
}

export async function getPublicLiveStreams(): Promise<LiveStream[]> {
  if (!isAdminConfigured) return [];
  const admin = createAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("live_streams")
    .select("id, team_id, title, status, viewer_count, playback_id, teams(name, sponsor_logo_url)")
    .eq("status", "live");

  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    team_id: row.team_id,
    team_name: row.teams?.name ?? "Equipo",
    title: row.title,
    status: row.status,
    viewer_count: row.viewer_count,
    playback_id: row.playback_id,
    sponsor_logo_url: row.teams?.sponsor_logo_url ?? null,
  }));
}

// Registra una visita anónima — no identifica a la persona, solo cuenta
// cuántas veces se abrió esta transmisión y cuándo.
export async function logPublicStreamView(liveStreamId: string): Promise<void> {
  if (!isAdminConfigured) return;
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from("live_stream_views").insert({ live_stream_id: liveStreamId });
}

// ---------- Calendario ----------

export type EventType = "game" | "practice" | "tournament" | "other";

export type CalendarEvent = {
  id: string;
  team_id: string;
  type: EventType;
  title: string | null;
  opponent: string | null;
  opponent_logo_url: string | null;
  league: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  notes: string | null;
};

// Todos los eventos del equipo dentro de un rango de fechas (para la
// pantalla de Calendario, mes por mes).
export async function getEvents(
  teamSlug: string,
  range?: { from: string; to: string }
): Promise<CalendarEvent[]> {
  if (!isSupabaseConfigured) return [];
  const team = await getTeamBySlug(teamSlug);
  const supabase = await createClient();
  if (!team || !supabase) return [];

  let query = supabase.from("events").select("*").eq("team_id", team.id);
  if (range) query = query.gte("start_at", range.from).lt("start_at", range.to);
  const { data, error } = await query.order("start_at", { ascending: true });

  if (error || !data) return [];
  return data as CalendarEvent[];
}

// Los próximos partidos (type='game', a futuro) — para la vista previa en Inicio.
export async function getUpcomingEvents(teamSlug: string, limit = 5): Promise<CalendarEvent[]> {
  if (!isSupabaseConfigured) return [];
  const team = await getTeamBySlug(teamSlug);
  const supabase = await createClient();
  if (!team || !supabase) return [];

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("team_id", team.id)
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return data as CalendarEvent[];
}
