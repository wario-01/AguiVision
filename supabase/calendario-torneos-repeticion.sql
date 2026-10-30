-- Calendario: torneos con varios juegos + eventos que se repiten.
-- Correr UNA vez en Supabase (SQL Editor). Se puede correr de nuevo sin problema.

-- Un juego puede pertenecer a un torneo (evento "padre"). Si se borra el torneo, se borran sus juegos.
alter table public.events add column if not exists parent_event_id uuid references public.events(id) on delete cascade;
-- Los eventos creados juntos con "Se repite" comparten este número, para poder borrar toda la serie.
alter table public.events add column if not exists series_id uuid;

create index if not exists events_parent_idx on public.events (parent_event_id) where parent_event_id is not null;
create index if not exists events_series_idx on public.events (series_id) where series_id is not null;
