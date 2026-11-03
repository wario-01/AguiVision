-- Dibujos (flechas, cuadros, círculos, texto) sobre los highlights.
alter table public.highlights add column if not exists annotations jsonb not null default '[]'::jsonb;
