
-- SAMPLE data for APPWD v5.1.1

insert into public.app_links (title,url,image_url,category,sort_order,is_active) values
('เว็บไซต์โรงเรียน','https://infobwd.github.io','','ทั่วไป',10,true),
('EMIS สพฐ.','https://emis.obec.go.th','','ระบบสพฐ.',20,true),
('SGS (ระบบทะเบียน)','https://sgs6.bopp-obec.info/web/index_obec.php','','ระบบสพฐ.',30,true),
('DLIT','https://www.dlit.ac.th/','','สื่อการสอน',40,true),
('OBEC LMS','https://lms.obec.go.th/','','สื่อการสอน',50,true),
('Google Workspace','https://workspace.google.com/','','เครื่องมือทำงาน',60,true),
('LINE Official','https://line.me/R/ti/p/%40','','การสื่อสาร',70,true),
('Facebook โรงเรียน','https://facebook.com/','','การสื่อสาร',80,true)
on conflict do nothing;

insert into public.posts (title,category,body,cover_url,published_at) values
('ประกาศเปิดภาคเรียนที่ 2/2568','ประกาศ','# ปฏิทินเปิดเรียน\n- วันที่เปิด: **1 พ.ย. 2568**\n- แต่งกายถูกระเบียบ','', now() - interval '5 day'),
('เชิญชวนร่วมกิจกรรมกีฬาสี','กิจกรรม','มาร่วมเชียร์และแสดงพลังสีประจำบ้าน **พร้อมกันที่สนามกีฬา**','', now() - interval '3 day'),
('แนวทางการสอน Coding ห้อง ม.4','วิชาการ','สัปดาห์นี้เน้น *Algorithm* และ *Flowchart*\n\n- แจกใบงานที่ 2\n- ส่งงานผ่าน Google Classroom','', now() - interval '2 day'),
('กำหนดการประชุมผู้ปกครอง','ประกาศ','**เสาร์นี้ 09:00 น.** ณ หอประชุมใหญ่\n\n> หมายเหตุ: มาลงทะเบียนก่อนเวลา 15 นาที','', now() - interval '1 day'),
('ชวนอ่าน : คณิตคิดเร็วฉบับใหม่','สื่อการสอน','ไฟล์ตัวอย่างและแบบฝึกอยู่ในระบบ LMS ของโรงเรียน','', now() - interval '10 hour')
on conflict do nothing;
