-- PASO 1 de 2 — Corre SOLO este bloque primero (y espera a que diga Success).
-- Agrega el rol "colaborador" (sube fotos y ve la galería; nada más).
alter type team_role add value if not exists 'collaborator';
