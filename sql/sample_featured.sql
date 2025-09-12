
update public.posts set is_featured = true
where id in (select id from public.posts order by published_at desc limit 2);
insert into public.posts (title,category,body,cover_url,is_featured,published_at) values
('สรุปกิจกรรมวันวิทยาศาสตร์','กิจกรรม','ภาพบรรยากาศพร้อมผลการประกวด','', true, now() - interval '7 hour'),
('คู่มือเข้าระบบ EMIS ภาคเรียนล่าสุด','วิชาการ','ขั้นตอนแบบย่อ + วิดีโอสั้น','', false, now() - interval '18 hour')
on conflict do nothing;
