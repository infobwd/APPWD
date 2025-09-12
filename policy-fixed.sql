
drop policy if exists "read posts"                 on public.posts;
drop policy if exists "insert posts by editors"    on public.posts;
drop policy if exists "update posts by editors"    on public.posts;
drop policy if exists "delete posts by editors"    on public.posts;
drop policy if exists "read links"                 on public.app_links;
drop policy if exists "insert links by editors"    on public.app_links;
drop policy if exists "update links by editors"    on public.app_links;
drop policy if exists "delete links by editors"    on public.app_links;
drop policy if exists "read checkins"              on public.checkins;
drop policy if exists "insert checkin (pilot)"     on public.checkins;

create policy "read posts" on public.posts for select using (true);
create policy "insert posts by editors" on public.posts
  for insert with check (auth.role() = 'authenticated' and exists (select 1 from public.editors e where e.user_id = auth.uid()));
create policy "update posts by editors" on public.posts
  for update using (exists (select 1 from public.editors e where e.user_id = auth.uid()));
create policy "delete posts by editors" on public.posts
  for delete using (exists (select 1 from public.editors e where e.user_id = auth.uid()));

create policy "read links" on public.app_links for select using (true);
create policy "insert links by editors" on public.app_links
  for insert with check (auth.role() = 'authenticated' and exists (select 1 from public.editors e where e.user_id = auth.uid()));
create policy "update links by editors" on public.app_links
  for update using (exists (select 1 from public.editors e where e.user_id = auth.uid()));
create policy "delete links by editors" on public.app_links
  for delete using (exists (select 1 from public.editors e where e.user_id = auth.uid()));

create policy "read checkins" on public.checkins for select using (true);
create policy "insert checkin (pilot)" on public.checkins for insert with check (true);
