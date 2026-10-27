-- ============================================================
-- Evaluación U14 (competencias por cuatrimestre) + pruebas físicas U12/U14
-- Corre TODO junto en el SQL Editor de Supabase (se puede repetir sin problema).
-- ============================================================

-- 1) Permitir las áreas nuevas de U14 y la duración "cuatrimestral"
alter table eval_curriculum_items drop constraint if exists eval_curriculum_items_area_check;
alter table eval_curriculum_items add constraint eval_curriculum_items_area_check
  check (area in ('tactico','tecnico','fisico','actitudinal','tactico_cognitivo','condicional_motriz','transversales','portero'));

alter table eval_cycles drop constraint if exists eval_cycles_period_type_check;
alter table eval_cycles add constraint eval_cycles_period_type_check
  check (period_type in ('mensual','bimestral','trimestral','cuatrimestral','semestral','anual','personalizado'));

-- 2) Orden de las competencias dentro de un ciclo
alter table eval_curriculum_items add column if not exists item_order int not null default 0;

-- 2b) Escala de la ficha técnica: a qué grupo cuenta cada prueba y qué resultado vale 40 / 99
alter table physical_metrics add column if not exists grupo text;
alter table physical_metrics add column if not exists valor_bajo numeric;
alter table physical_metrics add column if not exists valor_alto numeric;

-- 3) Pruebas físicas U12 y U14: se borran las métricas anteriores (y sus resultados)
--    y se cargan las 6 pruebas nuevas.
update teams set physical_eval_enabled = true where slug in ('u12', 'u14');

delete from physical_metrics
where team_id in (select id from teams where slug in ('u12', 'u14'));

-- Todo en sistema inglés: yardas, pulgadas y pies (los tiempos, en segundos).
insert into physical_metrics (team_id, nombre, unidad, mejor_direccion, orden, grupo, valor_bajo, valor_alto)
select t.id, v.nombre, v.unidad, v.mejor, v.orden, v.grupo, v.bajo, v.alto
from teams t
cross join (values
  ('Flexibilidad (Test de Wells)',                             'pulgadas',          'mayor', 1, 'flx', 4,    16),
  ('Resistencia (Course Navette, distancia recorrida)',        'yardas recorridas', 'mayor', 2, 'res', 500,  1600),
  ('Potencia tren inferior (salto horizontal)',                'pulgadas',          'mayor', 3, 'pot', 55,   95),
  ('Potencia tren superior (balón medicinal sobre la cabeza)', 'pies',              'mayor', 4, 'pot', 15,   38),
  ('Velocidad (sprint 20 yardas)',                             'segundos',          'menor', 5, 'vel', 4.3,  3.0),
  ('Agilidad (cambios de dirección)',                          'segundos',          'menor', 6, 'vel', 3.3,  2.3)
) as v(nombre, unidad, mejor, orden, grupo, bajo, alto)
where t.slug in ('u12', 'u14');

-- Verificación
select t.slug, pm.orden, pm.nombre, pm.unidad, pm.mejor_direccion
from physical_metrics pm join teams t on t.id = pm.team_id
where t.slug in ('u12','u14') order by t.slug, pm.orden;
