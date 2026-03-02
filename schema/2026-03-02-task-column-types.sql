-- Add task column types for slash-out workflow

alter table public.task_columns
  add column if not exists column_type text not null default 'active';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_columns_column_type_check'
      and conrelid = 'public.task_columns'::regclass
  ) then
    alter table public.task_columns
      add constraint task_columns_column_type_check
      check (column_type in ('active', 'completed'));
  end if;
end $$;
