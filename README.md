# WD School Portal — MVP (Supabase + GitHub Pages)

เว็บแอปสำหรับสื่อสาร/ข่าว, ลงเวลา, ลา และศูนย์ลิงก์ระบบ โดยใช้ **Supabase** (Auth + DB + Storage) และโฮสต์แบบ static (GitHub Pages)

## โครงไฟล์
```
/index.html
/config.js            # ใส่ SUPABASE_URL และ ANON KEY
/api.js               # Supabase client + auth helpers
/app.js               # Router + หน้า Home + Auth UI
/modules/
  announcements.js    # ข่าวจากตาราง posts
  checkin.js          # ลงเวลา + อัปโหลดรูปไป bucket checkin-photos
  leave.js            # ยื่นคำขอลา + รายการของฉัน
  apphub.js           # ดึงรายการไอคอนลิงก์จากตาราง app_links
/supabase.sql         # สร้างตารางและนโยบาย RLS
```

## วิธีติดตั้งอย่างย่อ
1. สร้างโปรเจกต์ใน Supabase
2. ไปที่ **SQL Editor** แล้วรันไฟล์ `supabase.sql`
3. ไปที่ **Storage** > สร้าง bucket:
   - `attachments` (อ่านสาธารณะได้ ถ้าต้องการเผยแพร่ไฟล์แนบข่าว)
   - `checkin-photos` (ส่วนตัว ใช้นโยบายตามคอมเมนต์ใน `supabase.sql`)
   จากนั้น **Policies** ทำตามตัวอย่างใน `supabase.sql`
4. ไปที่ **Authentication > URL Configuration** เพิ่มโดเมน GitHub Pages ของคุณไว้ใน *Redirect URLs*
5. สร้างไฟล์ `config.js` จาก `config.js` (ที่นี่มีอยู่แล้ว ให้แก้ค่า):
   ```js
   export const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
   export const SUPABASE_ANON_KEY = "YOUR-ANON-KEY";
   ```
6. เปิด `index.html` แบบ local ได้ หรือ push ไป GitHub แล้วเปิด GitHub Pages

## สร้างข้อมูลตัวอย่าง
- ตาราง `posts`:
  ```sql
  insert into posts (title, body, category, audience, pinned, published_at)
  values
  ('ประกาศทดสอบ', 'ยินดีต้อนรับสู่พอร์ทัลโรงเรียน', 'ประชาสัมพันธ์', 'public', true, now());
  ```
- ตาราง `app_links`:
  ```sql
  insert into app_links (title, url, icon, category, visible_roles)
  values
  ('ระบบอาหารกลางวัน', 'https://example.com/lunch', '🍱', 'ฝ่ายบริหารทั่วไป', '{staff}'),
  ('นิเทศการสอน', 'https://example.com/supervision', '🧑‍🏫', 'วิชาการ', '{staff}');
  ```

## Notes
- การเข้าสู่ระบบใช้ **Magic link (OTP)** — ใส่อีเมลแล้วตรวจสอบกล่องจดหมาย
- ฟีเจอร์เขียนโพสต์/อนุมัติลา/แอดมิน: ต้องกำหนด role ใน `public.profiles.role` เป็น `editor`, `approver` หรือ `admin` (update ตรงๆ ในตารางหรือทำหน้าแอดมินภายหลัง)
- ภาพ Check-in ใช้ **signed URL** แสดงผล (นโยบาย storage จำกัดให้เจ้าของอ่านได้)

> พร้อมต่อยอด: ปฏิทิน, ศูนย์เอกสาร (OIT), Helpdesk/ร้องเรียน, RBAC ลึกขึ้น, Geofence server logic


## อัปเดตใน Phase 1
- หน้าอ่านข่าวแบบเต็ม (#post?id=ID) + บันทึกการอ่าน (post_reads)
- หน้าเขียนข่าว (#compose) สำหรับ `editor/admin` + แนบไฟล์หลายไฟล์ (post_attachments)
- คงเหลือวันลา (leave_balances) แสดงบนหน้า Leave
- Router รองรับพารามิเตอร์ใน hash

### ตัวอย่าง seed (balances)
```sql
insert into leave_balances (user_id, type, balance)
values
  ('<USER_UUID>', 'vacation', 10),
  ('<USER_UUID>', 'business', 5);
```
