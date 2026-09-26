-- AguiVision — esquema inicial (Supabase / Postgres)
-- Soporta múltiples equipos y múltiples transmisiones en vivo simultáneas.
-- Piloto: solo "u11" y "u14" se cargan como activos. "u9" y "u12" quedan
-- en la tabla, inactivos, para prender cuando estén listos.

create extension if not exists "pgcrypto";

-- ============ EQUIPOS ============
create table teams (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,          -- 'u9' | 'u11' | 'u12' | 'u14'
  name text not null,                 -- 'Sub-11 Águilas'
  age_category text not null,         -- 'U9' | 'U11' | 'U12' | 'U14'
  crest_url text,
  active boolean not null default false,  -- solo u11/u14 en true durante el piloto
  created_at timestamptz not null default now()
);

-- ============ PERFILES (extiende auth.users de Supabase) ============
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ============ JUGADORES (roster por equipo) ============
create table players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  full_name text not null,
  jersey_number int,
  position text,
  created_at timestamptz not null default now()
);

-- ============ MEMBRESÍA: quién pertenece a qué equipo y con qué rol ============
-- Un mismo perfil puede pertenecer a varios equipos (ej: un entrenador de
-- U11 y U14, o un padre con hijos en distintas categorías).
create type team_role as enum ('coach', 'assistant', 'player', 'parent');

create table team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role team_role not null,
  player_id uuid references players(id) on delete set null, -- si role='player' o el padre está ligado a un hijo específico
  created_at timestamptz not null default now(),
  unique (team_id, profile_id, role, player_id)
);

-- ============ PARTIDOS ============
create table matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  opponent text not null,
  match_date timestamptz not null,
  location text,
  video_status text not null default 'none', -- none | uploading | processing | ready
  video_asset_id text,      -- id del asset en Mux/Cloudflare Stream
  video_playback_id text,   -- id público de reproducción
  duration_seconds int,
  created_at timestamptz not null default now()
);

-- ============ HIGHLIGHTS (clips por jugador) ============
create table highlights (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  label text not null,          -- 'Gol' | 'Asistencia' | 'Atajada' | 'Regate' ...
  start_seconds int not null,
  end_seconds int not null,
  clip_playback_id text,
  created_at timestamptz not null default now()
);

