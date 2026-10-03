-- ============================================================
-- AguiVision — Evaluación del jugador
-- Fase 1: Esquema de base de datos
-- ============================================================
-- IMPORTANTE: Igual que siempre, corre estos bloques en el SQL
-- Editor de Supabase. Si uno falla, los anteriores ya quedaron
-- aplicados (no reviertas); corrige el que falló y vuelve a
-- correr solo ese bloque.
-- ============================================================


-- ------------------------------------------------------------
-- BLOQUE 1: Evaluación formativa — ciclos
-- ------------------------------------------------------------
-- Un "ciclo" es un periodo de evaluación para UNA categoría
-- (ej. "Trimestre 1 · 2026" para U7). El nivel de evaluación
-- (Emergente, En desarrollo, Consistente, Autónomo funcional,
-- Competente) es siempre el mismo — lo que cambia por ciclo es
-- el texto del currículo.

create table if not exists eval_cycles (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,                          -- "Trimestre 1 · 2026"
  period_type text not null default 'trimestral'
    check (period_type in ('mensual', 'trimestral', 'semestral', 'anual')),
  start_date date not null,
  end_date date not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_eval_cycles_team on eval_cycles(team_id);


-- ------------------------------------------------------------
-- BLOQUE 2: Currículo por periodo dentro del ciclo
-- ------------------------------------------------------------
-- Cada ciclo se divide en periodos (ej. "Marzo", "Abril", "Mayo"
-- para un trimestre). Cada periodo tiene texto de currículo por
-- área (Táctico, Técnico, Físico, Actitudinal — las áreas que ya
-- usan en su informe actual).

create table if not exists eval_curriculum_items (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references eval_cycles(id) on delete cascade,
  period_label text not null,                  -- "Marzo"
  period_order int not null default 0,          -- para ordenar Marzo, Abril, Mayo...
  area text not null
    check (area in ('tactico', 'tecnico', 'fisico', 'actitudinal')),
  descripcion text not null,                    -- el texto del currículo de esa área/mes
  created_at timestamptz not null default now()
);

create index if not exists idx_curriculum_cycle on eval_curriculum_items(cycle_id);


-- ------------------------------------------------------------
-- BLOQUE 3: Evaluación formativa — resultado por jugador
-- ------------------------------------------------------------
-- El nivel asignado a un jugador para un ítem de currículo
-- específico (un periodo + área dentro de un ciclo).

create table if not exists formative_evaluations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  curriculum_item_id uuid not null references eval_curriculum_items(id) on delete cascade,
  nivel text not null
    check (nivel in ('emergente', 'en_desarrollo', 'consistente', 'autonomo_funcional', 'competente')),
  notas text,
  evaluated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, curriculum_item_id)
);

create index if not exists idx_formative_eval_player on formative_evaluations(player_id);
create index if not exists idx_formative_eval_curriculum on formative_evaluations(curriculum_item_id);


-- ------------------------------------------------------------
-- BLOQUE 4: Toggle de evaluación físico-técnica por equipo
-- ------------------------------------------------------------
-- Permite activar la evaluación físico-técnica para cualquier
-- equipo (empezando con el equipo más grande), sin afectar a
-- los demás.

alter table teams add column if not exists physical_eval_enabled boolean not null default false;


-- ------------------------------------------------------------
-- BLOQUE 5: Métricas físico-técnicas configurables por equipo
-- ------------------------------------------------------------
-- Lista de métricas numéricas que aplica cada equipo (ej.
-- Sprint 20m, agilidad 5-10-5, toques de balón en 30s, slalom
-- con balón, precisión de pase). Configurable para que cada
-- equipo pueda tener sus propias métricas en el futuro.

create table if not exists physical_metrics (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  nombre text not null,                         -- "Sprint 20m"
  unidad text not null,                         -- "segundos", "repeticiones", "puntos de 10"
  mejor_direccion text not null default 'menor'
    check (mejor_direccion in ('menor', 'mayor')), -- "menor" = tiempo (menos es mejor), "mayor" = repeticiones/puntos
  orden int not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_physical_metrics_team on physical_metrics(team_id);


-- ------------------------------------------------------------
-- BLOQUE 6: Resultados físico-técnicos por jugador
-- ------------------------------------------------------------
-- Un resultado numérico de un jugador en una métrica, en una
-- fecha/ciclo específico (para poder graficar progreso en el
-- tiempo).

create table if not exists physical_results (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  metric_id uuid not null references physical_metrics(id) on delete cascade,
  cycle_id uuid references eval_cycles(id) on delete set null, -- opcional: asocia el resultado a un ciclo/trimestre
  valor numeric not null,
  fecha date not null default current_date,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_physical_results_player on physical_results(player_id);
create index if not exists idx_physical_results_metric on physical_results(metric_id);


-- ------------------------------------------------------------
-- BLOQUE 7: Row Level Security — habilitar en todas las tablas nuevas
-- ------------------------------------------------------------

alter table eval_cycles enable row level security;
alter table eval_curriculum_items enable row level security;
alter table formative_evaluations enable row level security;
alter table physical_metrics enable row level security;
alter table physical_results enable row level security;


-- ------------------------------------------------------------
-- BLOQUE 8: Políticas — lectura (cualquier miembro del equipo)
-- ------------------------------------------------------------

create policy "eval_cycles_select_members" on eval_cycles
  for select using (is_team_member(team_id));

create policy "curriculum_select_members" on eval_curriculum_items
  for select using (
    is_team_member((select team_id from eval_cycles where id = cycle_id))
  );

create policy "formative_eval_select_members" on formative_evaluations
  for select using (
    is_team_member((select team_id from players where id = player_id))
  );

create policy "physical_metrics_select_members" on physical_metrics
  for select using (is_team_member(team_id));

create policy "physical_results_select_members" on physical_results
  for select using (
    is_team_member((select team_id from players where id = player_id))
  );


-- ------------------------------------------------------------
-- BLOQUE 9: Políticas — escritura (solo coaches)
-- ------------------------------------------------------------

create policy "eval_cycles_write_coaches" on eval_cycles
  for all using (is_team_coach(team_id)) with check (is_team_coach(team_id));

create policy "curriculum_write_coaches" on eval_curriculum_items
  for all using (
    is_team_coach((select team_id from eval_cycles where id = cycle_id))
  ) with check (
    is_team_coach((select team_id from eval_cycles where id = cycle_id))
  );

create policy "formative_eval_write_coaches" on formative_evaluations
  for all using (
    is_team_coach((select team_id from players where id = player_id))
  ) with check (
    is_team_coach((select team_id from players where id = player_id))
  );

create policy "physical_metrics_write_coaches" on physical_metrics
  for all using (is_team_coach(team_id)) with check (is_team_coach(team_id));

create policy "physical_results_write_coaches" on physical_results
  for all using (
    is_team_coach((select team_id from players where id = player_id))
  ) with check (
    is_team_coach((select team_id from players where id = player_id))
  );
