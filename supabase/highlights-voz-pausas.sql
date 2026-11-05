-- La voz se graba junto con las pausas de los dibujos (tiempo de presentación). Se puede correr varias veces.
alter table public.highlights add column if not exists voice_pauses boolean not null default false;
