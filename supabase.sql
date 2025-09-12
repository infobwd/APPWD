
-- === APPWD v5.0 schema (Production) ===

-- POSTS
create table if not exists public.posts (
  id bigserial primary key,
  title text not null,
  category text,
  body text,
  cover_url text,
  published_at timestamptz default now(),
  created_by uuid,
  updated_at timestamptz
);

-- APP LINKS
create table if not exists public.app_links (
  id bigserial primary key,
  title text not null,
  url text not null,
  image_url text,
  category text,
  sort_order int default 100,
  is_active boolean default true
);

-- EDITORS
create table if not exists public.editors (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- CHECKINS
create table if not exists public.checkins (
  id bigserial primary key,
  line_user_id text,
  line_display_name text,
  line_picture_url text,
  line_sub text,
  method text check (method in ('gps','qr+gps')) not null,
  text text,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  distance_m int,
  within_radius boolean default false,
  created_at timestamptz default now()
);

insert into public.posts (title,category,body,cover_url,published_at) values
('ยินดีต้อนรับสู่ APPWD','ประกาศ','**ทดลองระบบ** พร้อมใช้งาน!','', now())
on conflict do nothing;

insert into public.app_links (title,url,image_url,category,sort_order,is_active) values
('เว็บไซต์โรงเรียน','https://www.example.com','','ทั่วไป',10,true),
('ระบบสพฐ.','https://emis.obec.go.th','','ทั่วไป',20,true)
on conflict do nothing;

alter table public.posts enable row level security;
alter table public.app_links enable row level security;
alter table public.checkins enable row level security;
alter table public.editors enable row level security;

create policy if not exists "read posts" on public.posts for select using (true);
create policy if not exists "read links" on public.app_links for select using (true);
create policy if not exists "read checkins" on public.checkins for select using (true);

create policy if not exists "insert posts by editors" on public.posts
  for insert with check (auth.role() = 'authenticated' and exists(select 1 from public.editors e where e.user_id = auth.uid()));
create policy if not exists "update posts by editors" on public.posts
  for update using (exists(select 1 from public.editors e where e.user_id = auth.uid()));
create policy if not exists "delete posts by editors" on public.posts
  for delete using (exists(select 1 from public.editors e where e.user_id = auth.uid()));

create policy if not exists "insert links by editors" on public.app_links
  for insert with check (auth.role() = 'authenticated' and exists(select 1 from public.editors e where e.user_id = auth.uid()));
create policy if not exists "update links by editors" on public.app_links
  for update using (exists(select 1 from public.editors e where e.user_id = auth.uid()));
create policy if not exists "delete links by editors" on public.app_links
  for delete using (exists(select 1 from public.editors e where e.user_id = auth.uid()));

create policy if not exists "insert checkin (pilot)" on public.checkins for insert with check (true);

create or replace function public.set_created_by()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then new.created_by := auth.uid(); end if;
  return new;
end; $$;

drop trigger if exists t_set_created_by on public.posts;
create trigger t_set_created_by before insert on public.posts
for each row execute procedure public.set_created_by();
