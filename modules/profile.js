// modules/profile.js
import { getEnableSW, setEnableSW } from '../config.js';

/* ====== Helper: ตรวจสิทธิ์แอดมิน ======
   - ถ้ามีระบบ role จาก Supabase/LIFF ให้แทนในฟังก์ชันนี้
   - Fallback: ใช้ localStorage.APPWD_IS_ADMIN = '1'
*/
function isAdmin(){
  try{
    const r = localStorage.getItem('APPWD_ROLE');
    if (r && r.toLowerCase() === 'admin') return true;
  }catch(e){}
  return localStorage.getItem('APPWD_IS_ADMIN') === '1';
}

/* ====== Helper: ตรวจว่าหน้าปัจจุบันคือ Profile ====== */
function isProfileRoute(){
  const hash = (location.hash || '#').replace('#','').split('?')[0];
  return hash === 'profile' || hash === 'tab-profile';
}

/* ====== Render สวิตช์ SW เฉพาะแอดมิน + หน้าโปรไฟล์ ====== */
export function mountProfileAdvanced(){
  if (!isAdmin() || !isProfileRoute()) return;

  let container =
    document.querySelector('#profile-advanced') ||
    document.querySelector('#profileContent') ||
    document.querySelector('#tab-profile') ||
    document.querySelector('[data-tab="profile"]');

  if (!container) return;

  // ถ้ายังไม่มี section ให้สร้าง
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

  btn?.addEventListener('click', async () => {
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
      alert('ปิด SW แล้ว และล้างแคชเรียบร้อย\nกรุณา Reload หน้า');
      location.reload();
    } else {
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

/* ====== Hook: เรียกเฉพาะเมื่อเข้า Profile ====== */
function onRoute(){
  // ลบ Advanced ออกก่อน (ป้องกันทับซ้อน) ถ้าไม่ใช่โปรไฟล์/ไม่ใช่แอดมิน
  if (!isProfileRoute() || !isAdmin()){
    document.getElementById('profile-advanced')?.remove();
    return;
  }
  mountProfileAdvanced();
}

if (document.readyState === 'complete' || document.readyState === 'interactive'){
  setTimeout(onRoute, 0);
} else {
  document.addEventListener('DOMContentLoaded', () => setTimeout(onRoute, 0));
}

// ทำงานเมื่อเปลี่ยนแท็บ/route
window.addEventListener('hashchange', onRoute);
