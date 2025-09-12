-- (same content as earlier message) Please use v5.4.0 init script; duplicated below for convenience.
-- USERS
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
create policy if not exists "users read"            on public.users for select using (true);
create policy if not exists "users insert (public)" on public.users for insert with check (true);
create policy if not exists "users update (public)" on public.users for update using (true);

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

create table if not exists public.posts (
  id bigserial primary key,
  title text not null,
  category text,
  body text,
  cover_url text,
  is_featured boolean default false,
  published_at timestamptz default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_posts_published_at on public.posts (published_at desc);
alter table public.posts enable row level security;
create policy if not exists "posts read" on public.posts for select using (true);
create policy if not exists "posts insert (editor)" on public.posts for insert with check ( exists (select 1 from public.editors e where e.user_id = auth.uid()) );
create policy if not exists "posts update (owner/editor)" on public.posts for update using ( auth.uid() = created_by or exists (select 1 from public.editors e where e.user_id = auth.uid()) );
create policy if not exists "posts delete (owner/editor)" on public.posts for delete using ( auth.uid() = created_by or exists (select 1 from public.editors e where e.user_id = auth.uid()) );

create table if not exists public.post_stats (
  post_id bigint primary key references public.posts(id) on delete cascade,
  view_count bigint not null default 0,
  like_count bigint not null default 0,
  updated_at timestamptz default now()
);
alter table public.post_stats enable row level security;
create policy if not exists "post_stats read"   on public.post_stats for select using (true);
create policy if not exists "post_stats upsert" on public.post_stats for insert with check (true);
create policy if not exists "post_stats update" on public.post_stats for update using (true);

create table if not exists public.post_likes (
  post_id bigint references public.posts(id) on delete cascade,
  line_user_id text not null,
  created_at timestamptz default now(),
  primary key (post_id, line_user_id)
);
alter table public.post_likes enable row level security;
create policy if not exists "post_likes read"   on public.post_likes for select using (true);
create policy if not exists "post_likes insert" on public.post_likes for insert with check (true);
create policy if not exists "post_likes delete" on public.post_likes for delete using (true);

create or replace function public.increment_view(p_post_id bigint)
returns bigint language sql as $$
  insert into public.post_stats(post_id, view_count, like_count)
  values (p_post_id, 1, 0)
  on conflict (post_id) do update
    set view_count = public.post_stats.view_count + 1,
        updated_at = now()
  returning view_count;
$$;

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
end;
$$;

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
end;
$$;

create table if not exists public.app_links (
  id bigserial primary key,
  title text not null,
  url text not null,
  image_url text,
  category text,
  sort_order int default 100,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.app_links enable row level security;
create policy if not exists "app_links read" on public.app_links for select using (true);
create policy if not exists "app_links insert (editor)" on public.app_links for insert with check ( exists (select 1 from public.editors e where e.user_id = auth.uid()) );
create policy if not exists "app_links update (editor)" on public.app_links for update using ( exists (select 1 from public.editors e where e.user_id = auth.uid()) );
create policy if not exists "app_links delete (editor)" on public.app_links for delete using ( exists (select 1 from public.editors e where e.user_id = auth.uid()) );

create table if not exists public.checkins (
  id bigserial primary key,
  line_user_id text,
  line_display_name text,
  line_picture_url text,
  user_line_id text references public.users(line_user_id) on delete set null,
  method text,
  purpose text check (purpose in ('work','meeting','training','official')) default 'work',
  status text check (status in ('on_time','late','offsite')),
  note text,
  lat double precision,
  lng double precision,
  accuracy double precision,
  distance_m integer,
  within_radius boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_checkins_created on public.checkins (created_at desc);
alter table public.checkins enable row level security;
create policy if not exists "checkins read" on public.checkins for select using (true);
create policy if not exists "checkins insert (public)" on public.checkins for insert with check (true);
create policy if not exists "checkins delete (editor)" on public.checkins for delete using ( exists (select 1 from public.editors e where e.user_id = auth.uid()) );

create table if not exists public.editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.editors enable row level security;
create policy if not exists "editors read" on public.editors for select using (true);
create policy if not exists "editors insert (owner)" on public.editors for insert with check ( auth.role() = 'service_role' );

create or replace function public.grant_editor_by_email(p_email text) returns void language plpgsql as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = p_email limit 1;
  if v_id is not null then
    insert into public.editors(user_id) values (v_id) on conflict do nothing;
  end if;
end;
$$;

create or replace function public.summary_counts(p_since timestamptz)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'work',     coalesce(sum((purpose='work')::int),0),
    'meeting',  coalesce(sum((purpose='meeting')::int),0),
    'training', coalesce(sum((purpose='training')::int),0),
    'official', coalesce(sum((purpose='official')::int),0)
  )
  from public.checkins
  where created_at >= p_since;
$$;
