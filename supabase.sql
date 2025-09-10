-- Add cover_url support and storage tips
create table if not exists public.post_editors (
  user_id uuid primary key
);
alter table public.post_editors enable row level security;
create policy if not exists "read own membership" on public.post_editors for select using (auth.uid() = user_id);

create table if not exists public.posts (
  id bigserial primary key,
  title text not null,
  body text,
  category text,
  cover_url text,
  published_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz
);
alter table public.posts enable row level security;
create policy if not exists "read posts" on public.posts for select using (true);
create policy if not exists "insert by editors" on public.posts for insert with check (exists (select 1 from public.post_editors e where e.user_id = auth.uid()));
create policy if not exists "update by editors or owners" on public.posts for update using (auth.uid() = created_by or exists (select 1 from public.post_editors e where e.user_id = auth.uid()));
create policy if not exists "delete by editors or owners" on public.posts for delete using (auth.uid() = created_by or exists (select 1 from public.post_editors e where e.user_id = auth.uid()));

create table if not exists public.app_links (
  id bigserial primary key,
  title text not null,
  url text not null,
  icon text,
  category text
);
alter table public.app_links enable row level security;
create policy if not exists "read applinks" on public.app_links for select using (true);

create table if not exists public.leave_requests (
  id bigserial primary key,
  user_id uuid not null,
  type text not null,
  start_date date,
  end_date date,
  reason text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now()
);
alter table public.leave_requests enable row level security;
create policy if not exists "insert own leave" on public.leave_requests for insert with check (auth.uid() = user_id);
create policy if not exists "select own leave" on public.leave_requests for select using (auth.uid() = user_id);

create table if not exists public.checkins (
  id bigserial primary key,
  user_id uuid not null,
  type text not null check (type in ('in','out')),
  ts timestamptz default now(),
  lat double precision,
  lng double precision,
  photo_path text
);
alter table public.checkins enable row level security;
create policy if not exists "insert own checkin" on public.checkins for insert with check (auth.uid() = user_id);
create policy if not exists "select own checkin" on public.checkins for select using (auth.uid() = user_id);

-- Recommended storage buckets (create via Dashboard):
--   news-covers (Public)
--   news-images (Public)
--   checkin-photos (Public or Signed URL)
