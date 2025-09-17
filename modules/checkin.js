import { supabase } from '../api.js';
import { isAdmin as checkIsAdmin } from './profile_admin.js';
import { SCHOOL_LAT,SCHOOL_LNG,SCHOOL_RADIUS_METERS, CHECKIN_START, CHECKIN_ON_TIME_UNTIL, SUMMARY_DEFAULT_RANGE_DAYS } from '../config.js';
import { toast, skel, openSheet, closeSheet } from '../ui.js';

// === Enhanced State Management ===
const CheckinState = {
  // Core state
  scope: localStorage.getItem('APPWD_CHECKIN_SCOPE') || 'mine',
  lastText: null,
  lastGeo: null,
  
  // Component instances
  map: null,
  meMarker: null,
  scanner: null,
  
  // Loading states
  isLoadingGps: false,
  isLoadingScan: false,
  isCheckingin: false,
  
  // Settings
  geoConfig: {
    lat: SCHOOL_LAT,
    lng: SCHOOL_LNG,
    radius: SCHOOL_RADIUS_METERS
  },
  
  // Methods
  setScope(newScope) {
    this.scope = newScope;
    localStorage.setItem('APPWD_CHECKIN_SCOPE', newScope);
  },
  
  cleanup() {
    this.cleanupMap();
    this.cleanupScanner();
    this.lastText = null;
    this.lastGeo = null;
    this.isLoadingGps = false;
    this.isLoadingScan = false;
    this.isCheckingin = false;
  },
  
  cleanupMap() {
    if (this.map) {
      try {
        this.map.remove();
        this.map = null;
        this.meMarker = null;
      } catch (e) {
        console.warn('Map cleanup error:', e);
      }
    }
  },
  
  async cleanupScanner() {
    if (this.scanner) {
      try {
        await this.scanner.stop();
        await this.scanner.clear();
      } catch (e) {
        console.warn('Scanner cleanup error:', e);
      } finally {
        this.scanner = null;
      }
    }
  }
};

// === Dynamic geo configuration loading ===
async function loadGeoConfig() {
  try {
    const { data } = await supabase.from('settings').select('key,value').in('key',['SCHOOL_LAT','SCHOOL_LNG','SCHOOL_RADIUS_METERS']);
    const map = Object.fromEntries((data||[]).map(r=>[r.key, r.value]));
    
    if (map.SCHOOL_LAT) CheckinState.geoConfig.lat = parseFloat(map.SCHOOL_LAT);
    if (map.SCHOOL_LNG) CheckinState.geoConfig.lng = parseFloat(map.SCHOOL_LNG);
    if (map.SCHOOL_RADIUS_METERS) CheckinState.geoConfig.radius = parseFloat(map.SCHOOL_RADIUS_METERS);
  } catch (e) {
    console.warn('Failed to load geo config:', e);
  }
}

// === Enhanced duplicate check with user feedback ===
async function hasWorkCheckinToday(uid) {
  if (!uid) return false;
  
  const start = new Date(); 
  start.setHours(0,0,0,0);
  const end = new Date(); 
  end.setHours(23,59,59,999);
  
  const { data, error } = await supabase
    .from('checkins')
    .select('id,created_at,status')
    .eq('line_user_id', uid)
    .eq('purpose','work')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', {ascending: false})
    .limit(1);
  
  if (error) return false;
  
  return {
    hasCheckedIn: (data && data.length > 0),
    lastCheckin: data && data.length > 0 ? data[0] : null
  };
}

// === Enhanced UI feedback system ===
function showCheckinStatus(message, type = 'info', duration = 3000) {
  const statusEl = document.getElementById('checkinStatus');
  if (!statusEl) {
    const status = document.createElement('div');
    status.id = 'checkinStatus';
    status.className = 'fixed top-4 left-4 right-4 z-50 p-3 rounded-lg border text-sm font-medium transition-all duration-300 transform -translate-y-full opacity-0';
    document.body.appendChild(status);
  }
  
  const status = document.getElementById('checkinStatus');
  status.textContent = message;
  
  // reset color classes
  status.className = 'fixed top-4 left-4 right-4 z-50 p-3 rounded-lg border text-sm font-medium transition-all duration-300';
  switch(type) {
    case 'success':
      status.classList.add('bg-green-50', 'border-green-200', 'text-green-800');
      break;
    case 'warning':
      status.classList.add('bg-yellow-50', 'border-yellow-200', 'text-yellow-800');
      break;
    case 'error':
      status.classList.add('bg-red-50', 'border-red-200', 'text-red-800');
      break;
    default:
      status.classList.add('bg-blue-50', 'border-blue-200', 'text-blue-800');
  }
  
  // Show
  status.style.transform = 'translateY(0)';
  status.style.opacity = '1';
  
  // Auto hide
  setTimeout(() => {
    status.style.transform = 'translateY(-100%)';
    status.style.opacity = '0';
  }, duration);
}

