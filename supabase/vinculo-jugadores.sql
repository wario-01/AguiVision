-- Jugadores que juegan en más de un equipo (octubre 2026).
-- Cada equipo sigue teniendo su propio registro del jugador (con sus propias
-- evaluaciones), pero los registros que comparten person_id son "el mismo niño".
-- Cada jugador existente queda con su propio person_id (nadie queda vinculado).
-- Se puede correr varias veces sin problema.

alter table players add column if not exists person_id uuid not null default gen_random_uuid();

create index if not exists idx_players_person on players(person_id);
