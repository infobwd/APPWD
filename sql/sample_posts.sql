
insert into public.posts (title, category, body, cover_url, is_featured, published_at)
values
('ยินดีต้อนรับ APPWD', 'ประกาศ', 'ทดลองระบบ **APPWD** สำหรับโรงเรียนบ้านวังด้ง', null, true, now() - interval '1 day'),
('กิจกรรมวันวิทยาศาสตร์', 'กิจกรรม', 'รายละเอียดกิจกรรม...', null, false, now() - interval '2 day'),
('เปิดภาคเรียนที่ 2/2568', 'ประกาศ', 'ยินดีต้อนรับนักเรียนทุกคน', null, true, now() - interval '5 day');
