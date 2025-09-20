// modules/profile_admin.js
// Profile view (responsive + accordion) + Settings Bridge + School Lat/Lng picker
// NOTE: ไม่ยุ่งส่วน "ขนาดตัวอักษร & ธีม" ที่อยู่ใน DOM เดิม — คง id/class เดิมให้ใช้งานต่อได้

import { supabase } from '../api.js';
import { toast } from '../ui.js';

// ====== Lightweight loader for Leaflet (ใช้เฉพาะบน #profile) ======
async function ensureLeafletLoaded() {
  if (window.L) return true;
  await new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.onload = resolve;
    document.head.appendChild(link);
  });
  await new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = resolve;
    document.body.appendChild(s);
  });
  return true;
}

// ====== Settings API (อ่าน/เขียนคีย์ในตาราง settings) ======
const SettingsAPI = {
  async get(keys = []) {
    if (!keys.length) return {};
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', keys);
    if (error) { console.error(error); return {}; }
    const out = {};
    (data || []).forEach(r => out[r.key] = r.value);
    return out;
  },
  async set(pairs = {}) {
    const rows = Object.entries(pairs).map(([key, value]) => ({ key, value }));
    const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
  }
};

// ====== Utils ======
function htmx(strings, ...vals) {
  return strings.reduce((acc, s, i) => acc + s + (vals[i] ?? ''), '');
}
function scrollIntoViewSafe(el) {
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ====== UI Templates ======
function card(title, bodyHTML, extra='') {
  return htmx`
  <section class="bg-white rounded-xl card p-5 ${extra}">
    <div class="flex items-center justify-between gap-3 mb-3">
      <h3 class="text-lg font-semibold">${title}</h3>
    </div>
    ${bodyHTML}
  </section>`;
}

function accordion(id, title, innerHTML, open=false){
  return htmx`
  <details id="${id}" class="bg-white rounded-xl card p-0 overflow-hidden"${open?' open':''}>
    <summary class="list-none cursor-pointer select-none px-5 py-4 flex items-center justify-between">
      <span class="text-lg font-semibold">${title}</span>
      <span class="text-slate-500 text-sm">คลิกเพื่อแสดง/ซ่อน</span>
    </summary>
    <div class="px-5 pb-5">${innerHTML}</div>
  </details>`;
}

// ====== Map Picker (Leaflet) ======
async function renderMapPicker(container, lat, lng) {
  await ensureLeafletLoaded();
  container.innerHTML = `<div id="schoolMap" class="w-full h-72 rounded-lg"></div>`;
  const map = L.map('schoolMap', { scrollWheelZoom: true }).setView([lat, lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
  const marker = L.marker([lat, lng], { draggable: true }).addTo(map);

  const latEl = document.getElementById('inputSchoolLat');
  const lngEl = document.getElementById('inputSchoolLng');

  const updateInputs = (p) => {
    const { lat, lng } = p;
    latEl.value = lat.toFixed(6);
    lngEl.value = lng.toFixed(6);
  };

  marker.on('dragend', () => updateInputs(marker.getLatLng()));
  map.on('click', (e) => { marker.setLatLng(e.latlng); updateInputs(e.latlng); });
}

// ====== Main Render ======
export async function render() {
  const app = document.getElementById('app');
  // โครงหน้าโปรไฟล์แบบ responsive (คงธีม & ขนาดตัวอักษรเดิม)
  app.innerHTML = htmx`
  <div id="profileView" class="grid grid-cols-1 md:grid-cols-2 gap-4">
    ${card('ข้อมูลผู้ใช้', `
      <div class="flex items-center gap-4">
        <img id="pfAvatar" src="" class="w-16 h-16 rounded-full object-cover bg-slate-200" alt="avatar"/>
        <div>
          <div id="pfName" class="text-base font-medium">—</div>
          <div id="pfSub" class="text-sm text-slate-500">—</div>
        </div>
      </div>
      <div class="flex gap-2 mt-3">
        <button id="btnLineLogin" class="px-3 py-2 rounded bg-emerald-600 text-white">เข้าสู่ระบบ LINE</button>
        <button id="btnLogout" class="px-3 py-2 rounded bg-slate-700 text-white hidden">ออกจากระบบ</button>
      </div>
    `)}

    ${card('การตั้งค่าทั่วไป (ย่อ)', `
      <!-- คงพื้นที่สำหรับ "ขนาดตัวอักษร & ธีม" ของเดิม -->
      <div id="profile-general-slot"></div>
    `)}
    
    ${accordion('profile-settings', 'ค่าระบบ (ปลอดภัย)', `
      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-slate-600">SUPABASE_URL</label>
          <input id="inSupabaseUrl" class="mt-1 w-full border rounded px-3 py-2" placeholder="https://xxx.supabase.co">
        </div>
        <div>
          <label class="text-sm text-slate-600">SUPABASE_ANON_KEY</label>
          <input id="inSupabaseKey" class="mt-1 w-full border rounded px-3 py-2" placeholder="anon key">
        </div>
        <div>
          <label class="text-sm text-slate-600">LIFF_ID</label>
          <input id="inLiffId" class="mt-1 w-full border rounded px-3 py-2" placeholder="2000-xxxx">
        </div>
      </div>
      <div class="mt-3 flex gap-2">
        <button id="btnSaveSecure" class="px-4 py-2 rounded bg-slate-900 text-white">บันทึกค่าระบบ</button>
        <button id="btnReloadSecure" class="px-4 py-2 rounded bg-white border">โหลดจาก DB</button>
      </div>
    `)}

    ${accordion('profile-advanced', 'ตำแหน่งโรงเรียน (SCHOOL_LAT/LNG)', `
      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-slate-600">SCHOOL_LAT</label>
          <input id="inputSchoolLat" class="mt-1 w-full border rounded px-3 py-2" placeholder="14.0">
        </div>
        <div>
          <label class="text-sm text-slate-600">SCHOOL_LNG</label>
          <input id="inputSchoolLng" class="mt-1 w-full border rounded px-3 py-2" placeholder="99.0">
        </div>
      </div>
      <div class="mt-3" id="mapContainer">
        <div class="rounded-lg bg-slate-100 h-72 grid place-items-center text-slate-500">กำลังโหลดแผนที่…</div>
      </div>
      <div class="mt-3 flex gap-2">
        <button id="btnSaveSchoolLL" class="px-4 py-2 rounded bg-indigo-600 text-white">บันทึกพิกัด</button>
        <button id="btnReloadSchoolLL" class="px-4 py-2 rounded bg-white border">โหลดจาก DB</button>
      </div>
    `, /*open*/ location.hash.includes('profile-advanced'))}
  </div>
  `;

  // ===== เติมข้อมูลโปรไฟล์จาก LINE (ถ้ามี liff.js จะอัปเดตเหล่านี้แทน) =====
  try {
    const lp = JSON.parse(localStorage.getItem('LINE_PROFILE') || 'null');
    if (lp?.pictureUrl) document.getElementById('pfAvatar').src = lp.pictureUrl;
    if (lp?.displayName) document.getElementById('pfName').textContent = lp.displayName;
    if (lp?.userId) document.getElementById('pfSub').textContent = lp.userId;
  } catch(e){ /* ignore */ }

  // ===== โหลดค่าปลอดภัยจาก settings =====
  async function loadSecure(){
    const v = await SettingsAPI.get(['SUPABASE_URL','SUPABASE_ANON_KEY','LIFF_ID']);
    document.getElementById('inSupabaseUrl').value = v.SUPABASE_URL || '';
    document.getElementById('inSupabaseKey').value = v.SUPABASE_ANON_KEY || '';
    document.getElementById('inLiffId').value = v.LIFF_ID || '';
  }
  async function saveSecure(){
    const pairs = {
      SUPABASE_URL: document.getElementById('inSupabaseUrl').value.trim(),
      SUPABASE_ANON_KEY: document.getElementById('inSupabaseKey').value.trim(),
      LIFF_ID: document.getElementById('inLiffId').value.trim()
    };
    await SettingsAPI.set(pairs);
    toast('บันทึกค่าระบบเรียบร้อย');
  }

  document.getElementById('btnReloadSecure').onclick = loadSecure;
  document.getElementById('btnSaveSecure').onclick = () => saveSecure().catch(e => toast('บันทึกไม่สำเร็จ: '+e.message));

  await loadSecure();

  // ===== Lat/Lng + Map =====
  let lat = 14.000000, lng = 99.000000; // default
  async function loadSchoolLL(){
    const v = await SettingsAPI.get(['SCHOOL_LAT','SCHOOL_LNG']);
    if (v.SCHOOL_LAT) lat = Number(v.SCHOOL_LAT);
    if (v.SCHOOL_LNG) lng = Number(v.SCHOOL_LNG);
    document.getElementById('inputSchoolLat').value = String(lat);
    document.getElementById('inputSchoolLng').value = String(lng);
    await renderMapPicker(document.getElementById('mapContainer'), lat, lng);
  }
  async function saveSchoolLL(){
    const latV = Number(document.getElementById('inputSchoolLat').value);
    const lngV = Number(document.getElementById('inputSchoolLng').value);
    if (Number.isNaN(latV) || Number.isNaN(lngV)) { toast('กรุณากรอกตัวเลขละติจูด/ลองจิจูด'); return; }
    await SettingsAPI.set({ SCHOOL_LAT: latV, SCHOOL_LNG: lngV });
    toast('บันทึกพิกัดเรียบร้อย');
  }

  document.getElementById('btnReloadSchoolLL').onclick = () => loadSchoolLL().catch(e=>toast('โหลดพิกัดไม่สำเร็จ: '+e.message));
  document.getElementById('btnSaveSchoolLL').onclick = () => saveSchoolLL().catch(e=>toast('บันทึกพิกัดไม่สำเร็จ: '+e.message));

  await loadSchoolLL();

  // ===== ถ้ามี #profile-advanced ใน URL ให้โฟกัสลง accordion และเลื่อนเข้า viewport =====
  if (location.hash.includes('profile-advanced')) {
    const adv = document.getElementById('profile-advanced');
    if (adv && !adv.open) adv.open = true;
    setTimeout(()=>scrollIntoViewSafe(adv), 100);
  }

  // ===== ปุ่ม Login/Logout (คง pattern เดิม — liff.js ดูแล event จริง) =====
  const btnLogin = document.getElementById('btnLineLogin');
  const btnLogout = document.getElementById('btnLogout');
  btnLogin?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('app:liff:login')));
  btnLogout?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('app:liff:logout')));
}

// ===== Helper สำหรับสิทธิ์ (ชื่อเดิมคงไว้ให้ไฟล์อื่นเรียกใช้ได้)
export async function isAdmin() {
  // สมมติว่ามีตาราง profiles(role) อยู่แล้ว
  const { data, error } = await supabase.from('profiles').select('role').eq('user_id', (await supabase.auth.getUser()).data.user?.id || '00000000-0000-0000-0000-000000000000').maybeSingle();
  if (error) return false;
  return data?.role === 'admin';
}
