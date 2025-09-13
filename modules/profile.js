// === SW toggle UI (injected) ===
import { getEnableSW, setEnableSW } from '../config.js';

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

(function autoInit(){
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initProfileSWToggle, 0);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initProfileSWToggle, 0));
  }
})();
