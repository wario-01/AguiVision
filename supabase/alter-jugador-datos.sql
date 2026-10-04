-- Agrega número de camiseta (ya existía), posición (ya existía), y los
-- campos nuevos: peso (kg), altura (cm) y perfil (pie dominante).
-- jersey_number y position YA EXISTEN en la tabla players — no se tocan.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS peso numeric,
  ADD COLUMN IF NOT EXISTS altura numeric,
  ADD COLUMN IF NOT EXISTS perfil text;

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_perfil_check;
ALTER TABLE players ADD CONSTRAINT players_perfil_check
  CHECK (perfil IS NULL OR perfil IN ('derecho', 'izquierdo', 'ambidiestro'));
