
# APPWD v5.3.4
- แก้ SyntaxError ทั้ง `app.js`, `news.js`, `links.js`, `sw.js`
- LIFF Bridge ชัดเจน: Endpoint = index.html, Redirect = auth-bridge.html
- SW แบบ network-first สำหรับ HTML, เปลี่ยนชื่อแคชทุกเวอร์ชัน
- มี SQL เต็ม + ตัวอย่างข้อมูล

ติดตั้ง:
1) ตั้ง `config.js` ให้ตรงโปรเจ็กต์จริง (PUBLIC_URL ต้องลงท้ายด้วย `/`)
2) Deploy ไป `https://infobwd.github.io/APPWD/`
3) Supabase → SQL Editor: รัน `sql/init_full_v5_3_4.sql` + `sql/sample_data_v5_3_4.sql`
4) LINE Developers → LIFF:
   - Endpoint URL: `https://infobwd.github.io/APPWD/index.html` (หรือ `https://infobwd.github.io/APPWD/`)
   - Redirect URL ที่อนุญาต: `https://infobwd.github.io/APPWD/auth-bridge.html`
