# WD School Portal — Phase 2

ฟีเจอร์: ข่าว+แนบไฟล์, ลงเวลา, ลา+คงเหลือ, ปฏิทิน, เอกสาร, จองทรัพยากร, หน้ารวมอนุมัติ, App Hub + LIFF login (profile)

## ติดตั้งเร็ว
1) สร้างโปรเจกต์ Supabase → SQL Editor → รัน `supabase.sql`
2) Storage: สร้าง buckets `attachments`, `checkin-photos`, `docs` และตั้ง Policy ตามคอมเมนต์
3) เปิด `config.js` → ใส่ `SUPABASE_URL`, `SUPABASE_ANON_KEY` (และ LIFF ID มีให้แล้ว)
4) เปิด `index.html` ทดสอบ หรือ deploy GitHub Pages

## Seed ตัวอย่าง
```sql
insert into posts (title, body, category, audience, pinned, published_at) values
('ประกาศทดสอบ', 'ยินดีต้อนรับสู่พอร์ทัลโรงเรียน', 'ประชาสัมพันธ์', 'public', true, now());

insert into app_links (title, url, icon, category, visible_roles) values
('ระบบอาหารกลางวัน','https://example.com','🍱','ฝ่ายบริหารทั่วไป','{staff}');

insert into resources (name, category, location) values
('ห้องประชุม A','ห้อง','อาคาร 1'),
('รถตู้','ยานพาหนะ','อาคาร 2');

insert into events (title, start_at, end_at, location, category, visibility)
values ('ประชุม PLC', now() + interval '1 day', now() + interval '1 day 2 hours', 'ห้องประชุม A', 'วิชาการ', 'staff');
```
