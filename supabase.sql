-- Minimal schema for Method B demo
create table if not exists public.posts (id bigserial primary key, title text not null, body text, category text, published_at timestamptz default now());
alter table public.posts enable row level security;
create policy if not exists "read posts" on public.posts for select using (true);

create table if not exists public.app_links (id bigserial primary key, title text not null, url text not null, icon text, category text);
alter table public.app_links enable row level security;
create policy if not exists "read applinks" on public.app_links for select using (true);

create table if not exists public.leave_requests (id bigserial primary key, user_id uuid not null, type text not null, start_date date, end_date date, reason text, status text default 'pending', created_at timestamptz default now());
alter table public.leave_requests enable row level security;
create policy if not exists "insert own leave" on public.leave_requests for insert with check (auth.uid() = user_id);
create policy if not exists "select own leave" on public.leave_requests for select using (auth.uid() = user_id);

create table if not exists public.checkins (id bigserial primary key, user_id uuid not null, type text not null check (type in ('in','out')), ts timestamptz default now(), lat double precision, lng double precision, photo_path text);
alter table public.checkins enable row level security;
create policy if not exists "insert own checkin" on public.checkins for insert with check (auth.uid() = user_id);
create policy if not exists "select own checkin" on public.checkins for select using (auth.uid() = user_id);
