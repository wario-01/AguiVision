-- Endurecimiento de permisos, segunda ronda (octubre 2026).
-- Se corre en DOS partes, en este orden:
--   PARTE A: ahora, ANTES de subir el código nuevo.
--   PARTE B: DESPUÉS de que Vercel termine de desplegar el código nuevo.
-- Ambas se pueden correr varias veces sin problema.

-- =====================================================================
-- PARTE A
-- =====================================================================

-- 1) Peso, altura y perfil de los jugadores pasan a una tabla aparte que
--    solo leen y escriben entrenador/asistente (antes, cualquier miembro del
--    equipo —incluidos papás— podía leerlos de la tabla players).
create table if not exists player_private (
  player_id uuid primary key references players(id) on delete cascade,
  peso numeric,
  altura numeric,
  perfil text check (perfil is null or perfil in ('derecho', 'izquierdo', 'ambidiestro')),
  updated_at timestamptz not null default now()
);

alter table player_private enable row level security;

drop policy if exists "staff gestiona datos privados" on player_private;
create policy "staff gestiona datos privados" on player_private for all
  using (player_id in (select id from players where public.is_team_coach(team_id)))
  with check (player_id in (select id from players where public.is_team_coach(team_id)));

-- Copia los datos que ya existan (solo si las columnas viejas todavía están).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'players' and column_name = 'peso'
  ) then
    insert into player_private (player_id, peso, altura, perfil)
      select id, peso, altura, perfil from players
      where peso is not null or altura is not null or perfil is not null
      on conflict (player_id) do nothing;
  end if;
end $$;

-- 2) Highlights: entrenador/asistente ven todos los de su equipo; jugadores y
--    papás solo los del jugador al que están vinculados (igual que ya hacía
--    la app, pero ahora también lo exige la base de datos).
drop policy if exists "ver highlights de mis equipos" on highlights;
drop policy if exists "ver highlights permitidos" on highlights;
create policy "ver highlights permitidos" on highlights for select
  using (
    match_id in (select m.id from matches m where public.is_team_coach(m.team_id))
    or player_id in (
      select tm.player_id from team_members tm
      where tm.profile_id = auth.uid() and tm.player_id is not null
    )
  );

-- 3) Perfiles (nombre, correo, foto): cada quien ve el suyo; entrenador y
--    asistente ven los de los miembros de sus equipos. Papás y jugadores ya
--    no ven los correos de los demás.
drop policy if exists "ver perfiles de mis equipos" on profiles;
create policy "ver perfiles de mis equipos" on profiles for select
  using (
    exists (
      select 1
      from team_members tm_target
      join team_members tm_viewer on tm_viewer.team_id = tm_target.team_id
      where tm_target.profile_id = profiles.id
        and tm_viewer.profile_id = auth.uid()
        and tm_viewer.role in ('coach', 'assistant')
    )
  );

-- =====================================================================
-- PARTE B (después del deploy)
-- =====================================================================

-- Copia de nuevo, por si se capturó algo entre la parte A y el deploy.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'players' and column_name = 'peso'
  ) then
    insert into player_private (player_id, peso, altura, perfil)
      select id, peso, altura, perfil from players
      where peso is not null or altura is not null or perfil is not null
      on conflict (player_id) do nothing;
  end if;
end $$;

-- Quita las columnas viejas de la tabla que leen todos los miembros.
alter table players drop column if exists peso;
alter table players drop column if exists altura;
alter table players drop column if exists perfil;

-- Borra las llaves de transmisión guardadas (la app ya no las guarda).
update live_streams set stream_key = null where stream_key is not null;
