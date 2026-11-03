-- Jornada de cada partido (para ordenar el historial como se jugaron).
alter table public.matches add column if not exists jornada int;
