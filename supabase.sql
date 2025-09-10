-- Phase 3 additions (minimal for demo)
create table if not exists public.tickets (
  id bigserial primary key,
  user_id uuid not null,
  category text not null,
  title text not null,
  detail text,
  attachment text,
  status text default 'open' check (status in ('open','in_progress','resolved','rejected')),
  created_at timestamptz default now()
);
alter table public.tickets enable row level security;
create policy if not exists "insert own" on public.tickets for insert with check (auth.uid() = user_id);
create policy if not exists "select own" on public.tickets for select using (auth.uid() = user_id);

create table if not exists public.polls (
  id bigserial primary key,
  title text not null,
  description text,
  audience text default 'staff',
  multi boolean default false,
  start_at timestamptz default now()
);
alter table public.polls enable row level security;
create policy if not exists "read polls" on public.polls for select using (true);

create table if not exists public.poll_options (
  id bigserial primary key,
  poll_id bigint not null references public.polls(id) on delete cascade,
  label text not null
);
alter table public.poll_options enable row level security;
create policy if not exists "read options" on public.poll_options for select using (true);

create table if not exists public.poll_votes (
  poll_id bigint not null references public.polls(id) on delete cascade,
  option_id bigint not null references public.poll_options(id) on delete cascade,
  user_id uuid not null,
  voted_at timestamptz default now(),
  primary key (poll_id, user_id)
);
alter table public.poll_votes enable row level security;
create policy if not exists "vote once" on public.poll_votes for insert with check (auth.uid() = user_id);