// === Button state management ===
function updateButtonStates() {
  const profile = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  const isLoggedIn = profile && profile.userId;
  
  const buttons = {
    scan: document.getElementById('btnOpenScanner'),
    checkin: document.getElementById('btnCheckin'),
    refresh: document.getElementById('btnRefreshGeo'),
    gpsOnly: document.getElementById('btnGpsOnly')
  };
  
  Object.values(buttons).forEach(btn => {
    if (!btn) return;
    if (!isLoggedIn) {
      btn.disabled = true;
      btn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      btn.disabled = false;
      btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  });
  
  // Update loading states
  if (buttons.scan) {
    buttons.scan.innerHTML = CheckinState.isLoadingScan ? 
      '<span class="animate-spin">⟳</span> กำลังเปิด...' : 
      'เปิดสแกน QR';
  }
  if (buttons.refresh) {
    buttons.refresh.innerHTML = CheckinState.isLoadingGps ? 
      '<span class="animate-spin">⟳</span> กำลังอ่าน...' : 
      'อ่านพิกัดใหม่';
  }
  if (buttons.checkin) {
    buttons.checkin.innerHTML = CheckinState.isCheckingin ? 
      '<span class="animate-spin">⟳</span> กำลังเช็คอิน...' : 
      'เช็คอิน (GPS)';
  }
  if (buttons.gpsOnly) {
    buttons.gpsOnly.innerHTML = CheckinState.isCheckingin ? 
      '<span class="animate-spin">⟳</span> กำลังเช็คอิน...' : 
      'เช็คอิน';
  }
}

// === Enhanced scope management ===
function parseHashParams() {
  try {
    const h = location.hash || '';
    const q = h.includes('?') ? h.split('?')[1] : '';
    return new URLSearchParams(q);
  } catch (e) { 
    return new URLSearchParams(''); 
  }
}

function setupCheckinFilterBar() {
  const bar = document.getElementById('checkinFilterBar');
  if (!bar) return;
  
  bar.innerHTML = `
    <div class="flex items-center gap-2 flex-wrap">
      <button data-scope="all" class="btn text-sm ${CheckinState.scope==='all'?'btn-prim':''}">
        ทั้งหมด (วันนี้)
      </button>
      <button data-scope="mine" class="btn text-sm ${CheckinState.scope==='mine'?'btn-prim':''}">
        ของฉัน (วันนี้)
      </button>
    </div>
  `;
  
  bar.querySelectorAll('[data-scope]').forEach(btn => {
    btn.onclick = () => {
      const newScope = btn.getAttribute('data-scope');
      CheckinState.setScope(newScope);
      bar.querySelectorAll('[data-scope]').forEach(b => b.classList.remove('btn-prim'));
      btn.classList.add('btn-prim');
      loadToday();
    };
  });
}

// === Enhanced login check with user feedback ===
function ensureLoginForActions() {
  const profile = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  const isLoggedIn = profile && profile.userId;
  updateButtonStates();
  
  const parentCard = document.querySelector('#checkinView .card');
  const existingWarn = document.getElementById('loginWarn');
  
  if (!isLoggedIn && parentCard && !existingWarn) {
    const warn = document.createElement('div');
    warn.id = 'loginWarn';
    warn.className = 'mb-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-800';
    warn.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-yellow-600">⚠️</span>
        <span>กรุณาเข้าสู่ระบบด้วย LINE ก่อนจึงจะเช็คอินได้</span>
      </div>
    `;
    parentCard.insertBefore(warn, parentCard.children[1]);
  } else if (isLoggedIn && existingWarn) {
    existingWarn.remove();
  }
  return isLoggedIn;
}

// === Utility functions ===
function fmtDist(m) { 
  if (m >= 1000) return (m/1000).toFixed(2) + ' km'; 
  return Math.round(m) + ' m'; 
}
function toMinutes(timeStr) { 
  const [h,m] = timeStr.split(':').map(Number); 
  return h*60 + m; 
}
function nowMinutes() { 
  const d = new Date(); 
  return d.getHours()*60 + d.getMinutes(); 
}
function statusFromTime() { 
  const now = nowMinutes();
  const onTime = toMinutes(CHECKIN_ON_TIME_UNTIL); 
  return now <= onTime ? 'on_time' : 'late'; 
}
function purposeLabel(purpose) { 
  const labels = { 'work':'มาทำงาน','meeting':'ประชุม','training':'อบรม','official':'ไปราชการ' };
  return labels[purpose] || 'อื่น ๆ'; 
}
function dist(lat1, lng1, lat2, lng2) { 
  const R = 6371000; const toRad = x => x * Math.PI / 180; 
  const dLat = toRad(lat2 - lat1); const dLng = toRad(lng2 - lng1); 
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2; 
  return 2 * R * Math.asin(Math.sqrt(a)); 
}

// === Export for tab initialization ===
export async function initTabs() {
  document.querySelectorAll('[data-ci-tab]').forEach(b => b.classList.remove('btn-prim'));
  const defaultTab = document.querySelector('[data-ci-tab="work"]');
  if (defaultTab) defaultTab.classList.add('btn-prim');
}

// === Enhanced Map Management ===
function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  CheckinState.cleanupMap();
  try {
    const { lat, lng, radius } = CheckinState.geoConfig;
    CheckinState.map = L.map('map', {
      center: [lat, lng], zoom: 16, zoomControl: true, attributionControl: false
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap contributors'
    }).addTo(CheckinState.map);
    L.circle([lat, lng], { radius: radius, color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.1, weight: 2 }).addTo(CheckinState.map);
    L.marker([lat, lng], {
      icon: L.divIcon({
        html: '<div style="background:#22c55e;width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>',
        className: 'school-marker', iconSize: [20, 20], iconAnchor: [10, 10]
      })
    }).addTo(CheckinState.map).bindPopup('โรงเรียน');
  } catch (error) {
    console.error('Map initialization failed:', error);
    showCheckinStatus('ไม่สามารถโหลดแผนที่ได้', 'error');
  }
}
function updateMeMarker(lat, lng, accuracy = 0) {
  if (!CheckinState.map) return;
  try {
    if (!CheckinState.meMarker) {
      CheckinState.meMarker = L.circleMarker([lat, lng], {
        radius: 8, color: '#2563EB', fillColor: '#60A5FA', fillOpacity: 0.9, weight: 2
      }).addTo(CheckinState.map);
    } else {
      CheckinState.meMarker.setLatLng([lat, lng]);
    }
    CheckinState.meMarker.bindPopup(`ตำแหน่งของฉัน<br><small>ความแม่นยำ: ±${Math.round(accuracy)}m</small>`);
    // Accuracy ring
    if (accuracy > 0) {
      if (!CheckinState._accCircle) {
        CheckinState._accCircle = L.circle([lat, lng], { radius: accuracy, color: '#2563EB', fillColor: '#60A5FA', fillOpacity: 0.08, weight: 1, dashArray: '5, 5' }).addTo(CheckinState.map);
      } else {
        CheckinState._accCircle.setLatLng([lat, lng]).setRadius(accuracy);
      }
    }
    CheckinState.map.panTo([lat, lng]);
  } catch (error) {
    console.warn('Failed to update marker:', error);
  }
}

// === Enhanced GPS Handling with retry ===
function getGeoLocation(outputElement, options = {}) {
  const { showLoading = true, retry = true, retryCount = 0, maxRetries = 2 } = options;
  if (!outputElement) return Promise.reject('No output element');
  if (showLoading) {
    CheckinState.isLoadingGps = true; updateButtonStates();
    outputElement.innerHTML = `<div class="flex items-center gap-2 text-blue-600"><span class="animate-spin">⟳</span> กำลังอ่านตำแหน่ง... (ครั้งที่ ${retryCount + 1})</div>`;
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const error = 'อุปกรณ์ไม่รองรับการอ่านตำแหน่ง';
      outputElement.innerHTML = `<div class="text-red-600">${error}</div>`;
      CheckinState.isLoadingGps = false; updateButtonStates(); return reject(error);
    }
    const timeoutId = setTimeout(() => {
      CheckinState.isLoadingGps = false; updateButtonStates();
      if (retry && retryCount < maxRetries) {
        outputElement.innerHTML = `<div class="text-yellow-600">การอ่านตำแหน่งใช้เวลานาน กำลังลองใหม่...</div>`;
        setTimeout(() => {
          getGeoLocation(outputElement, { ...options, retryCount: retryCount + 1 }).then(resolve).catch(reject);
        }, 1000);
      } else {
        const error = 'การอ่านตำแหน่งใช้เวลานานเกินไป';
        outputElement.innerHTML = `<div class="text-red-600">${error}
          <button onclick="window.retryGps()" class="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded">ลองใหม่</button></div>`;
        reject(error);
      }
    }, 10000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        CheckinState.isLoadingGps = false; updateButtonStates();
        const { latitude, longitude, accuracy } = position.coords;
        CheckinState.lastGeo = { lat: latitude, lng: longitude, accuracy: accuracy || 0, timestamp: Date.now() };
        updateMeMarker(latitude, longitude, accuracy);
        const { lat: schoolLat, lng: schoolLng, radius } = CheckinState.geoConfig;
        const distance = dist(schoolLat, schoolLng, latitude, longitude);
        const isWithinRadius = distance <= radius;
        const statusColor = isWithinRadius ? 'text-green-600' : 'text-red-600';
        const statusText = isWithinRadius ? '(ภายในพื้นที่)' : '(นอกพื้นที่)';
        outputElement.innerHTML = `
          <div class="space-y-2">
            <div class="font-medium">
              ห่างจุดเช็คอิน ~ <span class="font-bold">${fmtDist(distance)}</span> 
              <span class="${statusColor}">${statusText}</span>
            </div>
            <div class="text-xs text-gray-500">
              ตำแหน่ง: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${Math.round(accuracy || 0)}m)
            </div>
            <div class="text-xs text-gray-400">อัปเดตล่าสุด: ${new Date().toLocaleTimeString('th-TH')}</div>
          </div>`;
        resolve({ latitude, longitude, accuracy, distance, isWithinRadius });
      },
      (error) => {
        clearTimeout(timeoutId);
        CheckinState.isLoadingGps = false; updateButtonStates();
        let errorMessage = 'อ่านตำแหน่งไม่สำเร็จ';
        switch(error.code) {
          case error.PERMISSION_DENIED: errorMessage = 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง กรุณาอนุญาตในการตั้งค่าเบราว์เซอร์'; break;
          case error.POSITION_UNAVAILABLE: errorMessage = 'ไม่สามารถระบุตำแหน่งได้ กรุณาตรวจสอบการเชื่อมต่อ GPS'; break;
          case error.TIMEOUT: errorMessage = 'การอ่านตำแหน่งใช้เวลานานเกินไป'; break;
        }
        if (retry && retryCount < maxRetries) {
          outputElement.innerHTML = `<div class="text-yellow-600">${errorMessage} กำลังลองใหม่...</div>`;
          setTimeout(() => {
            getGeoLocation(outputElement, { ...options, retryCount: retryCount + 1 }).then(resolve).catch(reject);
          }, 2000);
        } else {
          outputElement.innerHTML = `<div class="text-red-600">${errorMessage}
            <button onclick="window.retryGps()" class="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded">ลองใหม่</button></div>`;
          reject(errorMessage);
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}
window.retryGps = function() {
  const geoState = document.getElementById('geoState');
  if (geoState) { getGeoLocation(geoState).catch(console.error); }
};

// === Enhanced QR Scanner with better error handling ===
async function openScanner() {
  const panel = document.getElementById('scanPanel');
  const holder = document.getElementById('qrReader');
  if (!panel || !holder) return;
  try {
    CheckinState.isLoadingScan = true; updateButtonStates();
    panel.classList.remove('hide');
    holder.innerHTML = `<div class="p-4 text-center"><div class="animate-spin text-blue-500 mb-2">⟳</div>กำลังเปิดกล้อง...</div>`;
    CheckinState.scanner = new Html5Qrcode('qrReader');
    const devices = await Html5Qrcode.getCameras();
    const backCamera = devices.find(d => (d.label||'').toLowerCase().includes('back')) || devices[0];
    await CheckinState.scanner.start(
      backCamera?.id || { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      (decodedText) => {
        CheckinState.lastText = decodedText;
        const resultEl = document.getElementById('scanResult');
        if (resultEl) {
          resultEl.innerHTML = `<div class="p-2 bg-green-50 border border-green-200 rounded text-green-800">
              <strong>สแกนสำเร็จ:</strong><br><span class="text-xs break-all">${decodedText}</span></div>`;
        }
        showCheckinStatus('สแกน QR สำเร็จ! ✅', 'success');
      },
      (_errorMessage) => { /* ignore continuous scan errors */ }
    );
    CheckinState.isLoadingScan = false; updateButtonStates();
    showCheckinStatus('เปิดกล้องสำเร็จ กรุณานำ QR Code เข้ามาในกรอบ', 'info');
  } catch (error) {
    CheckinState.isLoadingScan = false; updateButtonStates();
    console.error('Scanner error:', error);
    let errorMsg = 'ไม่สามารถเปิดกล้องได้';
    if (error.message?.includes('Permission')) errorMsg = 'ไม่ได้รับอนุญาตให้เข้าถึงกล้อง กรุณาอนุญาต';
    else if (error.message?.includes('NotFound')) errorMsg = 'ไม่พบกล้องในอุปกรณ์นี้';
    holder.innerHTML = `<div class="p-4 text-center text-red-600"><div class="mb-2">📷</div>
        <div class="font-medium">${errorMsg}</div>
        <button onclick="window.retryScanner()" class="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm">ลองใหม่</button></div>`;
    showCheckinStatus(errorMsg, 'error');
  }
}
async function closeScanner() {
  const panel = document.getElementById('scanPanel');
  if (panel) panel.classList.add('hide');
  await CheckinState.cleanupScanner();
  CheckinState.isLoadingScan = false; updateButtonStates();
  const resultEl = document.getElementById('scanResult'); if (resultEl) resultEl.innerHTML = '';
}
window.retryScanner = function() { closeScanner().then(() => { setTimeout(() => openScanner(), 500); }); };

// === Enhanced Checkin Logic with user feedback ===
async function doCheckin(method = 'gps') {
  if (CheckinState.isCheckingin) { showCheckinStatus('กำลังดำเนินการเช็คอิน กรุณารอสักครู่...', 'warning'); return; }
  const profile = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  if (!profile || !profile.userId) { showCheckinStatus('ต้องเข้าสู่ระบบด้วย LINE ก่อน', 'error'); return; }
  if (!CheckinState.lastGeo) {
    showCheckinStatus('ยังไม่ได้ตำแหน่ง กรุณากดอ่านพิกัดใหม่', 'warning');
    const geoState = document.getElementById('geoState'); if (geoState) { await getGeoLocation(geoState).catch(() => {}); }
    return;
  }
  const geoAge = Date.now() - CheckinState.lastGeo.timestamp;
  if (geoAge > 5 * 60 * 1000) {
    showCheckinStatus('ตำแหน่งเก่าเกินไป กำลังอ่านตำแหน่งใหม่...', 'info');
    const geoState = document.getElementById('geoState');
    if (geoState) { await getGeoLocation(geoState).catch(() => {}); if (!CheckinState.lastGeo) return; }
  }
  CheckinState.isCheckingin = true; updateButtonStates();
  const { lat: schoolLat, lng: schoolLng, radius } = CheckinState.geoConfig;
  const distance = dist(schoolLat, schoolLng, CheckinState.lastGeo.lat, CheckinState.lastGeo.lng);
  const within = distance <= radius;
  if (within) {
    const checkResult = await hasWorkCheckinToday(profile.userId);
    if (checkResult && checkResult.hasCheckedIn) {
      CheckinState.isCheckingin = false; updateButtonStates();
      const lastTime = new Date(checkResult.lastCheckin.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      const statusText = checkResult.lastCheckin.status === 'on_time' ? 'ตรงเวลา' : 'สาย';
      openSheet(`<div class='text-center space-y-3'>
          <div class='text-4xl'>✅</div>
          <div class='font-semibold text-lg'>เช็คอินแล้ววันนี้</div>
          <div class='p-3 bg-green-50 border border-green-200 rounded-lg text-sm'>
            <div><strong>เวลา:</strong> ${lastTime}</div>
            <div><strong>สถานะ:</strong> ${statusText}</div>
          </div>
          <div class='text-sm text-gray-600'>ไม่สามารถเช็คอินซ้ำในวันเดียวกันได้</div>
          <button id='okDupe' class='btn btn-prim w-full'>รับทราบ</button>
        </div>`);
      document.getElementById('okDupe').onclick = closeSheet;
      showCheckinStatus('วันนี้เช็คอินแล้ว ไม่สามารถเช็คอินซ้ำได้', 'warning');
      return;
    }
  }
  let purpose = 'work';
  let note = method.includes('qr') ? CheckinState.lastText : null;
  if (!within) { CheckinState.isCheckingin = false; updateButtonStates(); await showOffsiteCheckinDialog(distance); return; }
  await saveCheckin({ method, within, purpose, note, distance, profile });
}

// === Offsite checkin dialog ===
async function showOffsiteCheckinDialog(distance) {
  return new Promise((resolve) => {
    openSheet(`<div class='space-y-4'>
        <div class='text-center'><div class='text-4xl mb-2'>📍</div>
          <div class='font-semibold text-lg'>อยู่นอกเขตโรงเรียน</div>
          <div class='text-sm text-gray-600'>ห่างจุดเช็คอิน ${fmtDist(distance)}</div>
        </div>
        <div class='space-y-3'>
          <div class='font-medium'>เลือกเหตุผล:</div>
          <label class='flex items-center gap-3 p-2 border rounded cursor-pointer hover:bg-gray-50'><input type='radio' name='offsite_purpose' value='meeting'> <span>ประชุม</span></label>
          <label class='flex items-center gap-3 p-2 border rounded cursor-pointer hover:bg-gray-50'><input type='radio' name='offsite_purpose' value='training'> <span>อบรม</span></label>
          <label class='flex items-center gap-3 p-2 border rounded cursor-pointer hover:bg-gray-50'><input type='radio' name='offsite_purpose' value='official'> <span>ไปราชการ</span></label>
          <input id='offsiteNote' class='w-full p-2 border rounded' placeholder='รายละเอียด เช่น สถานที่ หรือหน่วยงาน (จำเป็น)'>
          <div class='grid grid-cols-2 gap-3'>
            <button id='cancelOffsite' class='btn'>ยกเลิก</button>
            <button id='confirmOffsite' class='btn btn-prim'>บันทึก</button>
          </div>
        </div>`);
    document.getElementById('cancelOffsite').onclick = () => {
      closeSheet(); CheckinState.isCheckingin = false; updateButtonStates(); resolve(false);
    };
    document.getElementById('confirmOffsite').onclick = async () => {
      const selectedPurpose = document.querySelector('input[name="offsite_purpose"]:checked');
      const noteText = document.getElementById('offsiteNote').value.trim();
      if (!selectedPurpose) { showCheckinStatus('กรุณาเลือกเหตุผล', 'warning'); return; }
      if (!noteText) { showCheckinStatus('กรุณาระบุรายละเอียด', 'warning'); return; }
      closeSheet(); CheckinState.isCheckingin = true; updateButtonStates();
      const profile = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
      const { lat: schoolLat, lng: schoolLng } = CheckinState.geoConfig;
      const distance = dist(schoolLat, schoolLng, CheckinState.lastGeo.lat, CheckinState.lastGeo.lng);
      await saveCheckin({ method: 'gps', within: false, purpose: selectedPurpose.value, note: noteText, distance, profile });
      resolve(true);
    };
  });
}

// === Enhanced save checkin with detailed feedback ===
async function saveCheckin({ method, within, purpose, note, distance, profile }) {
  try {
    const status = within ? statusFromTime() : 'offsite';
    const payload = {
      line_user_id: profile?.userId || null,
      line_display_name: profile?.displayName || null,
      line_picture_url: profile?.pictureUrl || null,
      method, purpose, status, note,
      lat: Number(CheckinState.lastGeo.lat) || null,
      lng: Number(CheckinState.lastGeo.lng) || null,
      accuracy: Number(CheckinState.lastGeo.accuracy) || 0,
      distance_m: Math.round(distance || 0),
      within_radius: !!within
    };
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined || (typeof payload[key] === 'number' && !isFinite(payload[key]))) delete payload[key];
    });
    const result = await supabase.from('checkins').insert(payload).select('id,created_at').single();
    if (result.error) throw result.error;
    CheckinState.isCheckingin = false; updateButtonStates();
    const checkinTime = new Date(result.data.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    showSuccessCheckinDialog({
      time: checkinTime, purpose: purposeLabel(purpose), distance: fmtDist(distance), within, status
    });
    showCheckinStatus(within ? `เช็คอินสำเร็จ เวลา ${checkinTime}` : `บันทึกภารกิจนอกสถานที่สำเร็จ เวลา ${checkinTime}`, 'success');
    await loadToday(); await renderSummary();
    document.dispatchEvent(new CustomEvent('appwd:checkinSaved', { detail: { checkinId: result.data.id, payload } }));
  } catch (error) {
    console.error('Checkin save error:', error);
    CheckinState.isCheckingin = false; updateButtonStates();
    let errorMessage = 'เช็คอินไม่สำเร็จ';
    if (error.message?.includes('duplicate')) errorMessage = 'พบการเช็คอินซ้ำ';
    else if (error.message?.includes('network')) errorMessage = 'ปัญหาการเชื่อมต่อ กรุณาลองใหม่';
    showCheckinStatus(errorMessage, 'error');
  }
}

// === Success dialog ===
function showSuccessCheckinDialog({ time, purpose, distance, within, status }) {
  const statusIcon = within ? '✅' : '📍';
  const statusText = within ? (status === 'on_time' ? 'ตรงเวลา' : 'สาย') : 'นอกสถานที่';
  const statusColor = within ? (status === 'on_time' ? 'text-green-600' : 'text-yellow-600') : 'text-blue-600';
  openSheet(`<div class='text-center space-y-4'>
      <div class='text-5xl'>${statusIcon}</div>
      <div class='font-semibold text-xl'>เช็คอินสำเร็จ!</div>
      <div class='space-y-2 p-4 bg-gray-50 rounded-lg text-sm'>
        <div class='grid grid-cols-2 gap-2'>
          <div class='text-gray-600'>เวลา:</div><div class='font-medium'>${time}</div>
          <div class='text-gray-600'>ประเภท:</div><div class='font-medium'>${purpose}</div>
          <div class='text-gray-600'>ระยะห่าง:</div><div class='font-medium'>${distance}</div>
          <div class='text-gray-600'>สถานะ:</div><div class='font-medium ${statusColor}'>${statusText}</div>
        </div>
      </div>
      <div class='text-xs text-gray-500'>ขอบคุณที่ใช้ระบบเช็คอิน</div>
      <button id='okSuccess' class='btn btn-prim w-full'>เสร็จสิ้น</button>
    </div>`);
  document.getElementById('okSuccess').onclick = closeSheet;
}

// === Main render function ===
export async function render() {
  try {
    await loadGeoConfig();
    try { const params = parseHashParams(); if (params.get('all') === 'today') { CheckinState.setScope('all'); } } catch (e) { console.warn('Failed to parse hash params:', e); }
    ensureLoginForActions();
    setupCheckinFilterBar();
    setupButtonHandlers();
    initMap();
    const geoState = document.getElementById('geoState');
    if (geoState) { getGeoLocation(geoState, { showLoading: true }).catch(() => {}); }
    await loadToday();
    await renderSummary();
  } catch (error) {
    console.error('Render failed:', error);
    showCheckinStatus('ไม่สามารถโหลดหน้าเช็คอินได้', 'error');
  }
}

// === Button handlers setup ===
function setupButtonHandlers() {
  const buttons = {
    btnOpenScanner: document.getElementById('btnOpenScanner'),
    btnCloseScanner: document.getElementById('btnCloseScanner'),
    btnRefreshGeo: document.getElementById('btnRefreshGeo'),
    btnGpsOnly: document.getElementById('btnGpsOnly'),
    btnCheckin: document.getElementById('btnCheckin')
  };
  Object.values(buttons).forEach(btn => { if (btn) btn.replaceWith(btn.cloneNode(true)); });
  const cleanButtons = {
    btnOpenScanner: document.getElementById('btnOpenScanner'),
    btnCloseScanner: document.getElementById('btnCloseScanner'),
    btnRefreshGeo: document.getElementById('btnRefreshGeo'),
    btnGpsOnly: document.getElementById('btnGpsOnly'),
    btnCheckin: document.getElementById('btnCheckin')
  };
  if (cleanButtons.btnOpenScanner) cleanButtons.btnOpenScanner.onclick = () => openScanner();
  if (cleanButtons.btnCloseScanner) cleanButtons.btnCloseScanner.onclick = () => closeScanner();
  if (cleanButtons.btnRefreshGeo) cleanButtons.btnRefreshGeo.onclick = () => {
    const geoState = document.getElementById('geoState'); if (geoState) getGeoLocation(geoState, { retry: true }).catch(console.error);
  };
  if (cleanButtons.btnGpsOnly) cleanButtons.btnGpsOnly.onclick = () => doCheckin('gps');
  if (cleanButtons.btnCheckin) cleanButtons.btnCheckin.onclick = () => doCheckin('gps');
}

// === Enhanced home recent checkins ===
// === แก้ไข renderHomeRecent ให้ใช้ badge ที่ดีกว่า ===
export async function renderHomeRecent(kind) {
  const box = document.getElementById('homeCheckins'); 
  if (!box) return;
  
  box.innerHTML = skel(5, '52px');
  const start = new Date(); 
  start.setHours(0,0,0,0);
  const end = new Date(); 
  end.setHours(23,59,59,999);
  
  try {
    let query = supabase
      .from('checkins')
      .select('id,line_display_name,line_picture_url,created_at,distance_m,within_radius,purpose,status')
      .gte('created_at', start.toISOString())
      .lt('created_at', new Date(end.getTime()+1).toISOString())
      .order('created_at', {ascending: false})
      .limit(5);
    
    query = (kind && kind !== 'work') ? query.eq('purpose', kind) : query.eq('purpose', 'work');
    const { data, error } = await query;
    
    if (error) { 
      console.error('Failed to load recent checkins:', error); 
      box.innerHTML = '<div class="text-ink3">โหลดเช็คอินไม่สำเร็จ</div>'; 
      return; 
    }
    
    document.querySelectorAll('[data-ci-tab]').forEach(b => 
      b.classList.toggle('btn-prim', b.getAttribute('data-ci-tab') === (kind || 'work'))
    );
    
    if (!data || data.length === 0) { 
      box.innerHTML = '<div class="text-ink3">ยังไม่มีรายการ</div>'; 
      return; 
    }
    
    box.innerHTML = data.map(record => {
      const time = new Date(record.created_at).toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      let statusBadge = '';
      if (record.status === 'on_time') {
        statusBadge = '<span class="status-badge badge-ontime">ตรงเวลา</span>';
      } else if (record.status === 'late') {
        statusBadge = '<span class="status-badge badge-late">สาย</span>';
      } else if (record.status === 'offsite') {
        statusBadge = '<span class="status-badge badge-offsite">นอกพื้นที่</span>';
      }
      
      const distanceColor = record.within_radius ? 'text-green-600' : 'text-red-600';
      
      return `
        <div class='card p-3 flex items-center gap-3 hover:shadow-md transition-shadow'>
          <img src='${record.line_picture_url || '/assets/default-avatar.png'}' 
               class='w-10 h-10 rounded-full border object-cover' 
               onerror="this.src='/assets/default-avatar.png'"
               loading="lazy">
          <div class='flex-1 min-w-0'>
            <div class='font-medium truncate'>${record.line_display_name || 'ไม่ระบุ'}</div>
            <div class='text-sm text-ink3 flex items-center gap-2 flex-wrap'>
              <span>${time}</span>
              <span>•</span>
              <span>${purposeLabel(record.purpose)}</span>
              ${statusBadge}
            </div>
          </div>
          <div class='text-sm ${distanceColor} font-medium'>
            ${fmtDist(record.distance_m || 0)}
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error rendering home recent:', error);
    box.innerHTML = '<div class="text-red-600">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
  }
}

