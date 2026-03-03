-- Add free-canvas coordinates for task columns

alter table public.task_columns
  add column if not exists x double precision not null default 0,
  add column if not exists y double precision not null default 0;

with ranked as (
  select
    id,
    row_number() over (partition by roadmap_id order by position, created_at) - 1 as idx
  from public.task_columns
)
update public.task_columns c
set
  x = (ranked.idx % 4) * 320,
  y = floor(ranked.idx / 4.0) * 260
from ranked
where c.id = ranked.id
  and c.x = 0
  and c.y = 0;
