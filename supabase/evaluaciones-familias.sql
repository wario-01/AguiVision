-- Evaluaciones visibles para las familias (solo lo que el entrenador publica).
-- Se puede correr varias veces sin problema.
--
-- Qué hace:
--  * eval_cycles.published: el entrenador publica un ciclo formativo completo.
--  * physical_results.published: el entrenador publica los resultados físico-técnicos
--    de un jugador.
--  * Madres/padres/jugadores pueden LEER únicamente lo publicado y únicamente de
--    su propio hijo (el vinculado en team_members). No pueden escribir nada.
--  * Entrenador y asistente siguen igual (políticas *_write_coaches).

-- 1) Columnas de publicación (todo lo existente queda SIN publicar).
ALTER TABLE eval_cycles ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;
ALTER TABLE physical_results ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;

-- 2) Funciones auxiliares (security definer para evitar recursión de RLS).
CREATE OR REPLACE FUNCTION public.is_my_player(check_player_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE profile_id = auth.uid() AND player_id = check_player_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.family_in_team(check_team_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE profile_id = auth.uid() AND team_id = check_team_id AND player_id IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.cycle_is_published(check_cycle_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM eval_cycles WHERE id = check_cycle_id AND published);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 3) Políticas de lectura para la familia (solo publicado, solo su hijo).
DROP POLICY IF EXISTS "eval_cycles_select_familia" ON eval_cycles;
CREATE POLICY "eval_cycles_select_familia" ON eval_cycles
  FOR SELECT USING (published AND public.family_in_team(team_id));

DROP POLICY IF EXISTS "curriculum_select_familia" ON eval_curriculum_items;
CREATE POLICY "curriculum_select_familia" ON eval_curriculum_items
  FOR SELECT USING (
    public.cycle_is_published(cycle_id)
    AND public.family_in_team((SELECT team_id FROM eval_cycles WHERE id = cycle_id))
  );

DROP POLICY IF EXISTS "formative_eval_select_familia" ON formative_evaluations;
CREATE POLICY "formative_eval_select_familia" ON formative_evaluations
  FOR SELECT USING (
    public.is_my_player(player_id)
    AND public.cycle_is_published(
      (SELECT cycle_id FROM eval_curriculum_items WHERE id = curriculum_item_id)
    )
  );

DROP POLICY IF EXISTS "physical_results_select_familia" ON physical_results;
CREATE POLICY "physical_results_select_familia" ON physical_results
  FOR SELECT USING (published AND public.is_my_player(player_id));

-- Los nombres y unidades de las pruebas (Sprint 20m, etc.) no son datos de ningún niño.
DROP POLICY IF EXISTS "physical_metrics_select_familia" ON physical_metrics;
CREATE POLICY "physical_metrics_select_familia" ON physical_metrics
  FOR SELECT USING (public.family_in_team(team_id));
