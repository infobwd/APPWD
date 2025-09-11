
-- v4.3 schema for Push (Option A) + Check-in + Notifications
create table if not exists public.checkins (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  method text not null check (method in ('qr','gps')),
  payload jsonb, lat double precision, lon double precision, note text,
  created_at timestamptz default now()
);
alter table public.checkins enable row level security;
create policy "checkins self select" on public.checkins for select using (auth.uid() = user_id);
create policy "checkins self insert" on public.checkins for insert with check (auth.uid() = user_id);
create policy "checkins admin select all" on public.checkins for select using (exists(select 1 from public.editors e where e.user_id = auth.uid()));

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  title text not null, body text, url text, audience jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "notif_read_all" on public.notifications for select using (true);
create policy "notif_insert_editor" on public.notifications for insert with check (exists(select 1 from public.editors e where e.user_id = auth.uid()));

create table if not exists public.notification_reads (
  notif_id bigint references public.notifications(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  read_at timestamptz default now(),
  primary key (notif_id, user_id)
);
alter table public.notification_reads enable row level security;
create policy "notif_reads_self_select" on public.notification_reads for select using (auth.uid() = user_id);
create policy "notif_reads_self_insert" on public.notification_reads for insert with check (auth.uid() = user_id);

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text not null unique, p256dh text not null, auth text not null,
  user_agent text, created_at timestamptz default now()
);
alter table public.push_subscriptions enable row level security;
create policy "push_self_select" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "push_self_insert" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push_self_delete" on public.push_subscriptions for delete using (auth.uid() = user_id);
