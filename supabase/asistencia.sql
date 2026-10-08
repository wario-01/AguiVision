-- Asistencia a entrenamientos y juegos (octubre 2026).
-- Cuelga de los eventos del Calendario. Un registro por jugador y por evento.
-- Se corre ANTES de subir el código nuevo. Se puede correr varias veces.

create table if not exists event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  status text not null check (status in ('presente', 'tarde', 'ausente', 'justificado')),
  recorded_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (event_id, player_id)
);

create index if not exists idx_attendance_player on event_attendance(player_id);
create index if not exists idx_attendance_event on event_attendance(event_id);

alter table event_attendance enable row level security;

-- Leen: entrenador/asistente del equipo del evento, y el papá/jugador vinculado a ESE jugador.
drop policy if exists "ver asistencia permitida" on event_attendance;
create policy "ver asistencia permitida" on event_attendance for select
  using (
    event_id in (select id from events where public.is_team_coach(team_id))
    or player_id in (
      select tm.player_id from team_members tm
      where tm.profile_id = auth.uid() and tm.player_id is not null
    )
  );

-- Escribir: solo desde el servidor (la app usa la llave de servicio), así que
-- no hay políticas de insert/update/delete para usuarios normales.
