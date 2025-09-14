# APPWD v5.6.1 — Admin CRUD + Home Links (Supabase + LIFF + PWA)

**APPWD** คือเว็บแอประบบภายในโรงเรียน (Static Frontend + Supabase) ที่รันบน GitHub Pages โดยใช้ ES Modules (Vanilla JS) และเชื่อมต่อ:
- **Supabase** (Postgres + Auth + Row Level Security)
- **LINE LIFF** สำหรับล็อกอิน
- **PWA** (มี `manifest.json` และ service worker :white_check_mark:)

โครงหลัก:
- หน้า Home: ข่าวล่าสุด + การ์ดลิงก์ระบบที่ใช้บ่อย (App Links)
- ข่าว (News): รายการข่าว, อ่านเนื้อหา, นับยอดวิว/กดถูกใจ, แชร์
- ลิงก์ระบบ (Links): รวมลิงก์ตามหมวดหมู่
- เช็คอิน (Check-in): เช็คอิน GPS/QR, บันทึกนอกสถานที่, รายการวันนี้, สรุปสัปดาห์/เดือน/ปี
- โปรไฟล์/ผู้ดูแล (Profile/Admin): ตั้งค่าระบบ, จัดการ App Links (CRUD), toggle service worker

> หมายเหตุ: โค้ด SQL (`sql/init_full_5_5_0.sql`) ในแพ็กเกจนี้มี `...` บางช่วง (ถูกย่อ) จึงมีบางคอลัมน์ที่สรุป **จากโค้ดและไฟล์ตัวอย่าง** หากใช้งานจริงให้ตรวจสอบสคีมาในฐานข้อมูลของท่านอีกครั้ง

## โครงสร้างไฟล์ (ย่อ)
```
📁 icons/
  📄 icons/icon-192.png
  📄 icons/icon-512.png
📁 modules/
  📄 modules/applinks_admin.js
  📄 modules/checkin.js
  📄 modules/enhance.js
  📄 modules/home.js
  📄 modules/links.js
  📄 modules/news.js
  📄 modules/profile_admin.js
📁 sql/
  📄 sql/init_full_5_5_0.sql
  📄 sql/sample_app_links.sql
  📄 sql/sample_data_5_5_0.sql
  📄 sql/sample_posts.sql
  📄 sql/sample_settings.sql
📄 api.js
📄 app.js
📄 auth-bridge.html
📄 config.js
📄 index.html
📄 liff.js
📄 manifest.json
📄 README.md
📄 settings.js
📄 style.css
📄 sw.js
📄 ui.js
```

## การตั้งค่าเริ่มต้น (`config.js`)
- `SUPABASE_URL` — โครงการ Supabase ของคุณ
- `SUPABASE_ANON_KEY` — anon key
- `LIFF_ID` — LINE LIFF ID
- `PUBLIC_URL` — Base URL ของเว็บ (ต้องลงท้ายด้วย `/` หากเผยแพร่บน GitHub Pages)
- แผนที่/ขอบเขตเช็คอิน: `SCHOOL_LAT`, `SCHOOL_LNG`, `SCHOOL_RADIUS_METERS`
- เวลาเช็คอิน: `CHECKIN_START`, `CHECKIN_ON_TIME_UNTIL`
- พฤติกรรม UI: `SUMMARY_DEFAULT_RANGE_DAYS`, `SLIDER_AUTO_MS`, `DEFAULT_FONT_SCALE`, `DEFAULT_ICON_SCALE`, `DEFAULT_THEME`
- Local settings helper: `getSetting(key)`, `setLocalSettings(obj)`, `getEnableSW()`, `setEnableSW()`

## Routing
ใช้ **Hash-based routing** ใน `app.js`
- `#home` → ข่าวสรุปหน้าแรก + การ์ดลิงก์เด่น
- `#news` → รายการข่าว (แบ่งหน้า)
- `#post?id=123` → อ่านข่าวฉบับเต็ม
- `#links` → ลิงก์ระบบเป็นหมวด
- `#checkin` → เช็คอิน/ดูรายการวันนี้/สรุป
- `#profile` → โปรไฟล์ / แผงผู้ดูแล (สำหรับ admin)

## ฟีเจอร์หลักตามโมดูล

### 1) ข่าว — `modules/news.js`
- `renderHome()` — แสดงข่าวล่าสุดบนหน้า Home (รายการ + การ์ด)
- `renderList()` — รายการข่าวแบบแบ่งหน้า (ค่าเริ่มต้น 10 รายการ/หน้า)
- `renderDetail(id)` — อ่านข่าว พร้อมนับ view/like และปุ่มแชร์ (LINE/ระบบแชร์)
- Global handlers:
  - `window.sharePost(id)` — แชร์ข่าว
  - `window.editPost(id)` — เปิดฟอร์มแก้ไขข่าว (สิทธิ์เฉพาะ admin/editor)
  - `window.deletePost(id)` — ลบข่าว (สิทธิ์เฉพาะ admin/editor)

