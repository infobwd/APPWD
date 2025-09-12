
# APPWD — School Hub (v5.4.1)

อัปเดตด้านเช็คอิน: ไม่เปิดกล้องอัตโนมัติ, สถานะเวลา (ตรงเวลา/สาย), เลือกเหตุผลเมื่อนอกเขต + รายละเอียดงาน, การ์ดสรุปสัปดาห์/เดือน/ปี, หน้าแรกมีสรุปจำนวน และสไลด์การ์ดเด่นบนจอเล็ก พร้อม SQL ครบ

## ตั้งค่า
1. เปิด `config.js` แล้วใส่ค่า `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PUBLIC_URL` ให้ตรงโปรเจ็กต์จริง
2. Deploy ไปที่ GitHub Pages โฟลเดอร์ `APPWD/`
3. เปิดด้วย `https://infobwd.github.io/APPWD/index.html?v=541` เพื่อบังคับอัปเดตแคช

## SQL
- `sql/init_full_5_4_0.sql` — ติดตั้ง schema / RLS / RPC
- `sql/migrate_5_4_0.sql` — อัปเกรดจากรุ่นก่อนหน้า
- `sql/sample_data_5_4_0.sql` — ข้อมูลตัวอย่าง
- `sql/helpers_grants_teachers.sql` — ตัวช่วยสิทธิ์/เพิ่มครู

## ตารางหลัก
- users, posts, post_stats, post_likes, app_links, checkins, editors

MIT
