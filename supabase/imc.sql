-- IMC (índice de masa corporal) con historial (octubre 2026).
-- Peso en LIBRAS y altura en PULGADAS (totales: 4 pies 11 pulgadas = 59).
-- Se corre ANTES de subir el código nuevo. Se puede correr varias veces.

-- 1) Sexo (para comparar con los percentiles del CDC). Queda en player_private:
--    solo entrenador/asistente lo ven. NO se guarda fecha de nacimiento: la edad
--    se captura al medir y queda en cada medición.
alter table player_private add column if not exists sex text;
alter table player_private drop column if exists birth_date;
-- Cintura en pulgadas (opcional): sirve para distinguir IMC alto por músculo de IMC alto por grasa.
alter table player_private add column if not exists cintura numeric;
alter table player_private drop constraint if exists player_private_sex_check;
alter table player_private add constraint player_private_sex_check
  check (sex is null or sex in ('M', 'F'));

-- 2) Historial de mediciones. Cada vez que se cambia el peso o la altura de un
--    jugador queda una fila nueva con la fecha.
create table if not exists player_measurements (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  measured_on date not null,
  peso_lb numeric not null check (peso_lb > 0),
  altura_in numeric not null check (altura_in > 0),
  cintura_in numeric,        -- opcional
  bmi numeric not null,
  age_months numeric,        -- edad del niño al medir, en meses (la captura el entrenador)
  sex text check (sex is null or sex in ('M', 'F')),
  created_at timestamptz not null default now(),
  unique (player_id, measured_on)
);

alter table player_measurements add column if not exists cintura_in numeric;

create index if not exists idx_measurements_player on player_measurements(player_id, measured_on);

alter table player_measurements enable row level security;

-- Leen: entrenador/asistente del equipo, y el papá/jugador vinculado a ESE jugador.
drop policy if exists "ver mediciones permitidas" on player_measurements;
create policy "ver mediciones permitidas" on player_measurements for select
  using (
    player_id in (select id from players where public.is_team_coach(team_id))
    or player_id in (
      select tm.player_id from team_members tm
      where tm.profile_id = auth.uid() and tm.player_id is not null
    )
  );

-- Escribir: solo desde el servidor (la app usa la llave de servicio), así que
-- no hay políticas de insert/update/delete para usuarios normales.

-- Si ya tenían peso y altura capturados, se guardan como primera medición.
-- (Sin edad todavía: se completa al poner la edad en “Editar datos”.)
insert into player_measurements (player_id, measured_on, peso_lb, altura_in, bmi)
select player_id, current_date, peso, altura, round((703 * peso / (altura * altura))::numeric, 1)
from player_private
where peso is not null and altura is not null and peso > 0 and altura > 0
  and not exists (select 1 from player_measurements m where m.player_id = player_private.player_id)
on conflict (player_id, measured_on) do nothing;
