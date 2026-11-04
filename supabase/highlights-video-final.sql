-- Video final del highlight (dibujos + voz + música pegados al clip).
alter table public.highlights add column if not exists video_edited boolean not null default false;
alter table public.highlights add column if not exists final_status text; -- 'processing' | 'error' | null
