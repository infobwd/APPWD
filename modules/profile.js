// modules/profile.js
// รวม: SW toggle (ของเดิม) + ตั้งค่า Theme/Font + ดึงข้อมูล users มาขึ้นหน้าโปรไฟล์

import { supabase } from '../api.js';
import { openSheet, closeSheet, toast } from '../ui.js';
import { getEnableSW, setEnableSW } from '../config.js';

/* ---------- Utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const onProfileRoute = () => {
  const hash = (location.hash || '#').replace('#','').split('?')[0];
  return hash === 'profile' || hash === 'tab-profile';
};
const getLineProfile = () => {
  try { return JSON.parse(localStorage.getItem('LINE_PROFILE') || 'null'); }
  catch { return null; }
};
const getSettings = () => {
  try { return JSON.parse(localStorage.getItem('APPWD_SETTINGS') || '{}'); }
  catch { return {}; }
};
const saveSettings = (patch) => {
  const cur = getSettings();
  const next = { ...cur, ...patch };
  localStorage.setItem('APPWD_SETTINGS', JSON.stringify(next));
  document.dispatchEvent(new CustomEvent('appwd:settingsSaved', { detail: next }));
};

/* ----------  A) SW toggle (ของเดิม) ---------- */
export function initProfileSWToggle() {
  let container =
    document.querySelector('#profile-advanced') ||
    document.querySelector('#profileContent') ||
    document.querySelector('#tab-profile') ||
    document.querySelector('[data-tab="profile"]') ||
    document.body;

  let section = document.getElementById('profile-advanced');
  if (!section) {
    section = document.createElement('section');
    section.id = 'profile-advanced';
    section.style.marginTop = '1.5rem';
    section.innerHTML = `
      <div style="font-weight:600;font-size:1.125rem;line-height:1.75rem;margin-bottom:.25rem">Advanced</div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem;border-radius:.75rem;border:1px solid #334155;background:rgba(15,23,42,.5)">
        <div>
          <div style="font-weight:500">Service Worker (PWA)</div>
          <p id="swStatusText" style="font-size:.875rem;color:#94a3b8">กำลังตรวจสอบ…</p>
        </div>
        <button id="swToggleBtn" style="padding:.5rem 1rem;border-radius:.5rem;border:1px solid #475569;background:transparent;color:#e2e8f0;cursor:pointer">
          …
        </button>
      </div>`;
    container.appendChild(section);
  }

  const btn = section.querySelector('#swToggleBtn');
  const txt = section.querySelector('#swStatusText');

  const refreshUI = () => {
    const on = getEnableSW();
    if (btn) btn.textContent = on ? 'ปิด (DEV)' : 'เปิด (PROD)';
    if (txt) txt.textContent = on
      ? 'เปิด SW: แคชเพื่อความไว (โหมด PROD)'
      : 'ปิด SW: โหลดไฟล์สดทุกครั้ง (โหมด DEV)';
  };

  refreshUI();

  btn && btn.addEventListener('click', async () => {
    const currentlyOn = getEnableSW();
    if (currentlyOn) {
      setEnableSW(false);
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
        if (window.caches && caches.keys) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
      } catch(e){}
      refreshUI();
      alert('ปิด SW แล้ว และล้างแคชเรียบร้อย\nขอให้ Reload หน้าเพื่อให้ผลมีผลเต็มที่');
      location.reload();
    } else {
      setEnableSW(true);
      refreshUI();
      try {
        if ('serviceWorker' in navigator) {
          await navigator.serviceWorker.register(window.__APPWD_SW_URL__ || './sw.js?v=561');
        }
      } catch(e){}
      alert('เปิด SW แล้ว\nขอให้ Reload หน้าเพื่อให้ SW คุมเนื้อหาทั้งหมด');
      location.reload();
    }
  });
}