> ฝั่งฐานข้อมูลมีฟังก์ชันเก็บสถิติ: `increment_view`, `like_post`, `unlike_post` (ดูหัวข้อสคีมาด้านล่าง)

### 2) ลิงก์ระบบ — `modules/links.js`
- `render()` — ดึง `app_links` จาก Supabase แยกเป็นหมวดหมู่และแสดงเป็นการ์ด
  - ใช้ favicon อัตโนมัติ (หากไม่กำหนด `image_url`)

### 3) เช็คอิน — `modules/checkin.js`
- `render()` — หน้าหลักเช็คอิน: ปุ่มเช็คอิน GPS/QR, เปิดกล้องสแกน, แผนที่ตำแหน่งโรงเรียน/ฉัน
- `renderHomeRecent(kind)` — แสดงรายการเช็คอินล่าสุดบนหน้า Home (ตามชนิดงาน)
- `renderHomeSummary()` — สรุปจำนวนเช็คอินตามประเภทงานบนหน้า Home
- อื่น ๆ ภายในโมดูล:
  - `statusFromTime()` — สถานะตามเวลา (on_time/late)
  - `saveCheckin({...})` — บันทึกเช็คอิน (GPS, QR+GPS, นอกสถานที่ พร้อมบันทึกเหตุผล/โน้ต/ระยะทาง/ในรัศมี)
  - `openScanner()/closeScanner()` — เปิด/ปิดสแกนเนอร์ QR
  - `initMap()/updateMeMarker()` — แผนที่ (Leaflet) และตำแหน่งผู้ใช้
  - ตัวช่วย UI: สไลด์การ์ดบนหน้าจอเล็ก (`applyCheckinLatestSlider`)

- Global handler:
  - `window.editOffsite(id, purpose, note)` — แก้รายละเอียด "ไปราชการ/อบรม/นอกสถานที่" ของวันนี้

### 4) โปรไฟล์/ผู้ดูแล — `modules/profile_admin.js`
- `render()` — เรนเดอร์ข้อมูลโปรไฟล์พื้นฐาน
- `isAdmin()` — ตรวจสอบสิทธิ์จาก `users.role = 'admin'` หรือผ่านตาราง `editors`
- **แผงผู้ดูแล (Advanced):**
  - ตั้งค่า `CHECKIN_*`, `SUMMARY_DEFAULT_RANGE_DAYS`, `SLIDER_AUTO_MS`, `BRAND_TITLE`, `BRAND_LOGO_URL`
  - จัดการ App Links (CRUD) ผ่าน `modules/applinks_admin.js`
  - ปุ่ม reload settings / toggle service worker (ถ้าเปิดใช้)

### 5) การ์ดลิงก์หน้าแรก — `modules/home.js`
- `renderAppsCard(containerId='homeLinks')` — โหลดลิงก์เด่นจาก `app_links` (limit 8) และแสดงเป็น grid

### 6) ตัวช่วย UI/ระบบ
- `ui.js` — `toast`, `openSheet/closeSheet` (bottom sheet), `skel` (skeleton), `goto`, `openPrefs` (Font/Icon/Theme)
- `liff.js` — จัดการ LIFF login/logout และเก็บโปรไฟล์ไว้ใน `localStorage`
- `settings.js` — โหลดค่าจากตาราง `settings` เข้าสู่ `localStorage` + apply ทันทีเมื่อเปลี่ยน
- `sw.js` — service worker แบบ minimal
- `manifest.json` — PWA metadata

## สรุปรายชื่อฟังก์ชัน (auto scan)
#### `api.js`
- `currentUser()`

#### `app.js`
- `bindUI()`
- `parseHash()`
- `route()`
- `setActive()`

#### `config.js`
- `getEnableSW()`
- `getSetting()`
- `setEnableSW()`
- `setLocalSettings()`

#### `liff.js`
- `doLogout()`
- `ensureSlash()`
- `init()`
- `loadProfile()`
- `renderProfile()`
- `saveProfile()`

#### `modules/applinks_admin.js`
- `deleteLink()`
- `fetchLinks()`
- `formHTML()`
- `listItemHTML()`
- `refresh()`
- `renderAppLinksAdmin()`
- `upsertLink()`
- `wireForm()`

#### `modules/checkin.js`
- `applyCheckinLatestSlider()`
- `card()`
- `closeScanner()`
- `dist()`
- `doCheckin()`
- `editOffsite()`
- `fmtDist()`
- `getGeo()`
- `initMap()`
- `initTabs()`
- `loadToday()`
- `nowMinutes()`
- `openScanner()`
- `purposeLabel()`
- `render()`
- `renderHomeRecent()`
- `renderHomeSummary()`
- `renderSummary()`
- `saveCheckin()`
- `statusFromTime()`
- `toMinutes()`
- `updateMeMarker()`

