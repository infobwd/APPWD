
import { supabase } from '../api.js';
import { toast } from '../ui.js';
import { getEnableSW, setEnableSW } from '../config.js';

const $id = (id) => document.getElementById(id);
const isProfileRoute = () => {
  const hash = (location.hash || '#').replace('#','').split('?')[0];
  return hash === 'profile' || hash === 'tab-profile';
};
const getLineId = () => {
  try {
    const prof = JSON.parse(localStorage.getItem('LINE_PROFILE') || 'null');
    return prof?.userId || null;
  } catch { return null; }
};

let _roleCache = null, _roleAt = 0;
const ROLE_TTL = 10 * 60 * 1000;

export async function isAdmin(){
  if (_roleCache && (Date.now() - _roleAt) < ROLE_TTL) return _roleCache === 'admin';
  const lineId = getLineId();
  if (!lineId) return false;
  const u = await supabase.from('users').select('role').eq('line_user_id', lineId).maybeSingle();
  const role = u?.data?.role || 'user';
  _roleCache = role; _roleAt = Date.now();
  return role === 'admin';
}

function mountAdvanced() {
  if (!isProfileRoute()) { $id('profile-advanced')?.remove(); return; }
  $id('profile-font-settings')?.remove();
  $id('profile-theme-settings')?.remove();

  const parent =
    $id('adminCard') ||
    $id('profileContent') ||
    $id('tab-profile') ||
    document.querySelector('[data-tab="profile"]') ||
    document.body;

  if (!parent) return;

  let section = $id('profile-advanced');
  if (!section) {
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

  const btn = $id('swToggleBtn');
  const txt = $id('swStatusText');

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
    if (on) {
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
      } catch {}
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
      } catch {}
      alert('เปิด SW แล้ว\nกรุณา Reload หน้า');
      location.reload();
    }
  });
}

export async function render(){
  const card = document.getElementById('adminCard');
  if (!card) return;

  const lineId = getLineId();
  if (!lineId) { card.classList.add('hide'); return; }

  const admin = await isAdmin();
  card.classList.toggle('hide', !admin);
  if (!admin) { document.getElementById('profile-advanced')?.remove(); return; }

  // mount Advanced on profile
  mountAdvanced();

  const { data } = await supabase.from('settings').select('key,value');
  const map = {};
  (data || []).forEach(r => {
    try { map[r.key] = JSON.parse(r.value); }
    catch { map[r.key] = r.value; }
  });

  const byId = (id)=>document.getElementById(id);
  byId('set_CHECKIN_START').value              = map.CHECKIN_START || '07:30';
  byId('set_CHECKIN_ON_TIME_UNTIL').value      = map.CHECKIN_ON_TIME_UNTIL || '08:00';
  byId('set_SUMMARY_DEFAULT_RANGE_DAYS').value = map.SUMMARY_DEFAULT_RANGE_DAYS ?? 30;
  byId('set_SLIDER_AUTO_MS').value             = map.SLIDER_AUTO_MS ?? 4000;
  byId('set_BRAND_TITLE').value                = map.BRAND_TITLE || 'APPWD';
  byId('set_BRAND_LOGO_URL').value             = map.BRAND_LOGO_URL || '';

  byId('btnSaveSettings').onclick = async () => {
    const payload = {
      CHECKIN_START: byId('set_CHECKIN_START').value || '07:30',
      CHECKIN_ON_TIME_UNTIL: byId('set_CHECKIN_ON_TIME_UNTIL').value || '08:00',
      SUMMARY_DEFAULT_RANGE_DAYS: Number(byId('set_SUMMARY_DEFAULT_RANGE_DAYS').value || 30),
      SLIDER_AUTO_MS: Number(byId('set_SLIDER_AUTO_MS').value || 4000),
      BRAND_TITLE: byId('set_BRAND_TITLE').value || 'APPWD',
      BRAND_LOGO_URL: byId('set_BRAND_LOGO_URL').value || ''
    };
    for (const k of Object.keys(payload)) {
      await supabase.from('settings').upsert({ key: k, value: JSON.stringify(payload[k]) });
    }
    toast('บันทึกการตั้งค่าแล้ว');
  };

  byId('btnReloadSettings').onclick = () => location.reload();
};

window.addEventListener('hashchange', async () => {
  const admin = await isAdmin();
  if (admin) mountAdvanced(); else document.getElementById('profile-advanced')?.remove();
});
