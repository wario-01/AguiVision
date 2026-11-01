-- Cambios planeados dentro de la alineación (quién sale, quién entra y minuto opcional).
alter table lineups add column if not exists subs jsonb not null default '[]'::jsonb;
