
alter table public.checkins add column if not exists purpose text;
alter table public.checkins add column if not exists status text;
alter table public.checkins add column if not exists note text;
alter table public.checkins add column if not exists accuracy double precision;
alter table public.checkins add column if not exists distance_m integer;
alter table public.checkins add column if not exists within_radius boolean default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='checkins_purpose_check') then
    alter table public.checkins add constraint checkins_purpose_check check (purpose in ('work','meeting','training','official'));
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='checkins_status_check') then
    alter table public.checkins add constraint checkins_status_check check (status in ('on_time','late','offsite'));
  end if;
exception when others then null; end $$;

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