#### `modules/enhance.js`
- `badge()`
- `getStatus()`
- `parseHHMM()`
- `renderCheckinLatest()`

#### `modules/home.js`
- `favicon()`
- `loadFeaturedApps()`
- `mk()`
- `renderAppsCard()`
- `safe()`

#### `modules/links.js`
- `el()`
- `esc()`
- `favicon()`
- `render()`

#### `modules/news.js`
- `canManageContent()`
- `deletePost()`
- `editPost()`
- `fetchStats()`
- `loadPage()`
- `openComposeSheet()`
- `openEditSheet()`
- `renderDetail()`
- `renderHome()`
- `renderList()`
- `sharePost()`

#### `modules/profile_admin.js`
- `isAdmin()`
- `mountAdvanced()`
- `render()`

#### `settings.js`
- `applyLocalSettings()`
- `loadSettings()`

#### `ui.js`
- `closeSheet()`
- `esc()`
- `goto()`
- `openPrefs()`
- `openSheet()`
- `skel()`
- `toast()`


## สคีมาฐานข้อมูล (Postgres @ Supabase)
### `settings`
- `key text primary key`
- `value text not null`
- `updated_at timestamptz default now()`

### `users`
- `line_user_id text primary key`
- `display_name text`
- `picture_url text`
- `role text check (role in ('admin','editor','teacher','student','parent')) default 'teacher'`
- `classroom text`
- `phone text`
- `email text`
- `supabase_user_id uuid references auth.users(id)`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `posts`
- `id bigserial primary key`
- `title text not null`
- `category text`
- `body text`
- `cover_url text`
- `is_featured boolean default false`
- `published_at timestamptz default now()`
- `created_by uuid references auth.users(id) on delete set null`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `post_stats`
- `post_id bigint primary key references public.posts(id) on delete cascade`
- `view_count bigint not null default 0`
- `like_count bigint not null default 0`
- `updated_at timestamptz default now()`

### `post_likes`
- `post_id bigint references public.posts(id) on delete cascade`
- `line_user_id text not null`
- `created_at timestamptz default now()`

### `app_links`
- `id bigserial primary key`
- `title text not null`
- `url text not null`
- `image_url text`
- `category text`
- `sort_order int default 100`
- `is_active boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `checkins`
- `id bigserial primary key`
- `line_user_id text`
- `line_display_name text`
- `line_picture_url text`
- `user_line_id text references public.users(line_user_id) on delete set null`
- `method text`
- `purpose text check (purpose in ('work','meeting','training','official')) default 'work'`
- `status text check (status in ('on_time','late','offsite'))`
- `note text`
- `lat double precision`
- `lng double precision`
- `accuracy double precision`
- `distance_m integer`
- `within_radius boolean default false`
- `created_at timestamptz default now()`

### `editors`
- `user_id uuid primary key references auth.users(id) on delete cascade`
- `created_at timestamptz default now()`

## Stored Functions (ในไฟล์ SQL)
- `increment_view(p_post_id bigint) → bigint`
- `like_post(p_post_id bigint, p_line_user_id text) → bigint`
- `unlike_post(p_post_id bigint, p_line_user_id text) → bigint`

## การรันแบบโลคัล & การเผยแพร่
> โปรเจกต์ใช้ ES Modules — ต้องเสิร์ฟผ่าน HTTP server (ห้ามเปิดไฟล์ `index.html` ตรง ๆ)

**โลคัล**
```bash
# ตัวอย่างด้วย Python
python3 -m http.server 8080

# หรือใช้ Node
npx serve -p 8080
```
- ตั้งค่า `config.js` ให้ถูกต้อง (โดยเฉพาะ `PUBLIC_URL` หากทดสอบไม่ตรง root)
- LIFF login ต้องใช้โดเมนที่ลงทะเบียนใน LINE Developers

**เผยแพร่ (GitHub Pages)**
1. Push ไฟล์ทั้งหมดขึ้น branch `gh-pages` หรือเปิด Pages จาก `main`
2. ตั้งค่า `PUBLIC_URL` ให้ตรงกับ URL จริง (ลงท้ายด้วย `/`)
3. อัปเดตตาราง `settings`, `app_links`, `users` ใน Supabase ตามต้องการ

## หมายเหตุด้านความปลอดภัย (สำคัญ)
- ตรวจสอบ **RLS Policies** ในตาราง `posts`, `post_likes`, `post_stats`, `app_links`, `checkins`, `users`, `settings`
- ตัวอย่างในไฟล์ SQL เปิดสิทธิ์อ่านสาธารณะ และอนุญาต insert/update บางรายการเพื่อให้ง่ายต่อการเดโม
- ในการใช้งานจริง ควรกำหนดสิทธิ์ตามบทบาท (admin/editor/teacher/...) และตรวจสอบ input ฝั่งไคลเอนต์ให้รัดกุม