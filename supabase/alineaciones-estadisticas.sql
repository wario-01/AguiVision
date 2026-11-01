-- Alineaciones (campograma) y estadísticas de partido — noviembre 2026.
-- Se corre ANTES de subir el código nuevo. Se puede correr varias veces.
-- Solo entrenador/asistente ve estas tablas; se escriben desde el servidor.

create table if not exists lineups (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  event_id uuid references events(id) on delete cascade, -- null = alineación sin partido (borrador)
  formation text not null default '4-3-3',
  slots jsonb not null default '[]'::jsonb,  -- id de jugador por posición del campo (null = vacía)
  out_ids jsonb not null default '[]'::jsonb, -- no convocados
  notes text,
  updated_at timestamptz not null default now()
);
create unique index if not exists lineups_team_event_uq
  on lineups (team_id, coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists game_results (
  event_id uuid primary key references events(id) on delete cascade,
  goals_for int,
  goals_against int,
  shots int,
  corners int,
  fouls int,
  subs int,
  updated_at timestamptz not null default now()
);

create table if not exists game_stats (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  minutes int,
  goals int,
  assists int,
  yellow int,
  red int,
  saves int,
  updated_at timestamptz not null default now(),
  unique (event_id, player_id)
);
create index if not exists idx_game_stats_player on game_stats(player_id);

alter table lineups enable row level security;
alter table game_results enable row level security;
alter table game_stats enable row level security;

drop policy if exists "entrenadores ven alineaciones" on lineups;
create policy "entrenadores ven alineaciones" on lineups for select
  using (public.is_team_coach(team_id));

drop policy if exists "entrenadores ven resultados" on game_results;
create policy "entrenadores ven resultados" on game_results for select
  using (event_id in (select id from events where public.is_team_coach(team_id)));

drop policy if exists "entrenadores ven estadisticas de juego" on game_stats;
create policy "entrenadores ven estadisticas de juego" on game_stats for select
  using (event_id in (select id from events where public.is_team_coach(team_id)));
