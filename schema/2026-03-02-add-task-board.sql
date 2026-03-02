-- Add missing Kanban tables for Task Board
-- Safe to run once; guarded where possible.

create table if not exists public.task_columns (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_columns_user_id on public.task_columns(user_id);

create table if not exists public.tasks (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  column_id  uuid not null references public.task_columns(id) on delete cascade,
  title      text not null,
  notes      text default '',
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_user_id on public.tasks(user_id);
create index if not exists idx_tasks_column_id on public.tasks(column_id);

alter table public.task_columns enable row level security;
alter table public.tasks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'task_columns'
      and policyname = 'Users can view own task_columns'
  ) then
    create policy "Users can view own task_columns"
      on public.task_columns for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'task_columns'
      and policyname = 'Users can insert own task_columns'
  ) then
    create policy "Users can insert own task_columns"
      on public.task_columns for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'task_columns'
      and policyname = 'Users can update own task_columns'
  ) then
    create policy "Users can update own task_columns"
      on public.task_columns for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'task_columns'
      and policyname = 'Users can delete own task_columns'
  ) then
    create policy "Users can delete own task_columns"
      on public.task_columns for delete using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tasks'
      and policyname = 'Users can view own tasks'
  ) then
    create policy "Users can view own tasks"
      on public.tasks for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tasks'
      and policyname = 'Users can insert own tasks'
  ) then
    create policy "Users can insert own tasks"
      on public.tasks for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tasks'
      and policyname = 'Users can update own tasks'
  ) then
    create policy "Users can update own tasks"
      on public.tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tasks'
      and policyname = 'Users can delete own tasks'
  ) then
    create policy "Users can delete own tasks"
      on public.tasks for delete using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_tasks_updated_at'
  ) then
    create trigger set_tasks_updated_at
      before update on public.tasks
      for each row execute function public.handle_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_columns'
  ) then
    alter publication supabase_realtime add table public.task_columns;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;
