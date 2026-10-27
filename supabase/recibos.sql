-- Sistema de recibos (acceso a nivel CLUB, no por equipo). Se puede correr más de una vez.
-- Todo se maneja desde el servidor (clave de servicio); las tablas quedan con
-- RLS activado y SIN políticas, así que nadie puede leerlas desde el navegador.

-- Quién tiene acceso:
--   owner = superusuario (ve todo, anula recibos, administra accesos)
--   admin = ve los reportes
--   can_issue = además puede expedir recibos
create table if not exists public.finance_access (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  level text not null default 'admin',
  can_issue boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.finance_access add column if not exists can_issue boolean not null default false;
alter table public.finance_access drop constraint if exists finance_access_level_check;
update public.finance_access set level = 'admin', can_issue = true where level = 'issuer';
alter table public.finance_access add constraint finance_access_level_check check (level in ('owner', 'admin'));
alter table public.finance_access enable row level security;

insert into public.finance_access (email, full_name, level, can_issue) values
  ('wario01@gmail.com', 'Mario', 'owner', false),
  ('palomaef01@gmail.com', 'Paloma', 'owner', true),
  ('ame0629@gmail.com', 'América', 'admin', true),
  ('sara.ramos2028@gmail.com', 'Sara', 'admin', true)
on conflict (email) do update
  set full_name = excluded.full_name, level = excluded.level, can_issue = excluded.can_issue;

create sequence if not exists public.receipts_number_seq start 1;

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  number int default nextval('public.receipts_number_seq'),
  team_id uuid references teams(id) on delete set null,
  team_name text not null,
  player_id uuid references players(id) on delete set null,
  player_name text not null,
  reason text not null check (reason in ('anualidad', 'torneos', 'arbitraje', 'membresia', 'otro')),
  description text not null default '',
  season text not null,
  total_cents int not null check (total_cents >= 0),
  amount_cents int not null check (amount_cents > 0),
  balance_cents int not null,
  method text check (method in ('cash', 'zelle')),
  issued_by_name text not null,
  issued_by_email text not null,
  receipt_date date not null,
  voided boolean not null default false,
  void_reason text,
  voided_by text,
  legacy boolean not null default false,
  legacy_ref text,
  created_at timestamptz not null default now()
);
-- Si la tabla ya existía de una corrida anterior:
alter table public.receipts alter column number drop not null;
alter table public.receipts alter column method drop not null;
alter table public.receipts add column if not exists legacy boolean not null default false;
alter table public.receipts add column if not exists legacy_ref text;

create unique index if not exists receipts_number_idx on public.receipts (number);
create index if not exists receipts_report_idx on public.receipts (reason, season, team_name);
alter table public.receipts enable row level security;

-- Jugadores exentos de pago (por ejemplo, hijos de entrenadores), por motivo y temporada.
create table if not exists public.finance_exemptions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  reason text not null check (reason in ('anualidad', 'torneos', 'arbitraje', 'membresia', 'otro')),
  season text not null,
  note text,
  created_by text,
  created_at timestamptz not null default now(),
  unique (player_id, reason, season)
);
alter table public.finance_exemptions enable row level security;
