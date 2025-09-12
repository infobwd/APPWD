
-- Users table
create table if not exists public.users (
  line_user_id text primary key,
  display_name text,
  picture_url text,
  role text check (role in ('admin','teacher','student','parent')) default 'teacher',
  classroom text,
  phone text,
  email text,
  supabase_user_id uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.users enable row level security;
drop policy if exists "read users" on public.users;
drop policy if exists "upsert users (public)" on public.users;
create policy "read users" on public.users for select using (true);
create policy "upsert users (public)" on public.users for insert with check (true);
create policy "update users (public)" on public.users for update using (true);

create or replace function public.upsert_user(
  p_line_user_id text,
  p_display_name text,
  p_picture_url text,
  p_email text default null
) returns void language plpgsql as $$
begin
  insert into public.users(line_user_id, display_name, picture_url, email)
  values (p_line_user_id, p_display_name, p_picture_url, p_email)
  on conflict (line_user_id) do update set
    display_name = excluded.display_name,
    picture_url  = excluded.picture_url,
    email        = coalesce(excluded.email, public.users.email),
    updated_at   = now();
end;
$$;

alter table public.checkins add column if not exists user_line_id text;
do $$ begin
  alter table public.checkins add constraint checkins_user_fk foreign key (user_line_id) references public.users(line_user_id) on delete set null;
exception when others then null;
end $$;

alter table public.posts add column if not exists is_featured boolean default false;

create table if not exists public.post_stats (
  post_id bigint primary key references public.posts(id) on delete cascade,
  view_count bigint not null default 0,
  like_count bigint not null default 0,
  updated_at timestamptz default now()
);
alter table public.post_stats enable row level security;
drop policy if exists "read stats" on public.post_stats;
drop policy if exists "upsert stats" on public.post_stats;
drop policy if exists "update stats" on public.post_stats;
create policy "read stats"   on public.post_stats for select using (true);
create policy "upsert stats" on public.post_stats for insert with check (true);
create policy "update stats" on public.post_stats for update using (true);

create table if not exists public.post_likes (
  post_id bigint references public.posts(id) on delete cascade,
  line_user_id text not null,
  created_at timestamptz default now(),
  primary key (post_id, line_user_id)
);
alter table public.post_likes enable row level security;
drop policy if exists "read likes" on public.post_likes;
drop policy if exists "insert likes (public)" on public.post_likes;
drop policy if exists "delete likes (public)" on public.post_likes;
create policy "read likes" on public.post_likes for select using (true);
create policy "insert likes (public)" on public.post_likes for insert with check (true);
create policy "delete likes (public)" on public.post_likes for delete using (true);

create or replace function public.increment_view(p_post_id bigint)
returns bigint language sql as $$
  insert into public.post_stats(post_id, view_count, like_count)
  values (p_post_id, 1, 0)
  on conflict (post_id) do update
    set view_count = public.post_stats.view_count + 1,
        updated_at = now()
  returning view_count; $$;

create or replace function public.like_post(p_post_id bigint, p_line_user_id text)
returns bigint language plpgsql as $$
begin
  insert into public.post_likes(post_id, line_user_id)
  values (p_post_id, p_line_user_id) on conflict do nothing;
  insert into public.post_stats(post_id, view_count, like_count)
    values (p_post_id, 0, 0)
    on conflict (post_id) do nothing;
  update public.post_stats
    set like_count = (select count(*) from public.post_likes where post_id = p_post_id),
        updated_at = now()
    where post_id = p_post_id;
  return (select like_count from public.post_stats where post_id=p_post_id);
end; $$;

create or replace function public.unlike_post(p_post_id bigint, p_line_user_id text)
returns bigint language plpgsql as $$
begin
  delete from public.post_likes where post_id = p_post_id and line_user_id = p_line_user_id;
  insert into public.post_stats(post_id, view_count, like_count)
    values (p_post_id, 0, 0)
    on conflict (post_id) do nothing;
  update public.post_stats
    set like_count = (select count(*) from public.post_likes where post_id = p_post_id),
        updated_at = now()
    where post_id = p_post_id;
  return (select like_count from public.post_stats where post_id=p_post_id);
end; $$;

create index if not exists idx_posts_published_at on public.posts (published_at desc);
create index if not exists idx_post_stats_updated on public.post_stats (updated_at desc);
create index if not exists idx_checkins_created on public.checkins (created_at desc);
create index if not exists idx_post_likes_post on public.post_likes (post_id);
