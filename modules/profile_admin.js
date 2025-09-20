// modules/profile_admin.js
// Profile view (responsive, full-card) + Secure Settings + School Lat/Lng map picker + App Links Admin
// ไม่ยุ่งส่วน "ขนาดตัวอักษร & ธีม" เดิม — เพิ่มปุ่ม #btnTheme ให้ระบบเดิม hook ได้

import { supabase } from '../api.js';
import { toast } from '../ui.js';

// ============= Leaflet loader (โหลดเฉพาะเมื่อจำเป็น) =============
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

// ============= Settings API =============
const SettingsAPI = {
  async get(keys = []) {
    if (!keys.length) return {};
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', keys);
    if (error) { console.error('[settings.get]', error); return {}; }
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

// ============= Utils =============
const h = (strings, ...vals) =>
  strings.reduce((acc, s, i) => acc + s + (vals[i] ?? ''), '');

function card(title, bodyHTML, extra='') {
  return h`
  <section class="bg-white rounded-xl card p-5 ${extra}">
    <div class="flex items-center justify-between gap-3 mb-3">
      <h3 class="text-lg font-semibold">${title}</h3>
    </div>
    ${bodyHTML}
  </section>`;
}

// ============= Map Picker =============
async function renderMapPicker(container, lat, lng) {
  await ensureLeafletLoaded();
  container.innerHTML = `<div id="schoolMap" class="w-full h-72 rounded-lg"></div>`;
  const map = L.map('schoolMap', { scrollWheelZoom: true }).setView([lat, lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
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

// ============= Main Render =============
export async function render() {
  // เป้าหมายหลักคือ #profileView; เผื่อไม่มีให้ fallback
  const root = document.getElementById('profileView') || document.getElementById('app') || document.body;
  try { root.classList.remove('hide'); } catch (_) {}

  root.innerHTML = h`
  <div id="profileResponsive" class="grid grid-cols-1 md:grid-cols-2 gap-4">

    ${card('ข้อมูลผู้ใช้', `
      <div class="flex items-center gap-4">
        <img id="pfAvatar" src="" class="w-16 h-16 rounded-full object-cover bg-slate-200" alt="avatar"/>
        <div>
          <div id="pfName" class="text-base font-medium">—</div>
          <div id="pfSub" class="text-sm text-ink3">—</div>
        </div>
      </div>
      <div class="flex gap-2 mt-3">
        <button id="btnLineLogin" class="btn btn-prim">เข้าสู่ระบบ LINE</button>
        <button id="btnLogout" class="btn hide">ออกจากระบบ</button>
      </div>
    `)}

    ${card('การตั้งค่าทั่วไป', `
      <!-- ช่องเสียบสำหรับ UI เดิมของพี่ (ขนาดตัวอักษร & ธีม) ถ้ามี HTML เดิม ให้ append เข้ามาที่นี่ -->
      <div id="profile-general-slot" class="space-y-2"></div>
      <div class="grid grid-cols-2 gap-2 mt-2">
        <button id="btnTheme" class="btn">ขนาดตัวอักษร/ธีม</button>
        <button id="btnLogout2" class="btn">ออกจากระบบ</button>
      </div>
    `)}

    ${card('ค่าระบบ (ปลอดภัย)', `
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
        <button id="btnSaveSecure" class="btn btn-prim">บันทึกค่าระบบ</button>
        <button id="btnReloadSecure" class="btn">โหลดจาก DB</button>
      </div>
    `, 'md:col-span-2')}

    ${card('ตำแหน่งโรงเรียน (SCHOOL_LAT/LNG)', `
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
        <button id="btnSaveSchoolLL" class="btn btn-prim">บันทึกพิกัด</button>
        <button id="btnReloadSchoolLL" class="btn">โหลดจาก DB</button>
      </div>
    `, 'md:col-span-2')}

    ${card('จัดการแอปลิงก์ (ผู้ดูแล)', `
      <div id="applinksAdminPanel" class="space-y-2">
        <div class="text-sm text-ink3">กำลังโหลดโมดูลจัดการลิงก์…</div>
      </div>
    `, 'md:col-span-2')}
  </div>
  `;

  // ---------- เติมข้อมูลโปรไฟล์จาก LINE ----------
  try {
    const lp = JSON.parse(localStorage.getItem('LINE_PROFILE') || 'null');
    if (lp?.pictureUrl) document.getElementById('pfAvatar').src = lp.pictureUrl;
    if (lp?.displayName) document.getElementById('pfName').textContent = lp.displayName;
    if (lp?.userId) document.getElementById('pfSub').textContent = lp.userId;
  } catch(e){ /* ignore */ }

  // ---------- ปุ่ม Theme & Logout สำรอง ----------
  document.getElementById('btnTheme')?.addEventListener('click', () => {
    // ให้ระบบเดิม hook; ถ้าไม่มี ให้แจ้งเตือนเบา ๆ
    const hooked = window.dispatchEvent(new CustomEvent('app:open:theme', {bubbles:true}));
    if (!hooked) toast('เปิดหน้าตั้งค่าธีม/ตัวอักษรจากระบบเดิมไม่สำเร็จ');
  });
  document.getElementById('btnLogout2')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('app:liff:logout'));
  });
  // ปุ่มบนหัวการ์ดยังคงเดิม
  document.getElementById('btnLineLogin')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('app:liff:login')));
  document.getElementById('btnLogout')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('app:liff:logout')));

  // ---------- ค่าระบบ (ปลอดภัย) ----------
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
  document.getElementById('btnReloadSecure').onclick = () => loadSecure().catch(e => toast('โหลดไม่สำเร็จ: '+e.message));
  document.getElementById('btnSaveSecure').onclick   = () => saveSecure().catch(e => toast('บันทึกไม่สำเร็จ: '+e.message));
  await loadSecure();

  // ---------- Lat/Lng + Map ----------
  let lat = 14.000000, lng = 99.000000; // default
  async function loadSchoolLL(){
    const v = await SettingsAPI.get(['SCHOOL_LAT','SCHOOL_LNG']);
    if (v.SCHOOL_LAT != null) lat = Number(v.SCHOOL_LAT);
    if (v.SCHOOL_LNG != null) lng = Number(v.SCHOOL_LNG);
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
  document.getElementById('btnSaveSchoolLL').onclick   = () => saveSchoolLL().catch(e=>toast('บันทึกพิกัดไม่สำเร็จ: '+e.message));
  await loadSchoolLL();

  // ---------- App Links Admin (เฉพาะผู้ดูแล) ----------
  const isAdminUser = await isAdmin();
  const panel = document.getElementById('applinksAdminPanel');
  if (isAdminUser) {
    try {
      // รองรับหลาย signature: renderAdminPanel(id) หรือ render(id) หรือ default(id)
      const mod = await import('./applinks_admin.js');
      if (typeof mod.renderAdminPanel === 'function') {
        await mod.renderAdminPanel('applinksAdminPanel');
      } else if (typeof mod.render === 'function') {
        await mod.render('applinksAdminPanel');
      } else if (typeof mod.default === 'function') {
        await mod.default('applinksAdminPanel');
      } else {
        panel.innerHTML = `<div class="text-sm text-ink3">ไม่พบเมธอดเรนเดอร์ใน applinks_admin.js</div>`;
      }
    } catch (e) {
      console.error('[applinks_admin] load error', e);
      panel.innerHTML = `<div class="text-sm text-red-600">โหลดโมดูล applinks_admin ไม่สำเร็จ: ${e.message}</div>`;
    }
  } else {
    panel.innerHTML = `<div class="text-sm text-ink3">ส่วนนี้สำหรับผู้ดูแลระบบเท่านั้น</div>`;
  }
}

// ============= Helper: ตรวจสิทธิ์ผู้ดูแล =============
export async function isAdmin() {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return false;
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) return false;
  return data?.role === 'admin';
}
