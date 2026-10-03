-- ============================================================
-- Activar evaluación físico-técnica para U14 y precargar métricas
-- Corre cada bloque por separado, igual que antes.
-- ============================================================

-- BLOQUE 1: activar el toggle en el equipo U14
update teams set physical_eval_enabled = true where slug = 'u14';

-- BLOQUE 2: Sprint 20m
insert into physical_metrics (team_id, nombre, unidad, mejor_direccion, orden)
select id, 'Sprint 20m', 'segundos', 'menor', 1 from teams where slug = 'u14';

-- BLOQUE 3: Agilidad 5-10-5
insert into physical_metrics (team_id, nombre, unidad, mejor_direccion, orden)
select id, 'Agilidad 5-10-5', 'segundos', 'menor', 2 from teams where slug = 'u14';

-- BLOQUE 4: Toques de balón en 30s
insert into physical_metrics (team_id, nombre, unidad, mejor_direccion, orden)
select id, 'Toques de balón (30s)', 'repeticiones', 'mayor', 3 from teams where slug = 'u14';

-- BLOQUE 5: Slalom de conos con balón
insert into physical_metrics (team_id, nombre, unidad, mejor_direccion, orden)
select id, 'Slalom de conos con balón', 'segundos', 'menor', 4 from teams where slug = 'u14';

-- BLOQUE 6: Precisión de pase
insert into physical_metrics (team_id, nombre, unidad, mejor_direccion, orden)
select id, 'Precisión de pase', 'puntos de 10', 'mayor', 5 from teams where slug = 'u14';

-- BLOQUE 7 (verificación, opcional): confirma que quedaron bien
select t.name, t.physical_eval_enabled, pm.nombre, pm.unidad, pm.orden
from teams t
join physical_metrics pm on pm.team_id = t.id
where t.slug = 'u14'
order by pm.orden;
