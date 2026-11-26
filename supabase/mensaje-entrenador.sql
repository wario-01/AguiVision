-- Mensaje del entrenador para el jugador (aparece al final del informe en PDF).
-- Un mensaje por jugador y por ciclo de evaluación. Se puede correr varias veces.

create table if not exists public.player_cycle_messages (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  cycle_id uuid not null references public.eval_cycles(id) on delete cascade,
  mensaje text not null,
  author_name text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (player_id, cycle_id)
);

create index if not exists idx_player_cycle_messages_player on public.player_cycle_messages(player_id);

alter table public.player_cycle_messages enable row level security;

drop policy if exists "player_cycle_messages_coaches" on public.player_cycle_messages;
create policy "player_cycle_messages_coaches" on public.player_cycle_messages
  for all using (
    is_team_coach((select team_id from public.players where id = player_id))
  ) with check (
    is_team_coach((select team_id from public.players where id = player_id))
  );
