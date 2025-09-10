
# APPWD — v3B Green (Markdown + Cover + QR Scan)
**โดเมนจริง**: https://infobwd.github.io/APPWD/

## Markdown + รูปภาพ + cover_url
- ใช้ **marked** แปลง Markdown → HTML และ **DOMPurify** ปลอดภัย
- เพิ่มช่อง `cover_url` ทั้งหน้าเขียนและแก้ไขข่าว
- ปุ่มอัปโหลด **ภาพปก** (bucket: `news-covers`) และ **แทรกรูปในเนื้อหา** (bucket: `news-images`)
- แนะนำตั้งค่า bucket ให้ **Public** แล้วใช้ `getPublicUrl()`

## QR Scan (FAB 🔍)
- ปุ่มกลมกลางเปลี่ยนเป็น **สแกน/ตรวจ** → เปิดหน้าสแกน (`#scan`)
- ใช้ไลบรารี `html5-qrcode` (ผ่าน CDN) เปิดกล้องหลังและอ่าน QR → แสดงผล/เปิดลิงก์/คัดลอก

## แก้ Magic Link
- Supabase → Auth → URL Configuration
  - **Site URL** และ **Additional Redirect URLs**: `https://infobwd.github.io/APPWD/`
- โค้ดฝั่ง client ใช้ `emailRedirectTo: PUBLIC_URL` แล้ว

## ตาราง/นโยบาย
- `supabase.sql` รวม `posts(cover_url)`, `post_editors`, และตารางอื่น ๆ พร้อม RLS
