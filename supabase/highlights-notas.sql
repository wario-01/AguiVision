-- Notas del entrenador en cada highlight (texto libre).
alter table highlights add column if not exists notas text;

-- Verificación
select column_name, data_type from information_schema.columns
where table_name = 'highlights' and column_name in ('notas', 'shared_with_team', 'player_id');
