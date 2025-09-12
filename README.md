
# APPWD — School Hub (v5.3.5)

ศูนย์กลาง “ข่าว • ลิงก์ระบบ • เช็คอิน” สำหรับโรงเรียน UX แนวแอปมือถือ (เหมือน "เป๋าตัง") รองรับ PWA, LINE Login (LIFF), Markdown, CRUD, และแผนที่คำนวณระยะ

## โครงสร้าง
- index.html — Shell + Tabbar + FAB
- app.js — Router + ติดตั้ง PWA + นำทาง
- liff.js — LINE Login (LIFF) + แสดงโปรไฟล์
- ui.js — Utilities (Sheet/Toast/Theme/Font/Icon scale)
- config.js — ตั้งค่าโปรเจกต์ (URL, LIFF, จุดพิกัดโรงเรียน)
- modules/news.js — ข่าว (Home 2 ล่าสุด + การ์ดเด่น 3, List, View + CRUD, Like/View/Share)
- modules/links.js — App Links (Grid + CRUD)
- modules/checkin.js — เช็คอิน (QR/GPS/Map) + **นอกเขตต้องเลือก ประชุม/อบรม/ราชการ** และกรอกรายละเอียด
- sw.js — Service Worker
- manifest.json — PWA
- sql/ — โครงสร้างฐานข้อมูล + ตัวอย่าง + ตัวช่วย Grant

## ตั้งค่า config.js
```js
export const SUPABASE_URL="https://YOUR-PROJECT.supabase.co";
export const SUPABASE_ANON_KEY="YOUR-ANON-KEY";
export const LIFF_ID="2006490627-nERN5a26";
export const PUBLIC_URL="https://infobwd.github.io/APPWD/"; // ปิดท้ายด้วย '/'
export const SCHOOL_LAT=14.301442009490573, SCHOOL_LNG=101.30579513744982, SCHOOL_RADIUS_METERS=200;
export const DEFAULT_FONT_SCALE=1, DEFAULT_ICON_SCALE=1, DEFAULT_THEME="light";
```

## LINE Developers (LIFF)
- Endpoint URL: `https://infobwd.github.io/APPWD/index.html` (หรือ `/APPWD/`)
- Redirect URL: `https://infobwd.github.io/APPWD/auth-bridge.html`

> iOS: อาจสลับ Safari ชั่วคราวตอนล็อกอิน LINE แล้วเด้งกลับแอป PWA ได้

## Supabase
1) รัน `sql/init_full_5_3_5.sql`  
2) รัน `sql/sample_data_5_3_5.sql`  
3) เปิดสิทธิ์ Editor/Admin ตามต้องการใน `sql/helpers_grants_teachers.sql`

## ธีม/ฟอนต์/ไอคอน
- ปุ่ม “ขนาดตัวอักษร/ธีม” ในหน้าโปรไฟล์ → ปรับ Light/Dark/System + scale ตัวอักษร/ไอคอน
- ค่าถูกเก็บใน localStorage และมีผลทั้งแอป

## เช็คอิน (นอกเขต)
- ถ้าอยู่นอก `SCHOOL_RADIUS_METERS` → ห้าม “มาทำงาน”
- ระบบให้เลือกเหตุผล: meeting(ประชุม) / training(อบรม) / official(ไปราชการ) + กรอกรายละเอียดภารกิจ ก่อนบันทึก

## Troubleshooting
- เห็นของเก่า: ล้าง cache หรือเปลี่ยน query `?v=535` และชื่อแคชใน sw.js เปลี่ยนตามเวอร์ชันแล้ว
- CRUD ไม่ได้: ตรวจสิทธิ์ editor ใน public.editors และล็อกอิน Supabase

MIT
