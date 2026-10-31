-- Eventos cancelados: quedan en el calendario como registro, sin asistencia.
alter table public.events add column if not exists cancelled boolean not null default false;
alter table public.events add column if not exists cancel_reason text;
