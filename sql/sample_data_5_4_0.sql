
insert into public.posts(title, category, body, cover_url, is_featured, published_at)
values
('เปิดภาคเรียนที่ 2/2568', 'ประกาศ', '# ข่าวเปิดภาคเรียน\nรายละเอียด...', 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?q=80&w=1200&auto=format&fit=crop', true, now() - interval '1 day'),
('กิจกรรมวันวิทยาศาสตร์', 'กิจกรรม', '# วันวิทยาศาสตร์\nรายละเอียด...', 'https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=1200&auto=format&fit=crop', true, now() - interval '2 days'),
('รับสมัครนักเรียนใหม่', 'รับสมัคร', '# สมัครเรียน\nรายละเอียด...', 'https://images.unsplash.com/photo-1513258496099-48168024aec0?q=80&w=1200&auto=format&fit=crop', true, now() - interval '3 days');

insert into public.post_stats(post_id, view_count, like_count)
select id, 0, 0 from public.posts on conflict do nothing;

insert into public.app_links(title, url, image_url, category, sort_order, is_active) values
('ลงเวลามาทำงาน', 'https://example.com/checkin', 'https://img.icons8.com/?size=100&id=ueVZ9uUOeC1Q&format=png', 'งานบุคคล', 10, true),
('ลงทะเบียนลา', 'https://example.com/leave', 'https://img.icons8.com/?size=100&id=59817&format=png', 'งานบุคคล', 20, true),
('ศูนย์เอกสาร', 'https://example.com/docs', 'https://img.icons8.com/?size=100&id=59826&format=png', 'เอกสาร', 40, true);

insert into public.checkins(line_user_id,line_display_name,method,purpose,status,within_radius,distance_m)
values
('Udemo1','ครูเอ','gps','work','on_time',true,30),
('Udemo2','ครูบี','gps','meeting','offsite',false,1200);
