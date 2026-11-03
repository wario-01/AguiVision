-- Música de fondo para highlights: biblioteca por equipo (archivos en Cloudflare R2).
create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  r2_key text not null,
  size_bytes int,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.music_tracks enable row level security;
drop policy if exists "music_tracks_select" on public.music_tracks;
create policy "music_tracks_select" on public.music_tracks
  for select using (public.is_team_member(team_id));

-- music_id: id de una canción subida por el equipo, o "lib:..." para una canción incluida en la app.
alter table public.highlights add column if not exists music_id text;
alter table public.highlights add column if not exists music_volume real not null default 0.25;
