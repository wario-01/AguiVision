-- Compartir un highlight con todo el equipo (interruptor del entrenador)
alter table highlights add column if not exists shared_with_team boolean not null default false;

drop policy if exists "ver highlights permitidos" on highlights;
create policy "ver highlights permitidos" on highlights for select
  using (
    match_id in (select m.id from matches m where public.is_team_coach(m.team_id))
    or player_id in (
      select tm.player_id from team_members tm
      where tm.profile_id = auth.uid() and tm.player_id is not null
    )
    or (
      shared_with_team
      and match_id in (select m.id from matches m where public.is_team_member(m.team_id))
    )
  );
