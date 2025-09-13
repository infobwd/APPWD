// modules/profile.js
import { isAdmin } from './profile_admin.js';     // <-- ใช้ตัวนี้เป็นแหล่งความจริง
import { getEnableSW, setEnableSW } from '../config.js';

function isProfileRoute(){
  const hash = (location.hash || '#').replace('#','').split('?')[0];
  return hash === 'profile' || hash === 'tab-profile';
}

function removeAdvanced(){
  document.getElementById('profile-advanced')?.remove();
}

function ensureAdvancedSection(parent){
  let section = document.getElementById('profile-advanced');
  if (!section){
    section = document.createElement('section');
    section.id = 'profile-advanced';
    section.className = 'mt-6';
    section.innerHTML = `
      <h3 class="text-lg font-semibold">Advanced</h3>
      <div class="mt-3 flex items-center justify-between p-4 rounded-xl border border-slate-700 bg-slate-900/40">
        <div>
          <div class="font-medium">Service Worker (PWA)</div>
          <p class="text-sm text-slate-400" id="swStatusText">กำลังตรวจสอบ…</p>
        </div>
        <button id="swToggleBtn"
          class="px-4 py-2 rounded-lg border border-slate-600 hover:bg-slate-800 transition">
          …
        </button>
      </div>`;
    parent.appendChild(section);
  }
  return section;
}

async function renderAdvancedIfAllowed(){
  // เงื่อนไขอนุญาต = เป็นแอดมิน + อยู่หน้าโปรไฟล์
  let allowed = false;
  try {
    // รองรับทั้ง isAdmin() แบบ sync หรือ async
    allowed = await Promise.resolve(isAdmin());
  } catch(e){ allowed = false; }

  if (!allowed || !isProfileRoute()){
    removeAdvanced();
    return;
  }

  // parent container ของหน้าโปรไฟล์ (เลือกตัวที่ตรงกับโค้ดจริงของพี่ที่รัก)
  const parent =
    document.querySelector('#profileContent') ||
    document.querySelector('#tab-profile')   ||
    document.querySelector('[data-tab="profile"]') ||
    document.body;

  if (!parent) return;

  const section = ensureAdvancedSection(parent);
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

  btn?.addEventListener('click', async () => {
    const on = getEnableSW();
    if (on){
      // Turn OFF (DEV)
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
      alert('ปิด SW แล้ว และล้างแคชเรียบร้อย\nกรุณา Reload หน้า');
      location.reload();
    } else {
      // Turn ON (PROD)
      setEnableSW(true);
      refreshUI();
      try {
        if ('serviceWorker' in navigator) {
          await navigator.serviceWorker.register(window.__APPWD_SW_URL__ || './sw.js?v=561');
        }
      } catch(e){}
      alert('เปิด SW แล้ว\nกรุณา Reload หน้า');
      location.reload();
    }
  });
}

// เรียกตอนโหลด และเมื่อสลับแท็บ/route
if (document.readyState === 'complete' || document.readyState === 'interactive'){
  setTimeout(renderAdvancedIfAllowed, 0);
} else {
  document.addEventListener('DOMContentLoaded', () => setTimeout(renderAdvancedIfAllowed, 0));
}
window.addEventListener('hashchange', renderAdvancedIfAllowed);
