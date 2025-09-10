-- Supabase schema (Phase 2) — รวมตารางหลัก + RLS

create extension if not exists "uuid-ossp";

-- Profiles
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text default 'staff' check (role in ('admin','approver','editor','staff')),
  department text,
  phone text,
  avatar_url text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Profiles are readable by all" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.email, 'ผู้ใช้ใหม่'))
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_role(r text) returns boolean language sql stable as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role = r);
$$;

-- Posts
create table if not exists public.posts (
  id bigserial primary key,
  title text not null,
  body text,
  category text,
  audience text default 'public' check (audience in ('public','staff')),
  pinned boolean default false,
  published_at timestamptz default now(),
  author_id uuid references public.profiles(user_id) on delete set null
);
alter table public.posts enable row level security;
create policy "Anon can read public posts" on public.posts for select using (audience='public' and published_at <= now());
create policy "Auth can read staff/public posts" on public.posts for select to authenticated using (audience in ('public','staff') and published_at <= now());
create policy "Editors can insert posts" on public.posts for insert with check (public.is_role('editor') or public.is_role('admin'));
create policy "Editors can update posts" on public.posts for update using (public.is_role('editor') or public.is_role('admin'));

-- Post attachments & reads
create table if not exists public.post_attachments (
  id bigserial primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  file_path text not null,
  mime text
);
alter table public.post_attachments enable row level security;
create policy "Anyone read post_attachments" on public.post_attachments for select using (true);
create policy "Editors manage post_attachments" on public.post_attachments for all using (public.is_role('editor') or public.is_role('admin')) with check (public.is_role('editor') or public.is_role('admin'));

create table if not exists public.post_reads (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  read_at timestamptz default now(),
  primary key (post_id, user_id)
);
alter table public.post_reads enable row level security;
create policy "Users upsert own post_reads" on public.post_reads for insert with check (auth.uid() = user_id);
create policy "Users read own post_reads" on public.post_reads for select using (auth.uid() = user_id);

-- Checkins
create table if not exists public.checkins (
  id bigserial primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  ts timestamptz default now(),
  type text not null check (type in ('in','out')),
  lat double precision,
  lng double precision,
  photo_path text
);
alter table public.checkins enable row level security;
create policy "Users can insert own checkins" on public.checkins for insert with check (auth.uid() = user_id);
create policy "Users can read own checkins" on public.checkins for select using (auth.uid() = user_id);

-- Leaves
create table if not exists public.leave_requests (
  id bigserial primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  type text not null check (type in ('vacation','business','sick')),
  start_date date, end_date date, reason text, attachment text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  approver_id uuid references public.profiles(user_id),
  approved_at timestamptz,
  created_at timestamptz default now()
);
alter table public.leave_requests enable row level security;
create policy "Users insert own leave" on public.leave_requests for insert with check (auth.uid() = user_id);
create policy "Users select own leave" on public.leave_requests for select using (auth.uid() = user_id);
create policy "Approvers read all" on public.leave_requests for select to authenticated using (public.is_role('approver') or public.is_role('admin'));
create policy "Approvers update status" on public.leave_requests for update using (public.is_role('approver') or public.is_role('admin')) with check (status in ('approved','rejected'));

create table if not exists public.leave_balances (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  type text not null check (type in ('vacation','business','sick')),
  balance integer,
  primary key (user_id, type)
);
alter table public.leave_balances enable row level security;
create policy "User read own balances" on public.leave_balances for select using (auth.uid() = user_id);
create policy "Admin manage balances" on public.leave_balances for all using (public.is_role('admin')) with check (public.is_role('admin'));

-- App links
create table if not exists public.app_links (
  id bigserial primary key,
  title text not null,
  url text not null,
  icon text,
  category text,
  visible_roles text[] default array['staff']::text[]
);
alter table public.app_links enable row level security;
create policy "Anyone can read app links" on public.app_links for select using (true);
create policy "Admins can manage app links" on public.app_links for all using (public.is_role('admin')) with check (public.is_role('admin'));

-- Events
create table if not exists public.events (
  id bigserial primary key,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  category text,
  visibility text default 'public' check (visibility in ('public','staff')),
  created_at timestamptz default now()
);
alter table public.events enable row level security;
create policy "Anyone reads public events" on public.events for select using (visibility='public');
create policy "Auth reads staff/public events" on public.events for select to authenticated using (visibility in ('public','staff'));
create policy "Editors manage events" on public.events for all using (public.is_role('editor') or public.is_role('admin')) with check (public.is_role('editor') or public.is_role('admin'));

-- Documents
create table if not exists public.documents (
  id bigserial primary key,
  title text not null,
  category text,
  tags text[],
  file_path text not null,
  visibility text default 'public' check (visibility in ('public','staff')),
  created_at timestamptz default now()
);
alter table public.documents enable row level security;
create policy "Anyone reads public docs" on public.documents for select using (visibility='public');
create policy "Auth reads staff/public docs" on public.documents for select to authenticated using (visibility in ('public','staff'));
create policy "Editors manage docs" on public.documents for all using (public.is_role('editor') or public.is_role('admin')) with check (public.is_role('editor') or public.is_role('admin'));

-- Resources
create table if not exists public.resources (
  id bigserial primary key,
  name text not null,
  category text,
  location text,
  availability text default 'available'
);
alter table public.resources enable row level security;
create policy "Anyone can read resources" on public.resources for select using (true);
create policy "Admins manage resources" on public.resources for all using (public.is_role('admin')) with check (public.is_role('admin'));

-- Bookings
create table if not exists public.bookings (
  id bigserial primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  resource_id bigint not null references public.resources(id) on delete cascade,
  start_at timestamptz not null, end_at timestamptz not null,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now()
);
alter table public.bookings enable row level security;
create policy "Users insert own booking" on public.bookings for insert with check (auth.uid() = user_id);
create policy "Users select own bookings" on public.bookings for select using (auth.uid() = user_id);
create policy "Approver/admin read all bookings" on public.bookings for select to authenticated using (public.is_role('approver') or public.is_role('admin'));
create policy "Approver/admin update status" on public.bookings for update using (public.is_role('approver') or public.is_role('admin')) with check (status in ('approved','rejected'));

-- Storage policy hints (run in Storage UI / SQL for storage.objects)
-- - attachments: public read or signed URLs
-- - checkin-photos: owner read/write (path prefix = uid)
-- - docs: public read; editor/admin write