-- ============ TRANSMISIONES EN VIVO ============
-- Varias filas con status='live' al mismo tiempo = transmisiones simultáneas.
-- La pantalla "En Vivo" lista todas las que están en status='live' y el
-- usuario elige cuál mirar.
create table live_streams (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  title text not null,               -- 'Águilas FC vs Halcones'
  status text not null default 'scheduled', -- scheduled | live | ended
  stream_key text,                   -- clave de ingesta (solo backend, nunca al cliente)
  playback_id text,                  -- id público de reproducción
  viewer_count int not null default 0,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============ EVALUACIÓN DEL JUGADOR (roadmap V2) ============
-- Tabla lista desde ahora para no migrar más adelante; la UI todavía no se construye.
create table player_evaluations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  technique_score int check (technique_score between 1 and 5),
  attitude_score int check (attitude_score between 1 and 5),
  progress_notes text,
  coach_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ============ SEED: equipos piloto ============
insert into teams (slug, name, age_category, active) values
  ('u9',  'Sub-9 Águilas',  'U9',  false),
  ('u11', 'Sub-11 Águilas', 'U11', true),
  ('u12', 'Sub-12 Águilas', 'U12', false),
  ('u14', 'Sub-14 Águilas', 'U14', true);

-- ============ SEGURIDAD (RLS) ============
-- Idea general: cada usuario solo ve datos de los equipos donde aparece
-- en team_members. Se activa y se afinan las políticas cuando conectemos
-- el login real; se deja preparado para no repensar el modelo después.
alter table teams enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table highlights enable row level security;
alter table live_streams enable row level security;
alter table player_evaluations enable row level security;
alter table team_members enable row level security;

-- Cada usuario ve los equipos, partidos, highlights y transmisiones de los
-- equipos donde aparece en team_members. Los entrenadores además pueden
-- crear/editar partidos y highlights de sus propios equipos.

create policy "ver mi propia membresía" on team_members for select
  using (profile_id = auth.uid());

create policy "ver equipos donde participo" on teams for select
  using (id in (select team_id from team_members where profile_id = auth.uid()));

create policy "ver jugadores de mis equipos" on players for select
  using (team_id in (select team_id from team_members where profile_id = auth.uid()));

create policy "ver partidos de mis equipos" on matches for select
  using (team_id in (select team_id from team_members where profile_id = auth.uid()));

create policy "entrenadores gestionan partidos de su equipo" on matches for all
  using (team_id in (select team_id from team_members where profile_id = auth.uid() and role in ('coach', 'assistant')));

create policy "ver highlights de mis equipos" on highlights for select
  using (match_id in (
    select m.id from matches m
    join team_members tm on tm.team_id = m.team_id
    where tm.profile_id = auth.uid()
  ));

create policy "ver transmisiones de mis equipos" on live_streams for select
  using (team_id in (select team_id from team_members where profile_id = auth.uid()));

create policy "entrenadores gestionan transmisiones de su equipo" on live_streams for all
  using (team_id in (select team_id from team_members where profile_id = auth.uid() and role in ('coach', 'assistant')));

create policy "ver evaluaciones de mis equipos" on player_evaluations for select
  using (player_id in (
    select pl.id from players pl
    join team_members tm on tm.team_id = pl.team_id
    where tm.profile_id = auth.uid()
  ));

-- ============ AGREGADO: crear highlights y jugadores (clips por jugada) ============
-- Necesario para que un entrenador pueda marcar highlights (goles, jugadas
-- ofensivas/defensivas, etc.) y que la app cree el jugador automáticamente
-- la primera vez que se lo nombra, sin una pantalla aparte de "cargar plantel".
create policy "entrenadores crean highlights de su equipo" on highlights for insert
  with check (match_id in (
    select m.id from matches m
    join team_members tm on tm.team_id = m.team_id
    where tm.profile_id = auth.uid() and tm.role in ('coach', 'assistant')
  ));

create policy "entrenadores gestionan jugadores de su equipo" on players for all
  using (team_id in (select team_id from team_members where profile_id = auth.uid() and role in ('coach', 'assistant')));

-- ============ INVITACIONES (reemplaza el "vincular a mano con SQL") ============
-- Un entrenador invita por email + rol, sin que esa persona necesite existir
-- todavía. Cuando esa persona entra por primera vez a la app, el trigger de
-- abajo la vincula sola al equipo — cero SQL manual de acá en más.
create table team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  email text not null,
  role team_role not null,
  created_at timestamptz not null default now(),
  unique (team_id, email, role)
);

alter table team_invitations enable row level security;

create policy "entrenadores ven invitaciones de su equipo" on team_invitations for select
  using (team_id in (select team_id from team_members where profile_id = auth.uid() and role in ('coach', 'assistant')));

create policy "entrenadores crean invitaciones de su equipo" on team_invitations for insert
  with check (team_id in (select team_id from team_members where profile_id = auth.uid() and role in ('coach', 'assistant')));

create policy "entrenadores borran invitaciones de su equipo" on team_invitations for delete
  using (team_id in (select team_id from team_members where profile_id = auth.uid() and role in ('coach', 'assistant')));

-- ============ AUTO-CREAR PERFIL Y VINCULAR INVITACIONES AL REGISTRARSE ============
-- Cuando alguien se registra (Supabase Auth crea la fila en auth.users):
--   1) se crea su perfil (guardando también el email, para poder listar
--      miembros del equipo sin tocar la tabla interna auth.users)
--   2) se buscan invitaciones pendientes con ese mismo email y se convierten
--      en membresías reales (team_members) automáticamente
alter table profiles add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email);

  insert into public.team_members (team_id, profile_id, role)
  select ti.team_id, new.id, ti.role
  from public.team_invitations ti
  where ti.email = new.email
  on conflict do nothing;

  delete from public.team_invitations where email = new.email;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ PARA VOS, EL PRIMER ENTRENADOR (una sola vez, ya no hace falta) ============
-- Si ya te vinculaste a mano con el bloque anterior, no hace falta que hagas
-- nada más — de acá en adelante, para cualquier persona nueva (otro
-- entrenador, un padre, etc.) se usa la pantalla "Equipo" dentro de la app,
-- no SQL.
