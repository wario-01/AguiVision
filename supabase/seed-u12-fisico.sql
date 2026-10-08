-- ============================================================
-- Activar evaluación físico-técnica para U12 y precargar métricas
-- Se puede correr completo de una vez y varias veces sin duplicar.
-- ============================================================

update teams set physical_eval_enabled = true where slug = 'u12';

insert into physical_metrics (team_id, nombre, unidad, mejor_direccion, orden)
select t.id, v.nombre, v.unidad, v.mejor, v.orden
from teams t
cross join (values
  ('Sprint 20m', 'segundos', 'menor', 1),
  ('Agilidad 5-10-5', 'segundos', 'menor', 2),
  ('Toques de balón (30s)', 'repeticiones', 'mayor', 3),
  ('Slalom de conos con balón', 'segundos', 'menor', 4),
  ('Precisión de pase', 'puntos de 10', 'mayor', 5)
) as v(nombre, unidad, mejor, orden)
where t.slug = 'u12'
  and not exists (
    select 1 from physical_metrics pm
    where pm.team_id = t.id and pm.nombre = v.nombre
  );

-- Verificación
select t.name, t.physical_eval_enabled, pm.nombre, pm.unidad, pm.orden
from teams t
join physical_metrics pm on pm.team_id = t.id
where t.slug = 'u12'
order by pm.orden;