/* ----------  B) Theme/Font dialog ---------- */
function openThemeDialog() {
  const s = getSettings();
  const theme = s.THEME || 'light';
  const fs = Number(s.FONT_SCALE || 1);
  const ic = Number(s.ICON_SCALE || 1);

  openSheet(`
    <div class='space-y-4'>
      <div class='font-semibold text-base'>ขนาดตัวอักษร & ธีม</div>

      <div class='space-y-2'>
        <div class='text-sm text-ink3'>ธีม</div>
        <div class='grid grid-cols-3 gap-2'>
          <label class='btn'><input type='radio' name='theme' value='light' ${theme==='light'?'checked':''}> <span>Light</span></label>
          <label class='btn'><input type='radio' name='theme' value='dark' ${theme==='dark'?'checked':''}> <span>Dark</span></label>
          <label class='btn'><input type='radio' name='theme' value='system' ${theme==='system'?'checked':''}> <span>System</span></label>
        </div>
      </div>

      <div class='space-y-2'>
        <div class='text-sm text-ink3'>ขนาดตัวอักษร</div>
        <input id='fsRange' type='range' min='0.85' max='1.4' step='0.05' value='${fs}' class='w-full'>
        <div class='text-sm'><span id='fsVal'>${fs.toFixed(2)}</span>x</div>
      </div>

      <div class='space-y-2'>
        <div class='text-sm text-ink3'>ขนาดไอคอน</div>
        <input id='icRange' type='range' min='0.9' max='1.6' step='0.05' value='${ic}' class='w-full'>
        <div class='text-sm'><span id='icVal'>${ic.toFixed(2)}</span>x</div>
      </div>

      <div class='grid grid-cols-2 gap-2 pt-2'>
        <button id='cancelTheme' class='btn'>ยกเลิก</button>
        <button id='saveTheme' class='btn btn-prim'>บันทึก</button>
      </div>
    </div>
  `);

  const root = document.documentElement;
  const fsRange = $('#fsRange');
  const icRange = $('#icRange');
  const fsVal = $('#fsVal');
  const icVal = $('#icVal');

  // live preview
  fsRange.oninput = () => { root.style.setProperty('--fs-base', fsRange.value); fsVal.textContent = (+fsRange.value).toFixed(2); };
  icRange.oninput = () => { root.style.setProperty('--ic-scale', icRange.value); icVal.textContent = (+icRange.value).toFixed(2); };

  // theme preview
  document.querySelectorAll('input[name="theme"]').forEach(r=>{
    r.addEventListener('change', ()=>{
      const v = r.value;
      if (v === 'system') root.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      else root.setAttribute('data-theme', v);
    });
  });

  $('#cancelTheme').onclick = closeSheet;
  $('#saveTheme').onclick = () => {
    const chosen = (document.querySelector('input[name="theme"]:checked')?.value) || 'light';
    saveSettings({ THEME: chosen, FONT_SCALE: Number(fsRange.value), ICON_SCALE: Number(icRange.value) });
    closeSheet();
  };
}

/* ----------  C) users: load and render ---------- */
function renderUserDetails(row) {
  const host = $('#profileView .card'); if (!host) return;

  let box = $('#pfDetails');
  if (!box) {
    box = document.createElement('div');
    box.id = 'pfDetails';
    box.className = 'grid grid-cols-1 md:grid-cols-2 gap-2 mt-3';
    host.appendChild(box);
  }
  const F = (label, value='—') =>
    `<div class="card p-3 text-sm">
       <div class="text-ink3">${label}</div>
       <div class="font-medium break-words">${value || '—'}</div>
     </div>`;

  box.innerHTML = [
    F('บทบาท (role)', row?.role),
    F('ห้อง/กลุ่มสาระ', row?.classroom),
    F('อีเมล', row?.email),
    F('เบอร์โทร', row?.phone),
    F('สร้างเมื่อ', row?.created_at ? new Date(row.created_at).toLocaleString('th-TH') : ''),
    F('อัปเดตล่าสุด', row?.updated_at ? new Date(row.updated_at).toLocaleString('th-TH') : '')
  ].join('');
}

async function loadUserDetails() {
  const line = getLineProfile();
  // อัปหัวโปรไฟล์เดิม
  if (line) {
    const avatar = $('#pfAvatar');
    const name = $('#pfName');
    const sub = $('#pfSub');
    if (avatar && line.pictureUrl) avatar.src = line.pictureUrl;
    if (name) name.textContent = line.displayName || 'ผู้ใช้';
    if (sub)  sub.textContent  = line.userId || '';
  }
  if (!line?.userId) { renderUserDetails(null); return; }

  const { data, error, status } = await supabase
    .from('users')
    .select('*')
    .eq('line_user_id', line.userId)
    .maybeSingle();

  if (error) {
    console.warn('load users error', status, error);
    renderUserDetails(null);
    return;
  }
  renderUserDetails(data);
}

/* ----------  D) wire buttons & init ---------- */
function wireProfileUI() {
  const themeBtn = $('#btnTheme');
  if (themeBtn) themeBtn.onclick = openThemeDialog;
}

function initProfilePage() {
  if (!onProfileRoute()) return;
  wireProfileUI();
  loadUserDetails().catch(()=>{});
  initProfileSWToggle();
}

// first run + on route change
document.addEventListener('DOMContentLoaded', initProfilePage);
window.addEventListener('hashchange', initProfilePage);
