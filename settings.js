// settings.js
import { supabase } from './api.js';

/**
 * โหลดค่าการตั้งค่าจากตาราง `settings` -> เก็บลง localStorage เป็น APPWD_SETTINGS
 * โครง: { KEY: parsedValue, ... }
 */
export async function loadSettings() {
  try {
    const { data, error } = await supabase.from('settings').select('key,value');
    if (error) throw error;

    const map = {};
    (data || []).forEach((r) => {
      try {
        map[r.key] = JSON.parse(r.value);
      } catch {
        map[r.key] = r.value;
      }
    });

    // เก็บไว้ใช้ภายในแอป
    localStorage.setItem('APPWD_SETTINGS', JSON.stringify(map || {}));

    // แจ้งทุกส่วนของแอปว่ามี settings พร้อมแล้ว
    document.dispatchEvent(
      new CustomEvent('appwd:settingsLoaded', { detail: map })
    );
  } catch (e) {
    // ถ้าโหลดไม่ได้ ให้คงค่าที่เคยมีไว้
    const fallback = JSON.parse(localStorage.getItem('APPWD_SETTINGS') || '{}');
    document.dispatchEvent(
      new CustomEvent('appwd:settingsLoaded', { detail: fallback })
    );
  }
}

// โหลดทันทีเมื่อ DOM พร้อม
document.addEventListener('DOMContentLoaded', loadSettings);

/** =========================
 *  ใช้งานค่าที่โหลดมา (apply)
 *  - FONT_SCALE -> --fs-base
 *  - ICON_SCALE -> --ic-scale
 *  - THEME: 'light' | 'dark' | 'system'
 *  - BRAND_TITLE / BRAND_LOGO_URL (ถ้ามี)
 * ========================= */
let _systemMedia; // เก็บ media query listener ไว้ ถ้าเลือก system

function applySystemThemeWatcher(isOn) {
  // ถ้าเคยสมัครไว้ ให้เลิกก่อนเพื่อกันซ้ำ
  if (_systemMedia && _systemMedia.removeEventListener) {
    _systemMedia.removeEventListener('change', onSystemThemeChange);
  }
  if (isOn) {
    _systemMedia = window.matchMedia('(prefers-color-scheme: dark)');
    _systemMedia.addEventListener('change', onSystemThemeChange);
  }
}

function onSystemThemeChange(e) {
  const root = document.documentElement;
  // สลับตาม OS ทันทีเมื่อผู้ใช้เปลี่ยนธีมของระบบ
  root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
}

function applyLocalSettings() {
  try {
    const obj = JSON.parse(localStorage.getItem('APPWD_SETTINGS') || '{}');
    const root = document.documentElement;

    const fs = parseFloat(obj.FONT_SCALE || 1);
    const ic = parseFloat(obj.ICON_SCALE || 1);
    const theme = obj.THEME || 'light'; // 'light' | 'dark' | 'system'

    // ตัวแปร CSS สำหรับ scale
    root.style.setProperty('--fs-base', fs || 1);
    root.style.setProperty('--ic-scale', ic || 1);

    // ธีม: ตั้งที่ <html data-theme="...">
    if (theme === 'system') {
      // ใช้ค่าจาก OS ตอนนี้ แล้วเฝ้าเปลี่ยนแปลง
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      applySystemThemeWatcher(true);
    } else {
      // ปิดตัวเฝ้า system และตั้งค่าตามที่เลือก
      applySystemThemeWatcher(false);
      root.setAttribute('data-theme', theme);
    }

    // แบรนด์ (ถ้ามี)
    if (obj.BRAND_TITLE) {
      const el = document.getElementById('brandTitle');
      if (el) el.textContent = obj.BRAND_TITLE;
    }
    if (obj.BRAND_LOGO_URL) {
      const logoBox = document.getElementById('brandBox');
      if (logoBox) {
        // ถ้ามีโลโก้ URL ให้แทนที่ตัวอักษร WD ด้วยรูป
        logoBox.style.background = 'transparent';
        logoBox.textContent = '';
        const img = new Image();
        img.src = obj.BRAND_LOGO_URL;
        img.alt = 'logo';
        img.className = 'w-10 h-10 rounded-xl object-cover';
        logoBox.appendChild(img);
      }
    }
  } catch (e) {
    // เงียบ ๆ ไป ไม่ให้พังหน้า
  }
}

// apply เมื่อโหลดหรือบันทึกค่าเสร็จ
document.addEventListener('appwd:settingsLoaded', applyLocalSettings);
document.addEventListener('appwd:settingsSaved', applyLocalSettings);

// เผื่อหน้าโหลดก่อนสัญญาณ ให้ apply หนึ่งครั้ง
window.addEventListener('DOMContentLoaded', applyLocalSettings);
