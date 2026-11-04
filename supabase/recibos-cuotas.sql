-- Cuota acordada por jugador y temporada (descuentos / ingreso tarde). Se puede correr varias veces.
-- Cada cambio agrega una fila (historial); la vigente es la más reciente.
create table if not exists public.player_fees (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  season text not null,
  monthly_cents int not null check (monthly_cents >= 0),
  months numeric not null check (months >= 0 and months <= 12),
  total_cents int not null check (total_cents >= 0),
  joined_on date,
  note text not null,
  set_by_name text not null,
  set_by_email text not null,
  created_at timestamptz not null default now()
);
create index if not exists player_fees_idx on public.player_fees (player_id, season, created_at desc);
alter table public.player_fees enable row level security;
