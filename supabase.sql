
-- RESET (Danger: drops existing tables)
drop table if exists public.app_links cascade;
drop table if exists public.posts cascade;
drop table if exists public.editors cascade;

create table public.editors ( user_id uuid primary key );
alter table public.editors enable row level security;
create policy "read own editor row" on public.editors for select using (auth.uid() = user_id);

create table public.posts (
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
create policy "read posts" on public.posts for select using (true);
create policy "insert posts by editors" on public.posts for insert with check (exists (select 1 from public.editors e where e.user_id = auth.uid()));
create policy "update posts by editors or owners" on public.posts for update using (auth.uid() = created_by or exists (select 1 from public.editors e where e.user_id = auth.uid()));
create policy "delete posts by editors or owners" on public.posts for delete using (auth.uid() = created_by or exists (select 1 from public.editors e where e.user_id = auth.uid()));

create table public.app_links (
  id bigserial primary key,
  title text not null,
  url text not null,
  image_url text,
  category text,
  sort_order int default 100,
  is_active boolean default true,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz
);
alter table public.app_links enable row level security;
create policy "read links" on public.app_links for select using (true);
create policy "insert links by editors" on public.app_links for insert with check (exists (select 1 from public.editors e where e.user_id = auth.uid()));
create policy "update links by editors or owners" on public.app_links for update using (auth.uid() = created_by or exists (select 1 from public.editors e where e.user_id = auth.uid()));
create policy "delete links by editors or owners" on public.app_links for delete using (auth.uid() = created_by or exists (select 1 from public.editors e where e.user_id = auth.uid()));

-- Seeds
insert into public.posts (title, category, body, cover_url, published_at)
values
  ('ประกาศเปิดภาคเรียน 2/2568', 'ประกาศ',
   'เปิดเรียนวันจันทร์หน้า เวลา 08:00 น.\n\n- แต่งกายให้เรียบร้อย\n- มาให้ตรงเวลา', null, now() - interval '1 day'),
  ('อบรมครู Coding', 'วิชาการ', 'อบรม **JS/Python** สำหรับครูผู้สอน', null, now() - interval '2 days');

insert into public.app_links (title,url,image_url,category,sort_order) values
  ('ลงเวลา (Check-in)','https://infobwd.github.io/checkin/','https://cdn-icons-png.flaticon.com/512/992/992700.png','งานบุคคล',10),
  ('ระบบลาออนไลน์','https://infobwd.github.io/leave/','https://cdn-icons-png.flaticon.com/512/1828/1828673.png','งานบุคคล',20),
  ('Google Classroom','https://classroom.google.com/','https://ssl.gstatic.com/classroom/favicon.png','การเรียนการสอน',30),
  ('คู่มือครู','https://example.com/guide','https://cdn-icons-png.flaticon.com/512/942/942748.png','เอกสาร',40);
