-- Voz del entrenador en un highlight (el audio se guarda en Cloudflare R2)
alter table public.highlights add column if not exists voice_key text;
alter table public.highlights add column if not exists voice_start real not null default 0;
alter table public.highlights add column if not exists voice_duration real;
