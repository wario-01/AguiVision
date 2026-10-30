-- Videos en la galería (promocionales, etc.) y poder marcar uno como highlight.
-- Correr UNA vez en Supabase (SQL Editor). Se puede correr de nuevo sin problema.

alter table public.photos add column if not exists kind text not null default 'photo';
alter table public.photos add column if not exists duration_seconds int;
alter table public.photos add column if not exists content_type text;
-- Si el video ya se marcó como highlight, aquí queda cuál.
alter table public.photos add column if not exists highlight_id uuid references public.highlights(id) on delete set null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'photos_kind_check') then
    alter table public.photos add constraint photos_kind_check check (kind in ('photo', 'video'));
  end if;
end $$;

-- Un highlight que salió de un video de la galería (no de un partido completo).
alter table public.highlights add column if not exists source_photo_id uuid;
