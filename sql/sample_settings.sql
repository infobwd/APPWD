
-- Base settings for APPWD
insert into public.settings(key,value) values
('CHECKIN_START','"07:30"'),
('CHECKIN_ON_TIME_UNTIL','"08:00"'),
('SUMMARY_DEFAULT_RANGE_DAYS','"30"'),
('SLIDER_AUTO_MS','"4500"'),
('BRAND_TITLE','"APPWD | บ้านวังด้ง"')
on conflict (key) do update set value = excluded.value;
