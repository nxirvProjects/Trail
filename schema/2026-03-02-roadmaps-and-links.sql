-- Add roadmap support for task columns and directional links

create table if not exists public.roadmaps (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  position   integer not null default 0
);

create index if not exists idx_roadmaps_user_id on public.roadmaps(user_id);

create table if not exists public.roadmap_links (
  id              uuid primary key default uuid_generate_v4(),
  roadmap_id      uuid not null references public.roadmaps(id) on delete cascade,
  from_column_id  uuid not null references public.task_columns(id) on delete cascade,
  to_column_id    uuid not null references public.task_columns(id) on delete cascade,
  label           text default ''
);

create index if not exists idx_roadmap_links_roadmap_id on public.roadmap_links(roadmap_id);
create index if not exists idx_roadmap_links_from on public.roadmap_links(from_column_id);
create index if not exists idx_roadmap_links_to on public.roadmap_links(to_column_id);

alter table public.task_columns
  add column if not exists roadmap_id uuid references public.roadmaps(id) on delete cascade;

do $$
declare
  u record;
  rid uuid;
begin
  for u in
    select distinct user_id
    from public.task_columns
    where user_id is not null
  loop
    select id into rid
    from public.roadmaps
    where user_id = u.user_id
    order by position asc
    limit 1;

    if rid is null then
      insert into public.roadmaps (user_id, name, position)
      values (u.user_id, 'Main', 0)
      returning id into rid;
    end if;

    update public.task_columns
    set roadmap_id = rid
    where user_id = u.user_id
      and roadmap_id is null;
  end loop;
end $$;

alter table public.task_columns
  alter column roadmap_id set not null;

alter table public.roadmaps enable row level security;
alter table public.roadmap_links enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roadmaps'
      and policyname = 'Users can view own roadmaps'
  ) then
    create policy "Users can view own roadmaps"
      on public.roadmaps for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roadmaps'
      and policyname = 'Users can insert own roadmaps'
  ) then
    create policy "Users can insert own roadmaps"
      on public.roadmaps for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roadmaps'
      and policyname = 'Users can update own roadmaps'
  ) then
    create policy "Users can update own roadmaps"
      on public.roadmaps for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roadmaps'
      and policyname = 'Users can delete own roadmaps'
  ) then
    create policy "Users can delete own roadmaps"
      on public.roadmaps for delete using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roadmap_links'
      and policyname = 'Users can view own roadmap_links'
  ) then
    create policy "Users can view own roadmap_links"
      on public.roadmap_links
      for select using (
        exists (
          select 1
          from public.roadmaps r
          where r.id = roadmap_links.roadmap_id
            and r.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roadmap_links'
      and policyname = 'Users can insert own roadmap_links'
  ) then
    create policy "Users can insert own roadmap_links"
      on public.roadmap_links
      for insert with check (
        exists (
          select 1
          from public.roadmaps r
          where r.id = roadmap_links.roadmap_id
            and r.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roadmap_links'
      and policyname = 'Users can update own roadmap_links'
  ) then
    create policy "Users can update own roadmap_links"
      on public.roadmap_links
      for update using (
        exists (
          select 1
          from public.roadmaps r
          where r.id = roadmap_links.roadmap_id
            and r.user_id = auth.uid()
        )
      ) with check (
        exists (
          select 1
          from public.roadmaps r
          where r.id = roadmap_links.roadmap_id
            and r.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roadmap_links'
      and policyname = 'Users can delete own roadmap_links'
  ) then
    create policy "Users can delete own roadmap_links"
      on public.roadmap_links
      for delete using (
        exists (
          select 1
          from public.roadmaps r
          where r.id = roadmap_links.roadmap_id
            and r.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'roadmaps'
  ) then
    alter publication supabase_realtime add table public.roadmaps;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'roadmap_links'
  ) then
    alter publication supabase_realtime add table public.roadmap_links;
  end if;
end $$;
