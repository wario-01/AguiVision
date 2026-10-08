-- Tabla de posiciones (Standings) de cada equipo (octubre 2026).
-- Cada equipo guarda el enlace de su liga. Entrenadores y asistentes lo pueden
-- cambiar desde la página Equipo. Se puede correr varias veces: solo llena los
-- equipos que todavía no tienen enlace (no pisa los que ya cambiaron a mano).

alter table teams add column if not exists standings_url text;

update teams set standings_url = 'https://system.gotsport.com/org_event/events/55585/schedules?team=4386608'
  where slug = 'u9' and standings_url is null;
update teams set standings_url = 'https://system.gotsport.com/org_event/events/55586/schedules?team=4426951'
  where slug = 'u11' and standings_url is null;
update teams set standings_url = 'https://system.gotsport.com/org_event/events/55479/schedules?team=4280743'
  where slug = 'u12' and standings_url is null;
update teams set standings_url = 'https://system.gotsport.com/splash/12333/events/55479/schedules?team=4288891'
  where slug = 'u14' and standings_url is null;

-- Verificación
select slug, standings_url from teams order by slug;
