-- Add per-column size for roadmap canvas

alter table public.task_columns
  add column if not exists width double precision not null default 240,
  add column if not exists height double precision not null default 260;

update public.task_columns
set
  width = coalesce(nullif(width, 0), 240),
  height = coalesce(nullif(height, 0), 260)
where width <= 0 or height <= 0;
