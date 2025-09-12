
-- Sample posts
insert into public.posts(title, category, body, cover_url, is_featured, published_at)
values
('เปิดภาคเรียนที่ 2/2568', 'ประกาศ', '# ข่าวเปิดภาคเรียน\nรายละเอียด...', 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?q=80&w=1200&auto=format&fit=crop', true, now() - interval '1 day'),
('กิจกรรมวันวิทยาศาสตร์', 'กิจกรรม', '# วันวิทยาศาสตร์\nรายละเอียด...', 'https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=1200&auto=format&fit=crop', true, now() - interval '2 days'),
('รับสมัครนักเรียนใหม่', 'รับสมัคร', '# สมัครเรียน\nรายละเอียด...', 'https://images.unsplash.com/photo-1513258496099-48168024aec0?q=80&w=1200&auto=format&fit=crop', true, now() - interval '3 days'),
('แจ้งย้ายอาคารเรียน', 'ประกาศ', 'รายละเอียด...', null, false, now() - interval '4 days'),
('ประกาศรางวัล', 'รางวัล', 'รายละเอียด...', 'https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?q=80&w=1200&auto=format&fit=crop', false, now() - interval '5 days');

insert into public.post_stats(post_id, view_count, like_count)
select id, 0, 0 from public.posts on conflict do nothing;

-- Sample links
insert into public.app_links(title, url, image_url, category, sort_order, is_active) values
('ลงเวลามาทำงาน', 'https://example.com/checkin', 'https://img.icons8.com/?size=100&id=ueVZ9uUOeC1Q&format=png', 'งานบุคคล', 10, true),
('ลงทะเบียนลา', 'https://example.com/leave', 'https://img.icons8.com/?size=100&id=59817&format=png', 'งานบุคคล', 20, true),
('ตารางสอน', 'https://example.com/timetable', 'https://img.icons8.com/?size=100&id=59813&format=png', 'การสอน', 30, true),
('ศูนย์เอกสาร', 'https://example.com/docs', 'https://img.icons8.com/?size=100&id=59826&format=png', 'เอกสาร', 40, true),
('ระบบห้องสมุด', 'https://example.com/library', 'https://img.icons8.com/?size=100&id=12583&format=png', 'บริการ', 50, true),
('เว็บโรงเรียน', 'https://example.com', 'https://img.icons8.com/?size=100&id=106570&format=png', 'ทั่วไป', 60, true);
