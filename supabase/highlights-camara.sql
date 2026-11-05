-- Movimiento de la cámara medido por la app, para que los dibujos sigan la escena. Se puede correr varias veces.
alter table public.highlights add column if not exists cam_track jsonb;
