-- Permiso de fotos para madres/padres sin cambiar su rol.
alter table public.team_members add column if not exists photo_access boolean not null default false;

create or replace function public.is_team_photo_staff(check_team_id uuid)
returns boolean as $$
  select exists (
    select 1 from team_members
    where team_id = check_team_id and profile_id = auth.uid()
      and (role::text in ('coach', 'assistant', 'collaborator') or photo_access = true)
  );
$$ language sql security definer stable set search_path = public;