// === Enhanced home summary ===
export async function renderHomeSummary() {
  const box = document.getElementById('homeSummary'); if (!box) return;
  box.innerHTML = skel(4, '64px');
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(); end.setHours(23,59,59,999);
  try {
    const purposes = ['work', 'meeting', 'training', 'official'];
    const counts = { work: 0, meeting: 0, training: 0, official: 0 };
    await Promise.all(purposes.map(async (purpose) => {
      const { count, error } = await supabase.from('checkins')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', start.toISOString())
        .lt('created_at', new Date(end.getTime()+1).toISOString())
        .eq('purpose', purpose);
      if (!error) counts[purpose] = count || 0;
    }));
    const createTile = (label, value, color = 'text-blue-600') => `
      <div class='card p-4 text-center hover:shadow-md transition-shadow'>
        <div class='text-2xl font-bold ${color} mb-1'>${value}</div>
        <div class='text-sm text-ink3'>${label}</div>
      </div>`;
    box.innerHTML = [
      createTile('มาทำงาน', counts.work, 'text-green-600'),
      createTile('ประชุม', counts.meeting, 'text-blue-600'),
      createTile('อบรม', counts.training, 'text-purple-600'),
      createTile('ไปราชการ', counts.official, 'text-orange-600')
    ].join('');
  } catch (error) {
    console.error('Error rendering home summary:', error);
    box.innerHTML = '<div class="text-red-600 col-span-4">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
  }
}

