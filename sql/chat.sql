
-- APPWD chat schema (v5.5.5 base)
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room text not null default 'school-global',
  content text not null,
  user_id uuid null,
  line_user_id text null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.chat_messages enable row level security;

create policy if not exists "chat read all" on public.chat_messages
  for select using (true);

create policy if not exists "chat insert with identity" on public.chat_messages
  for insert with check (
    (auth.uid() is not null) or (line_user_id is not null)
  );
