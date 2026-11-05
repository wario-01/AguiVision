-- Un mismo correo puede tener varias invitaciones en el mismo equipo (una por jugador). Se puede correr varias veces.
alter table public.team_invitations drop constraint if exists team_invitations_team_id_email_role_key;
create unique index if not exists team_invitations_uniq
  on public.team_invitations (team_id, email, role, coalesce(player_id, '00000000-0000-0000-0000-000000000000'::uuid));
