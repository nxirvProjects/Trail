-- ============================================================
-- JobLogger Supabase Schema
-- Run this in Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- JOBS TABLE
-- ============================================================
create table public.jobs (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company_name  text not null,
  role_title    text not null,
  status        text not null default 'wishlist'
                check (status in ('wishlist','applied','interviewing','negotiating','closed')),
  notes         text default '',
  url           text default '',
  date_applied  date,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_jobs_user_id on public.jobs(user_id);
create index idx_jobs_status on public.jobs(user_id, status, position);

-- Prevent duplicate jobs per user (same company + role + url + date)
create unique index idx_jobs_no_duplicates
  on public.jobs (user_id, lower(company_name), lower(role_title), coalesce(lower(url), ''), coalesce(date_applied, '1970-01-01'));

-- ============================================================
-- CONTACTS TABLE
-- ============================================================
create table public.contacts (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  job_id        uuid references public.jobs(id) on delete set null,
  name          text not null,
  email         text default '',
  phone         text default '',
  role          text default '',
  company       text default '',
  notes         text default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_contacts_user_id on public.contacts(user_id);
create index idx_contacts_job_id on public.contacts(job_id);

-- ============================================================
-- NOTES TABLE
-- ============================================================
create table public.notes (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  job_id        uuid not null references public.jobs(id) on delete cascade,
  content       text not null,
  created_at    timestamptz not null default now()
);

create index idx_notes_job_id on public.notes(job_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_jobs_updated_at
  before update on public.jobs
  for each row execute function public.handle_updated_at();

create trigger set_contacts_updated_at
  before update on public.contacts
  for each row execute function public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Jobs RLS
alter table public.jobs enable row level security;

create policy "Users can view own jobs" on public.jobs for select using (auth.uid() = user_id);
create policy "Users can insert own jobs" on public.jobs for insert with check (auth.uid() = user_id);
create policy "Users can update own jobs" on public.jobs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own jobs" on public.jobs for delete using (auth.uid() = user_id);

-- Contacts RLS
alter table public.contacts enable row level security;

create policy "Users can view own contacts" on public.contacts for select using (auth.uid() = user_id);
create policy "Users can insert own contacts" on public.contacts for insert with check (auth.uid() = user_id);
create policy "Users can update own contacts" on public.contacts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own contacts" on public.contacts for delete using (auth.uid() = user_id);

-- Notes RLS
alter table public.notes enable row level security;

create policy "Users can view own notes" on public.notes for select using (auth.uid() = user_id);
create policy "Users can insert own notes" on public.notes for insert with check (auth.uid() = user_id);
create policy "Users can delete own notes" on public.notes for delete using (auth.uid() = user_id);

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.contacts;
alter publication supabase_realtime add table public.notes;
