-- Endurecimiento de permisos (auditoría de seguridad, octubre 2026).
-- Se puede correr varias veces sin problema.

-- 1) live_stream_views: no tenía RLS, así que cualquiera con la llave pública
--    podía leer, insertar o borrar filas. Sin políticas = nadie desde el
--    navegador; el servidor sigue funcionando porque usa la llave de servicio.
ALTER TABLE live_stream_views ENABLE ROW LEVEL SECURITY;

-- 2) Evaluaciones (formativa y físico-técnica): antes las podía leer cualquier
--    miembro del equipo, incluidos papás y jugadores. Se quitan esas políticas
--    de lectura. Entrenador y asistente siguen leyendo y escribiendo gracias a
--    las políticas "*_write_coaches" (son FOR ALL, así que también cubren la
--    lectura).
DROP POLICY IF EXISTS "eval_cycles_select_members" ON eval_cycles;
DROP POLICY IF EXISTS "curriculum_select_members" ON eval_curriculum_items;
DROP POLICY IF EXISTS "formative_eval_select_members" ON formative_evaluations;
DROP POLICY IF EXISTS "physical_metrics_select_members" ON physical_metrics;
DROP POLICY IF EXISTS "physical_results_select_members" ON physical_results;
