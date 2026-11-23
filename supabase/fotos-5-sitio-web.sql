-- Fotos en el sitio web (nidoaustintx.com)
-- El cuerpo técnico marca fotos con "Mostrar en el sitio": se publican en la
-- galería del sitio hasta web_until (30 días) y después se retiran solas.
-- Mientras estén publicadas, la limpieza automática de 60 días no las borra.
alter table public.photos add column if not exists web_until timestamptz;
create index if not exists photos_web_idx on public.photos (web_until) where web_until is not null;
