-- PASO 2 de 2 — Corre esto DESPUÉS del paso 1.
-- Galería de fotos: las fotos viven en Cloudflare R2; aquí solo se guarda
-- el registro (quién la subió, de qué equipo/álbum, si se conserva).

-- Quién puede subir y ver fotos del equipo: entrenador, asistente, colaborador.
create or replace function public.is_team_photo_staff(check_team_id uuid)
returns boolean as $$
  select exists (
    select 1 from team_members
    where team_id = check_team_id and profile_id = auth.uid()
      and role::text in ('coach', 'assistant', 'collaborator')
  );
$$ language sql security definer stable set search_path = public;

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  album text not null,
  album_date date not null default current_date,
  r2_key text not null,
  thumb_key text not null,
  file_name text not null,
  size_bytes bigint,
  uploaded_by uuid references profiles(id) on delete set null default auth.uid(),
  keep boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists photos_team_album_idx on public.photos (team_id, album_date desc, album);
create index if not exists photos_cleanup_idx on public.photos (created_at) where keep = false;

alter table public.photos enable row level security;

drop policy if exists "ver fotos del equipo" on public.photos;
create policy "ver fotos del equipo" on public.photos for select
  using (public.is_team_photo_staff(team_id));

drop policy if exists "subir fotos al equipo" on public.photos;
create policy "subir fotos al equipo" on public.photos for insert
  with check (public.is_team_photo_staff(team_id) and uploaded_by = auth.uid());

-- Marcar "Guardar" (conservar): solo entrenador/asistente.
drop policy if exists "cuerpo tecnico actualiza fotos" on public.photos;
create policy "cuerpo tecnico actualiza fotos" on public.photos for update
  using (public.is_team_coach(team_id));

-- Borrar: entrenador/asistente, o quien la subió.
drop policy if exists "borrar fotos" on public.photos;
create policy "borrar fotos" on public.photos for delete
  using (public.is_team_coach(team_id) or (uploaded_by = auth.uid() and public.is_team_photo_staff(team_id)));