// === Enhanced today list with better mobile support ===
async function loadToday() {
  const profile = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  const box = document.getElementById('todayList'); 
  if (!box) return;
  
  box.innerHTML = skel(3, '60px');
  
  if (!profile || !profile.userId) { 
    box.innerHTML = '<div class="text-ink3 text-center py-4">ยังไม่เข้าสู่ระบบ</div>'; 
    return; 
  }
  
  const start = new Date(); 
  start.setHours(0,0,0,0);
  const end = new Date(); 
  end.setHours(23,59,59,999);
  
  try {
    const admin = await checkIsAdmin();
    
    let query = supabase
      .from('checkins')
      .select('*')
      .gte('created_at', start.toISOString())
      .lt('created_at', new Date(end.getTime()+1).toISOString());
    
    if (CheckinState.scope === 'mine' && profile.userId) { 
      query = query.eq('line_user_id', profile.userId); 
    }
    
    const { data, error } = await query
      .order('created_at', {ascending: false})
      .limit(200);
    
    if (error) { 
      console.error('Failed to load today list:', error); 
      box.innerHTML = '<div class="text-red-600 text-center py-4">โหลดข้อมูลไม่สำเร็จ</div>'; 
      return; 
    }
    
    if (!data || data.length === 0) { 
      box.innerHTML = '<div class="text-ink3 text-center py-4">ยังไม่มีรายการวันนี้</div>'; 
      return; 
    }
    
    box.innerHTML = data.map(record => {
      const time = new Date(record.created_at).toLocaleTimeString('th-TH', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      const canEdit = (admin || (!record.within_radius && record.purpose !== 'work' && 
                       profile?.userId && record.line_user_id === profile.userId));
      
      // ปุ่มแก้ไข - ปรับให้ responsive และใช้งานได้ดีในหน้าจอเล็ก
      const editBtn = canEdit ? `
        <button class='edit-btn btn-sm px-2 py-1 text-xs bg-blue-500 text-white rounded border-0 hover:bg-blue-600 transition-colors' 
                style='min-width: 50px; font-size: 11px; white-space: nowrap;'
                onclick='editOffsite(${record.id}, "${record.purpose||''}", ${JSON.stringify(record.note||'').replace(/"/g,'&quot;')})'>
          แก้ไข
        </button>
      ` : '';
      
      const delBtn = admin ? `
        <button class='delete-btn btn-sm px-2 py-1 text-xs bg-red-500 text-white rounded border-0 hover:bg-red-600 transition-colors' 
                style='min-width: 40px; font-size: 11px; white-space: nowrap;'
                onclick='deleteCheckin(${record.id})'>
          ลบ
        </button>
      ` : '';
      
      // Badge ที่แสดงผลดีกว่า - แยกแต่ละ status ชัดเจน
      let statusBadge = '';
      if (record.status === 'on_time') {
        statusBadge = '<span class="status-badge badge-ontime">ตรงเวลา</span>';
      } else if (record.status === 'late') {
        statusBadge = '<span class="status-badge badge-late">สาย</span>';
      } else if (record.status === 'offsite') {
        statusBadge = '<span class="status-badge badge-offsite">นอกพื้นที่</span>';
      }
      
      const distanceColor = record.within_radius ? 'text-green-600' : 'text-red-600';
      
      return `
        <div class='checkin-card card p-3 mb-2 border rounded-lg bg-white'>
          <!-- Header Row -->
          <div class='flex items-center gap-3 mb-2'>
            <img src='${record.line_picture_url || "/assets/default-avatar.png"}' 
                 class='w-10 h-10 rounded-full border-2 object-cover flex-shrink-0' 
                 onerror="this.src='/assets/default-avatar.png'"
                 loading="lazy">
            
            <div class='flex-1 min-w-0'>
              <div class='font-medium text-sm truncate text-gray-900'>
                ${record.line_display_name || 'ไม่ระบุ'}
              </div>
              <div class='text-xs text-gray-500 truncate'>
                ${time} • ${purposeLabel(record.purpose)}${record.note ? ' • ' + record.note : ''}
              </div>
            </div>
            
            <div class='text-xs ${distanceColor} font-semibold flex-shrink-0'>
              ${fmtDist(record.distance_m || 0)}
            </div>
          </div>
          
          <!-- Status and Actions Row -->
          <div class='flex items-center justify-between gap-2'>
            <div class='status-container flex items-center flex-wrap gap-1'>
              ${statusBadge}
            </div>
            
            <div class='actions-container flex items-center gap-1 flex-shrink-0'>
              ${editBtn}
              ${delBtn}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading today list:', error);
    box.innerHTML = '<div class="text-red-600 text-center py-4">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
  }
}

// === Enhanced Summary with responsive design (positive tone + 3 cols on large) ===
async function renderSummary() {
  const box = document.getElementById('checkinSummary'); 
  if (!box) return;

  // skeleton สูงขึ้นนิดให้พอดีการ์ดใหญ่
  box.innerHTML = skel(6, '120px');

  const profile = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  const now = new Date();

  const weekStart  = new Date(now); 
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); 
  weekStart.setHours(0,0,0,0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart  = new Date(now.getFullYear(), 0, 1);

  try {
    // helper: ดึงสถิติตามช่วงและ scope
    async function getCheckinStats(since, scope = 'org') {
      let q = supabase.from('checkins')
        .select('purpose,status,line_user_id,created_at')
        .gte('created_at', since.toISOString())
        .lte('created_at', now.toISOString());

      if (scope === 'me' && profile?.userId) {
        q = q.eq('line_user_id', profile.userId);
      }

      const { data, error } = await q;
      const s = { work:0, meeting:0, training:0, official:0, ontime:0, late:0, total:0 };
      if (!error && data) {
        data.forEach(r => {
          s.total++;
          if (r.purpose && Object.prototype.hasOwnProperty.call(s, r.purpose)) s[r.purpose]++;
          if (r.purpose === 'work') {
            if (r.status === 'on_time') s.ontime++;
            else if (r.status === 'late') s.late++;
          }
        });
      }
      return s;
    }

    const [meWeek, meMonth, meYear, orgWeek, orgMonth, orgYear] = await Promise.all([
      getCheckinStats(weekStart, 'me'),
      getCheckinStats(monthStart, 'me'),
      getCheckinStats(yearStart, 'me'),
      getCheckinStats(weekStart, 'org'),
      getCheckinStats(monthStart, 'org'),
      getCheckinStats(yearStart, 'org'),
    ]);

    // รูปแบบการ์ด: สูงเท่ากัน (flex column + mt-auto ที่ส่วนสรุปรวม)
    function createSummaryCard(title, stats, type='personal') {
      const cardColor  = type==='personal' ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50';
      const titleColor = type==='personal' ? 'text-blue-800' : 'text-green-800';
      return `
        <div class="summary-card card p-4 ${cardColor} hover:shadow-lg transition-all duration-200 h-full flex flex-col">
          <div class="text-sm font-semibold mb-3 ${titleColor}">${title}</div>

          <div class="summary-stats grid grid-cols-2 gap-3 text-sm">
            <div class="summary-stat-row"><span class="text-gray-600">มาทำงาน</span><span class="font-semibold text-green-700">${stats.work||0}</span></div>
            <div class="summary-stat-row"><span class="text-gray-600">ประชุม</span><span class="font-semibold text-blue-700">${stats.meeting||0}</span></div>
            <div class="summary-stat-row"><span class="text-gray-600">อบรม</span><span class="font-semibold text-purple-700">${stats.training||0}</span></div>
            <div class="summary-stat-row"><span class="text-gray-600">ไปราชการ</span><span class="font-semibold text-orange-700">${stats.official||0}</span></div>
          </div>

          <div class="mt-auto pt-3 border-t border-gray-200">
            <div class="flex justify-between text-xs text-gray-500">
              <span>รวมทั้งหมด</span><span class="font-semibold">${stats.total||0} ครั้ง</span>
            </div>
          </div>
        </div>
      `;
    }

    // กล่องเสริมแรงเชิงบวก (เดือนนี้)
    const totalWorkDays = (meMonth.ontime||0) + (meMonth.late||0);
    let encouragementSection = '';
    if (totalWorkDays >= 0) {
      const pct = totalWorkDays ? Math.round((meMonth.ontime||0) * 100 / totalWorkDays) : 0;

      let message = '';
      let bgColor = 'bg-blue-50', textColor = 'text-blue-800';
      if (totalWorkDays === 0) {
        message = 'มาเริ่มเดือนนี้ด้วยเช็คอินครั้งแรกกันเลย! ทุกก้าวเล็ก ๆ มีความหมาย 💙';
      } else if (pct >= 90) {
        message = 'ยอดเยี่ยมมาก! ความสม่ำเสมอของคุณคือแรงบันดาลใจให้ทีม 🌟';
        bgColor='bg-green-50'; textColor='text-green-800';
      } else if (pct >= 75) {
        message = 'ดีมาก! กำลังไปได้สวย รักษาความสม่ำเสมอไว้นะ ✨';
      } else if (pct >= 50) {
        message = 'กำลังพัฒนา! ลองตั้งแจ้งเตือนหรือเตรียมตัวล่วงหน้าสักนิด เพื่อให้ดียิ่งขึ้น 💪';
        bgColor='bg-yellow-50'; textColor='text-yellow-800';
      } else {
        message = 'เริ่มต้นใหม่ได้เสมอ วันนี้คือโอกาสที่ดีในการสร้างนิสัยตรงเวลา 😊';
        bgColor='bg-indigo-50'; textColor='text-indigo-800';
      }

      encouragementSection = `
        <div class="card p-4 mt-4 ${bgColor} border-l-4 border-current">
          <div class="font-semibold mb-2 ${textColor}">สถิติการมาทำงานเดือนนี้</div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
            <div class="text-center"><div class="text-2xl font-bold text-green-600">${meMonth.ontime||0}</div><div class="text-gray-600">ตรงเวลา</div></div>
            <div class="text-center"><div class="text-2xl font-bold text-yellow-600">${meMonth.late||0}</div><div class="text-gray-600">มาสาย</div></div>
            <div class="text-center"><div class="text-2xl font-bold text-blue-600">${totalWorkDays}</div><div class="text-gray-600">รวม</div></div>
            <div class="text-center"><div class="text-2xl font-bold ${pct>=75?'text-green-600':'text-yellow-600'}">${pct}%</div><div class="text-gray-600">ตรงเวลา</div></div>
          </div>
          <div class="text-sm ${textColor}">${message}</div>
        </div>
      `;
    }

    // Layout ใหม่: จำกัดความกว้าง + 3 คอลัมน์จริงบนจอใหญ่
    box.innerHTML = `
      <div class="summary-wrap mx-auto px-3 md:px-6 lg:px-8">
        <div class="space-y-8 max-w-screen-2xl mx-auto">
          <section>
            <h3 class="text-lg font-semibold text-blue-800 border-b border-blue-200 pb-2 mb-3">📊 สถิติของฉัน</h3>
            <div class="summary-grid grid gap-4">
              ${createSummaryCard('สัปดาห์นี้', meWeek,  'personal')}
              ${createSummaryCard('เดือนนี้',   meMonth, 'personal')}
              ${createSummaryCard('ปีนี้',      meYear,  'personal')}
            </div>
          </section>

          <section>
            <h3 class="text-lg font-semibold text-green-800 border-b border-green-200 pb-2 mb-3">🏢 สถิติองค์กร</h3>
            <div class="summary-grid grid gap-4">
              ${createSummaryCard('สัปดาห์นี้', orgWeek,  'organization')}
              ${createSummaryCard('เดือนนี้',   orgMonth, 'organization')}
              ${createSummaryCard('ปีนี้',      orgYear,  'organization')}
            </div>
          </section>

          ${encouragementSection}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error rendering summary:', error);
    box.innerHTML = `
      <div class="card p-6 text-center text-red-600">
        <div class="text-4xl mb-2">⚠️</div>
        <div class="font-medium mb-2">ไม่สามารถโหลดสรุปผลได้</div>
        <div class="text-sm text-gray-600">กรุณาลองใหม่อีกครั้ง</div>
        <button onclick="window.reloadSummary()" class="mt-3 btn btn-prim">โหลดใหม่</button>
      </div>
    `;
  }
}


// === Global functions for edit/delete operations ===
window.editOffsite = function(id, purpose, note) {
  openSheet(`<div class='space-y-4'>
      <div class='text-center'><div class='text-2xl mb-2'>✏️</div>
        <div class='font-semibold text-lg'>แก้ไขภารกิจนอกสถานที่</div><div class='text-sm text-gray-600'>วันนี้เท่านั้น</div>
      </div>
      <div class='space-y-3'>
        <div class='font-medium'>เลือกประเภทภารกิจ:</div>
        <div class='space-y-2'>
          <label class='flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors'><input type='radio' name='edit_purpose' value='meeting' ${purpose==='meeting'?'checked':''}> 
            <div><div class='font-medium'>ประชุม</div><div class='text-xs text-gray-500'>ประชุมภายในหรือภายนอกหน่วยงาน</div></div></label>
          <label class='flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors'><input type='radio' name='edit_purpose' value='training' ${purpose==='training'?'checked':''}> 
            <div><div class='font-medium'>อบรม</div><div class='text-xs text-gray-500'>เข้าร่วมการอบรมหรือสัมมนา</div></div></label>
          <label class='flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors'><input type='radio' name='edit_purpose' value='official' ${purpose==='official'?'checked':''}> 
            <div><div class='font-medium'>ไปราชการ</div><div class='text-xs text-gray-500'>ภารกิจอื่น ๆ ของทางราชการ</div></div></label>
        </div>
        <div><label class='block font-medium mb-2'>รายละเอียด:</label>
          <textarea id='editOffsiteNote' class='w-full p-3 border rounded-lg resize-none' rows='3' placeholder='ระบุสถานที่ หน่วยงาน หรือรายละเอียดเพิ่มเติม'>${note || ''}</textarea>
        </div>
        <div class='text-xs text-gray-500 p-2 bg-gray-50 rounded'>* ไม่สามารถแก้ไขเวลาเช็คอินได้ • * เฉพาะภารกิจนอกพื้นที่</div>
        <div class='grid grid-cols-2 gap-3 pt-2'><button id='cancelEditOffsite' class='btn'>ยกเลิก</button><button id='confirmEditOffsite' class='btn btn-prim'>บันทึก</button></div>
      </div></div>`);
  document.getElementById('cancelEditOffsite').onclick = closeSheet;
  document.getElementById('confirmEditOffsite').onclick = async () => {
    const selectedPurpose = document.querySelector('input[name="edit_purpose"]:checked');
    const noteText = document.getElementById('editOffsiteNote').value.trim();
    if (!selectedPurpose) { showCheckinStatus('กรุณาเลือกประเภทภารกิจ', 'warning'); return; }
    if (!noteText) { showCheckinStatus('กรุณาระบุรายละเอียด', 'warning'); return; }
    try {
      const updateData = { purpose: selectedPurpose.value, note: noteText, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('checkins').update(updateData).eq('id', id);
      if (error) throw error;
      closeSheet(); showCheckinStatus('อัปเดตข้อมูลสำเร็จ ✅', 'success'); await loadToday();
    } catch (error) {
      console.error('Update failed:', error); showCheckinStatus('บันทึกไม่สำเร็จ กรุณาลองใหม่', 'error');
    }
  };
};
window.deleteCheckin = function(id) {
  openSheet(`<div class='text-center space-y-4'>
      <div class='text-4xl text-red-500'>🗑️</div>
      <div class='font-semibold text-lg'>ยืนยันการลบเช็คอิน</div>
      <div class='text-sm text-gray-600'>การลบจะไม่สามารถยกเลิกได้ คุณแน่ใจหรือไม่?</div>
      <div class='grid grid-cols-2 gap-3 pt-2'><button id='cancelDelete' class='btn'>ยกเลิก</button>
        <button id='confirmDelete' class='btn bg-red-500 text-white border-red-500 hover:bg-red-600'>ลบเลย</button></div></div>`);
  document.getElementById('cancelDelete').onclick = closeSheet;
  document.getElementById('confirmDelete').onclick = async () => {
    try {
      const { error } = await supabase.from('checkins').delete().eq('id', id);
      if (error) throw error;
      closeSheet(); showCheckinStatus('ลบเช็คอินสำเร็จ', 'success'); await loadToday();
    } catch (error) {
      console.error('Delete failed:', error); showCheckinStatus('ลบไม่สำเร็จ กรุณาลองใหม่', 'error');
    }
  };
};

// Global reload functions
window.reloadSummary = function() { renderSummary().catch(console.error); };

// === Cleanup when leaving checkin view ===
export function cleanup() {
  CheckinState.cleanup();
  const statusEl = document.getElementById('checkinStatus'); if (statusEl) statusEl.remove();
  delete window.retryGps; delete window.retryScanner; delete window.editOffsite; delete window.deleteCheckin; delete window.reloadSummary;
}

// === Auto cleanup on page navigation ===
window.addEventListener('beforeunload', cleanup);
window.addEventListener('hashchange', () => { if (!location.hash.includes('checkin')) { cleanup(); } });

// === Enhanced mobile slider for latest checkins ===
function applyCheckinLatestSlider() {
  try {
    const box = document.getElementById('checkinLatest');
    if (!box) return;
    const isSmall = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
    box.classList.toggle('slider', isSmall);
    if (isSmall) { box.classList.add('slider-x'); } else { box.classList.remove('slider-x'); }
  } catch (e) { console.warn('Slider application failed:', e); }
}
window.addEventListener('resize', applyCheckinLatestSlider);
document.addEventListener('DOMContentLoaded', applyCheckinLatestSlider);
document.addEventListener('appwd:checkinSaved', applyCheckinLatestSlider);

// === แก้ไข CSS สำหรับ responsive และ badge ===
// === แก้ไข CSS สำหรับ responsive/badge/summary (FULL) ===
(function injectFixedStyles() {
  try {
    // ลบ style เก่าที่เคยฉีด
    const existingStyles = document.querySelectorAll('#checkin-enhanced-styles, #checkin-fixed-styles');
    existingStyles.forEach(style => style.remove());

    const style = document.createElement('style');
    style.id = 'checkin-fixed-styles';
    style.textContent = `
      /* === Checkin Card Responsive Styles === */
      .checkin-card {
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        transition: box-shadow 0.2s ease;
        animation: fadeIn 0.3s ease-in-out;
      }
      .checkin-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }

      /* === Status Badge Styles === */
      .status-badge {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        padding: 2px 8px !important;
        border-radius: 12px !important;
        font-size: 10px !important;
        font-weight: 600 !important;
        line-height: 1.2 !important;
        white-space: nowrap;
        border: 1px solid;
        min-height: 20px;
      }
      .status-badge.badge-ontime { background-color:#dcfce7!important; color:#15803d!important; border-color:#86efac!important; }
      .status-badge.badge-late   { background-color:#fef3c7!important; color:#a16207!important; border-color:#fde047!important; }
      .status-badge.badge-offsite{ background-color:#e0e7ff!important; color:#4338ca!important; border-color:#a5b4fc!important; }

      /* === Buttons === */
      .edit-btn, .delete-btn {
        display:inline-flex!important; align-items:center; justify-content:center;
        border:none!important; border-radius:6px!important; cursor:pointer;
        transition:all .2s ease; font-weight:500!important; text-align:center; min-height:24px;
        position:relative; z-index:10; pointer-events:auto;
      }
      .edit-btn:hover   { transform: translateY(-1px); box-shadow:0 4px 8px rgba(59,130,246,.3); }
      .delete-btn:hover { transform: translateY(-1px); box-shadow:0 4px 8px rgba(239,68,68,.3); }
      .edit-btn:active, .delete-btn:active { transform: translateY(0); }

      /* === Containers === */
      .status-container { flex:1; display:flex; align-items:center; overflow:hidden; }
      .actions-container{ flex-shrink:0; display:flex; align-items:center; gap:4px; }

      /* === Mobile tweaks === */
      @media (max-width:480px){
        .checkin-card{ padding:12px!important; margin-bottom:8px!important; }
        .checkin-card .flex.items-center.gap-3{ gap:8px!important; }
        .status-badge{ font-size:9px!important; padding:1px 6px!important; min-height:18px!important; }
        .edit-btn,.delete-btn{ font-size:10px!important; min-width:40px!important; min-height:22px!important; padding:1px 6px!important; }
        .actions-container{ gap:3px!important; }
        .checkin-card .flex.items-center.justify-between{ flex-direction:column; align-items:stretch; gap:8px; }
        .status-container{ justify-content:flex-start; }
        .actions-container{ justify-content:flex-end; flex-shrink:0; }
      }
      @media (max-width:360px){
        .checkin-card{ padding:10px!important; }
        .checkin-card .w-10.h-10{ width:32px!important; height:32px!important; }
        .status-badge{ font-size:8px!important; padding:1px 4px!important; min-height:16px!important; }
        .edit-btn,.delete-btn{ font-size:9px!important; min-width:35px!important; min-height:20px!important; }
      }

      /* === Animations === */
      @keyframes fadeIn{ from{opacity:0; transform:translateY(10px);} to{opacity:1; transform:translateY(0);} }
      @keyframes spin{ from{transform:rotate(0);} to{transform:rotate(360deg);} }
      .animate-spin{ animation:spin 1s linear infinite; }

      /* === Map & QR === */
      #map{ position:relative; border-radius:14px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,.08); z-index:1; }
      .leaflet-container{ z-index:1!important; }
      #qrReader{ border-radius:14px; overflow:hidden; }
      #qrReader canvas, #qrReader video{ border-radius:14px!important; }

      /* === Touch targets === */
      @media (pointer:coarse){
        .edit-btn,.delete-btn{ min-height:32px!important; min-width:48px!important; touch-action:manipulation; }
      }

      /* === Summary (Large screen friendly) === */
      .summary-wrap{ max-width:1440px; }                    /* กัน ultrawide กว้างเกิน */
      .summary-grid{ grid-template-columns:repeat(1,minmax(0,1fr)); }
      @media (min-width:768px){  .summary-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); } }
      @media (min-width:1280px){ .summary-grid{ grid-template-columns:repeat(3,minmax(0,1fr)); } }
      .summary-card{ min-height:190px; }                    /* การ์ดสูงใกล้เคียงกัน */
      .summary-stats{ row-gap:.75rem; }
      .summary-stat-row{ display:flex; justify-content:space-between; gap:.75rem; }
      .summary-card .font-semibold{ white-space:nowrap; }   /* กันตัวเลขตีกัน/ตัดคำ */
    `;

    document.head.appendChild(style);
  } catch (e) {
    console.warn('Fixed styles injection failed:', e);
  }
})();


// === เพิ่มการจัดการ touch events สำหรับ mobile ===
document.addEventListener('DOMContentLoaded', function() {
  // Ensure buttons are properly clickable on mobile
  document.addEventListener('touchstart', function(e) {
    const target = e.target;
    if (target.matches('.edit-btn, .delete-btn')) {
      target.style.backgroundColor = target.matches('.edit-btn') ? '#1d4ed8' : '#dc2626';
    }
  }, { passive: true });
  
  document.addEventListener('touchend', function(e) {
    const target = e.target;
    if (target.matches('.edit-btn')) {
      setTimeout(() => {
        target.style.backgroundColor = '#3b82f6';
      }, 150);
    } else if (target.matches('.delete-btn')) {
      setTimeout(() => {
        target.style.backgroundColor = '#ef4444';
      }, 150);
    }
  }, { passive: true });
});
