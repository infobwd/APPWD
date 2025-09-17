import { supabase } from '../api.js';
import { isAdmin } from './profile_admin.js';
import { SCHOOL_LAT,SCHOOL_LNG,SCHOOL_RADIUS_METERS, CHECKIN_START, CHECKIN_ON_TIME_UNTIL, SUMMARY_DEFAULT_RANGE_DAYS } from '../config.js';
import { toast, skel, openSheet, closeSheet } from '../ui.js';

// === Enhanced State Management ===
let G_LAT = SCHOOL_LAT, G_LNG = SCHOOL_LNG, G_RADIUS = SCHOOL_RADIUS_METERS;
let checkinScope = localStorage.getItem('APPWD_CHECKIN_SCOPE') || 'mine';
let lastText = null, lastGeo = null, map = null, meMarker = null, scanner = null;
let currentView = null;
let geoLoading = false;
let checkinInProgress = false;
let hasCheckedInToday = false;

// === Configuration Loading ===
async function loadGeoConfig(){
  try{
    const { data } = await supabase.from('settings').select('key,value').in('key',['SCHOOL_LAT','SCHOOL_LNG','SCHOOL_RADIUS_METERS']);
    const configMap = Object.fromEntries((data||[]).map(r=>[r.key, r.value]));
    if(configMap.SCHOOL_LAT) G_LAT = parseFloat(configMap.SCHOOL_LAT);
    if(configMap.SCHOOL_LNG) G_LNG = parseFloat(configMap.SCHOOL_LNG);
    if(configMap.SCHOOL_RADIUS_METERS) G_RADIUS = parseFloat(configMap.SCHOOL_RADIUS_METERS);
  }catch(e){ console.warn('Failed to load geo config:', e); }
}

// === Enhanced Duplicate Check ===
async function checkTodayCheckinStatus(uid){
  if(!uid) return { hasWork: false, hasAny: false, total: 0 };
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(); end.setHours(23,59,59,999);
  
  try {
    const { data, error } = await supabase
      .from('checkins')
      .select('purpose,status')
      .eq('line_user_id', uid)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());
    
    if(error) throw error;
    
    const workCount = data.filter(r => r.purpose === 'work').length;
    return {
      hasWork: workCount > 0,
      hasAny: data.length > 0,
      total: data.length,
      workCount: workCount
    };
  } catch(e) {
    console.warn('Failed to check today status:', e);
    return { hasWork: false, hasAny: false, total: 0 };
  }
}

// === Enhanced Filter Bar ===
function setupCheckinFilterBar(){
  const bar = document.getElementById('checkinFilterBar');
  if(!bar) return;
  
  bar.innerHTML = `
    <div class="flex items-center gap-2 flex-wrap">
      <div class="flex gap-1 bg-gray-100 rounded-lg p-1" style="background:var(--bg)">
        <button data-scope="mine" class="btn text-sm ${checkinScope==='mine'?'btn-prim':'bg-transparent border-0'}" style="padding:0.4rem 0.8rem">ของฉัน</button>
        <button data-scope="all" class="btn text-sm ${checkinScope==='all'?'btn-prim':'bg-transparent border-0'}" style="padding:0.4rem 0.8rem">ทั้งหมด</button>
      </div>
      <div class="text-sm text-ink3 ml-2" id="checkinFilterInfo"></div>
    </div>
  `;
  
  bar.querySelectorAll('[data-scope]').forEach(btn=>{
    btn.onclick = ()=>{
      const newScope = btn.getAttribute('data-scope');
      if(newScope === checkinScope) return;
      
      checkinScope = newScope;
      localStorage.setItem('APPWD_CHECKIN_SCOPE', checkinScope);
      
      // Update UI
      bar.querySelectorAll('[data-scope]').forEach(b => {
        b.classList.toggle('btn-prim', b.getAttribute('data-scope') === checkinScope);
        b.classList.toggle('bg-transparent', b.getAttribute('data-scope') !== checkinScope);
        b.classList.toggle('border-0', b.getAttribute('data-scope') !== checkinScope);
      });
      
      loadToday();
      updateFilterInfo();
    };
  });
  
  updateFilterInfo();
}

function updateFilterInfo(){
  const info = document.getElementById('checkinFilterInfo');
  if(!info) return;
  info.textContent = checkinScope === 'mine' ? 'แสดงเฉพาะการเช็คอินของฉัน' : 'แสดงการเช็คอินทั้งหมดวันนี้';
}

// === Enhanced Login Check ===
function ensureLoginForActions(){
  const profile = getProfile();
  const needLogin = !profile || !profile.userId;
  const buttons = ['btnGpsOnly', 'btnOpenScanner', 'btnCheckin', 'btnRefreshGeo'].map(id => document.getElementById(id)).filter(Boolean);
  
  if(needLogin){
    buttons.forEach(btn => {
      btn.setAttribute('disabled','disabled');
      btn.classList.add('opacity-50','cursor-not-allowed');
    });
    
    // Show login warning once
    const parentCard = document.querySelector('#checkinView .card:first-child');
    if(parentCard && !document.getElementById('loginWarn')){
      const warn = document.createElement('div');
      warn.id = 'loginWarn';
      warn.className = 'p-3 mb-3 rounded-lg text-sm';
      warn.style.cssText = 'background:#fef3c7;border:1px solid #f59e0b;color:#92400e';
      warn.innerHTML = `
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          <span>กรุณาเข้าสู่ระบบด้วย LINE ก่อนจึงจะเช็คอินได้</span>
        </div>
      `;
      parentCard.appendChild(warn);
    }
  } else {
    buttons.forEach(btn => {
      btn.removeAttribute('disabled');
      btn.classList.remove('opacity-50','cursor-not-allowed');
    });
    
    const warn = document.getElementById('loginWarn');
    if(warn) warn.remove();
  }
}

// === Enhanced Button Layout ===
function setupButtonLayout(){
  const container = document.querySelector('#checkinView .card:first-child');
  if(!container) return;
  
  // Find existing button container or create new one
  let buttonGrid = container.querySelector('.checkin-button-grid');
  if(!buttonGrid){
    buttonGrid = document.createElement('div');
    buttonGrid.className = 'checkin-button-grid grid grid-cols-2 gap-2 mt-3';
    
    // Insert after the description text
    const desc = container.querySelector('.text-sm.text-ink2');
    if(desc) {
      desc.parentNode.insertBefore(buttonGrid, desc.nextSibling);
    } else {
      container.appendChild(buttonGrid);
    }
  }
  
  buttonGrid.innerHTML = `
    <button id='btnOpenScanner' class='btn flex items-center justify-center gap-2 h-12'>
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3"/>
        <rect x="8" y="8" width="8" height="8" rx="2"/>
      </svg>
      <span>เปิดสแกน</span>
    </button>
    <button id='btnCheckin' class='btn btn-prim flex items-center justify-center gap-2 h-12'>
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z"/>
      </svg>
      <span>เช็คอิน GPS</span>
    </button>
    <button id='btnRefreshGeo' class='btn flex items-center justify-center gap-2 h-12'>
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M1 4v6h6M23 20v-6h-6"/>
        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
      </svg>
      <span>อ่านพิกัด</span>
    </button>
    <button id='btnGpsOnly' class='btn btn-prim flex items-center justify-center gap-2 h-12'>
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/>
        <path d="12 2v6M12 16v6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24"/>
      </svg>
      <span>เช็คอิน GPS</span>
    </button>
  `;
  
  // Remove old button containers
  const oldButtons = container.querySelectorAll('.grid.grid-cols-2.gap-2:not(.checkin-button-grid)');
  oldButtons.forEach(btn => btn.remove());
}

// === Helper Functions ===
function getProfile(){
  try {
    return JSON.parse(localStorage.getItem('LINE_PROFILE') || 'null');
  } catch {
    return null;
  }
}

function fmtDist(m){ 
  if(m >= 1000) return (m/1000).toFixed(2) + ' km'; 
  return Math.round(m) + ' m'; 
}

function toMinutes(timeStr){ 
  const [h,m] = timeStr.split(':').map(Number); 
  return h * 60 + m; 
}

function nowMinutes(){ 
  const d = new Date(); 
  return d.getHours() * 60 + d.getMinutes(); 
}

function statusFromTime(){ 
  const now = nowMinutes();
  const onTime = toMinutes(CHECKIN_ON_TIME_UNTIL);
  return now <= onTime ? 'on_time' : 'late'; 
}

function purposeLabel(purpose){ 
  const labels = {
    'work': 'มาทำงาน',
    'meeting': 'ประชุม',
    'training': 'อบรม',
    'official': 'ไปราชการ'
  };
  return labels[purpose] || 'อื่น ๆ';
}

// === Enhanced Map Management ===
function initMap(){
  const el = document.getElementById('map');
  if(!el) return;
  
  // Cleanup existing map
  if(map){
    try {
      map.remove();
    } catch(e) {
      console.warn('Map cleanup error:', e);
    }
    map = null;
    meMarker = null;
  }
  
  try {
    map = L.map('map').setView([G_LAT, G_LNG], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);
    
    // School area
    L.circle([G_LAT, G_LNG], { 
      radius: G_RADIUS, 
      color: '#22c55e', 
      fillColor: '#22c55e', 
      fillOpacity: 0.08 
    }).addTo(map);
    
    // School marker
    L.marker([G_LAT, G_LNG])
      .addTo(map)
      .bindPopup('โรงเรียน');
      
  } catch(e) {
    console.error('Map initialization failed:', e);
    el.innerHTML = '<div class="p-4 text-center text-red-600">ไม่สามารถโหลดแผนที่ได้</div>';
  }
}

function updateMeMarker(lat, lng){
  if(!map) return;
  
  try {
    if(!meMarker){
      meMarker = L.circleMarker([lat, lng], { 
        radius: 8, 
        color: '#2563EB', 
        fillColor: '#60A5FA', 
        fillOpacity: 0.9 
      }).addTo(map).bindPopup('ตำแหน่งของฉัน');
    } else {
      meMarker.setLatLng([lat, lng]);
    }
  } catch(e) {
    console.warn('Marker update failed:', e);
  }
}

// === Enhanced Geolocation ===
function getGeo(outputElement){
  if(geoLoading) return;
  geoLoading = true;
  
  if(outputElement) outputElement.innerHTML = `
    <div class="flex items-center gap-2">
      <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>กำลังอ่านตำแหน่ง...</span>
    </div>
  `;
  
  if(!navigator.geolocation){
    geoLoading = false;
    if(outputElement) outputElement.innerHTML = '<span class="text-red-600">อุปกรณ์ไม่รองรับตำแหน่ง</span>';
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      geoLoading = false;
      const { latitude, longitude, accuracy } = position.coords;
      lastGeo = { lat: latitude, lng: longitude, accuracy: accuracy || 0 };
      
      updateMeMarker(latitude, longitude);
      
      const distance = calculateDistance(G_LAT, G_LNG, latitude, longitude);
      const withinRadius = distance <= G_RADIUS;
      
      if(outputElement){
        const statusColor = withinRadius ? 'text-green-600' : 'text-red-600';
        const statusText = withinRadius ? '(อยู่ในพื้นที่)' : '(นอกพื้นที่)';
        const distanceText = distance >= 1000 ? `${(distance/1000).toFixed(2)} กม.` : `${Math.round(distance)} ม.`;
        
        outputElement.innerHTML = `
          <div>
            ห่างจุดเช็คอิน ~ <strong>${distanceText}</strong> 
            <span class="${statusColor}">${statusText}</span>
          </div>
          <div class="text-xs text-ink3 mt-1">
            พิกัด: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy || 0)}m)
          </div>
        `;
      }
    },
    (error) => {
      geoLoading = false;
      const errorMsg = {
        1: 'ไม่อนุญาตการเข้าถึงตำแหน่ง',
        2: 'ไม่สามารถระบุตำแหน่งได้',
        3: 'หมดเวลาการรอ GPS'
      }[error.code] || 'เกิดข้อผิดพลาดในการอ่านตำแหน่ง';
      
      if(outputElement) outputElement.innerHTML = `<span class="text-red-600">${errorMsg}</span>`;
    },
    { 
      enableHighAccuracy: true, 
      timeout: 10000, 
      maximumAge: 30000 
    }
  );
}

// === Distance Calculation ===
function calculateDistance(lat1, lng1, lat2, lng2){
  const R = 6371000; // Earth's radius in meters
  const toRadians = (deg) => deg * Math.PI / 180;
  
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
    
  return 2 * R * Math.asin(Math.sqrt(a));
}

// === Enhanced QR Scanner ===
async function openScanner(){
  const panel = document.getElementById('scanPanel');
  const holder = document.getElementById('qrReader');
  if(!panel || !holder) return;
  
  panel.classList.remove('hide');
  holder.innerHTML = '';
  
  try{
    scanner = new Html5Qrcode('qrReader');
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 240 },
      (decodedText) => {
        lastText = decodedText;
        const resultEl = document.getElementById('scanResult');
        if(resultEl) {
          resultEl.innerHTML = `
            <div class="flex items-center gap-2 text-green-600">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class='font-semibold text-green-600'>เช็คอินสำเร็จ!</div>
        <div class='text-sm space-y-1'>
          <div>เวลา: ${new Date().toLocaleTimeString('th-TH')}</div>
          <div>ประเภท: ${purposeLabel(purpose)}</div>
          <div>ระยะทาง: ${fmtDist(distance)}</div>
          ${note ? `<div>หมายเหตุ: ${note}</div>` : ''}
        </div>
        <button id='closeSuccess' class='btn btn-prim w-full'>ดูรายงานเช็คอิน</button>
      </div>
    `);
    document.getElementById('closeSuccess').onclick = () => {
      closeSheet();
      loadToday(); // Refresh the list
    };
  }, 1500);
}

// === Enhanced Data Loading ===
async function loadToday(){
  const profile = getProfile();
  const box = document.getElementById('todayList');
  if(!box) return;
  
  box.innerHTML = skel(3, '60px');
  
  if(!profile){
    box.innerHTML = '<div class="text-center text-ink3 p-4">ยังไม่เข้าสู่ระบบ</div>';
    return;
  }
  
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  
  try {
    const isAdminUser = await isAdmin();
    
    let query = supabase
      .from('checkins')
      .select('*')
      .gte('created_at', start.toISOString())
      .lt('created_at', new Date(end.getTime() + 1).toISOString());
    
    if(checkinScope === 'mine' && profile?.userId){
      query = query.eq('line_user_id', profile.userId);
    }
    
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);
    
    if(error) throw error;
    
    const checkins = data || [];
    
    if(checkins.length === 0){
      box.innerHTML = '<div class="text-center text-ink3 p-4">ยังไม่มีรายการเช็คอินวันนี้</div>';
      return;
    }
    
    box.innerHTML = checkins.map(record => {
      const canEdit = isAdminUser || (!record.within_radius && record.purpose !== 'work' && profile?.userId && record.line_user_id === profile.userId);
      const canDelete = isAdminUser;
      
      const editBtn = canEdit ? `
        <button class='btn text-xs px-2 py-1' onclick='editOffsite(${record.id}, "${record.purpose||''}", ${JSON.stringify(record.note||'').replace(/"/g,'&quot;')})'>
          แก้ไข
        </button>
      ` : '';
      
      const deleteBtn = canDelete ? `
        <button class='btn text-xs px-2 py-1 text-red-600 hover:bg-red-50' onclick='deleteCheckin(${record.id})'>
          ลบ
        </button>
      ` : '';
      
      const statusBadge = record.status ? (() => {
        const badges = {
          'on_time': '<span class="badge badge-ontime">ตรงเวลา</span>',
          'late': '<span class="badge badge-late">สาย</span>',
          'offsite': '<span class="badge badge-offsite">นอกสถานที่</span>'
        };
        return badges[record.status] || '';
      })() : '';
      
      const distanceColor = record.within_radius ? 'text-green-600' : 'text-red-600';
      
      return `
        <div class='checkin-item border rounded-lg p-3 bg-[var(--card)]' style='border-color:var(--bd)'>
          <div class='flex items-start gap-3'>
            <img src='${record.line_picture_url || ''}' 
                 class='w-10 h-10 rounded-full border flex-shrink-0' 
                 style='border-color:var(--bd)' 
                 onerror="this.style.display='none'">
            <div class='flex-1 min-w-0'>
              <div class='flex items-center gap-2 mb-1'>
                <span class='font-medium text-sm'>${record.line_display_name || 'ไม่ระบุ'}</span>
                ${statusBadge}
              </div>
              <div class='text-sm text-ink2'>
                <div class='mb-1'>
                  ${new Date(record.created_at).toLocaleTimeString('th-TH', {hour: '2-digit', minute: '2-digit'})} • 
                  ${purposeLabel(record.purpose)}
                  ${record.note ? ' • ' + record.note : ''}
                </div>
                <div class='${distanceColor} text-xs'>
                  ระยะทาง: ${fmtDist(record.distance_m || 0)}
                </div>
              </div>
            </div>
            <div class='flex flex-col gap-1'>
              ${editBtn}
              ${deleteBtn}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch(error) {
    console.error('Load today error:', error);
    box.innerHTML = '<div class="text-center text-red-600 p-4">โหลดข้อมูลไม่สำเร็จ</div>';
  }
}

// === Enhanced Summary with Responsive Design ===
async function renderSummary(){
  const box = document.getElementById('checkinSummary');
  if(!box) return;
  
  box.innerHTML = skel(6, '80px');
  
  const profile = getProfile();
  const now = new Date();
  
  // Calculate periods
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  
  async function countCheckins(since, scope){
    let query = supabase
      .from('checkins')
      .select('purpose,status,line_user_id')
      .gte('created_at', since.toISOString())
      .lte('created_at', now.toISOString());
    
    if(scope === 'me' && profile?.userId){
      query = query.eq('line_user_id', profile.userId);
    }
    
    const { data, error } = await query;
    
    const aggregation = { work: 0, meeting: 0, training: 0, official: 0, ontime: 0, late: 0 };
    
    if(!error && data){
      data.forEach(record => {
        if(record.purpose && aggregation.hasOwnProperty(record.purpose)){
          aggregation[record.purpose]++;
        }
        if(record.purpose === 'work'){
          if(record.status === 'on_time') aggregation.ontime++;
          else if(record.status === 'late') aggregation.late++;
        }
      });
    }
    
    return aggregation;
  }
  
  try {
    const [meWeek, meMonth, meYear, orgWeek, orgMonth, orgYear] = await Promise.all([
      countCheckins(weekStart, 'me'),
      countCheckins(monthStart, 'me'),
      countCheckins(yearStart, 'me'),
      countCheckins(weekStart, 'org'),
      countCheckins(monthStart, 'org'),
      countCheckins(yearStart, 'org'),
    ]);
    
    // Calculate on-time percentage for encouragement
    const totalWork = (meMonth.ontime || 0) + (meMonth.late || 0);
    let encouragementCard = '';
    
    if(totalWork > 0){
      const onTimePercentage = Math.round((meMonth.ontime || 0) * 100 / totalWork);
      const encourageClass = onTimePercentage >= 80 ? 'bg-green-50 border-green-200 text-green-800' : 
                            onTimePercentage >= 60 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 
                            'bg-red-50 border-red-200 text-red-800';
      const encourageIcon = onTimePercentage >= 80 ? '🌟' : onTimePercentage >= 60 ? '⚡' : '💪';
      const encourageText = onTimePercentage >= 80 ? 'ยอดเยี่ยม! รักษาสม่ำเสมอไว้' : 
                           onTimePercentage >= 60 ? 'ดีแล้ว! พยายามปรับปรุงต่อไป' : 
                           'กำลังใจนะ! พรุ่งนี้จะดีขึ้น';
      
      encouragementCard = `
        <div class='col-span-full mt-4'>
          <div class='p-4 rounded-lg border ${encourageClass}'>
            <div class='flex items-center gap-2 mb-2'>
              <span class='text-lg'>${encourageIcon}</span>
              <span class='font-semibold'>สถิติเดือนนี้</span>
            </div>
            <div class='text-sm'>
              เช็คอินตรงเวลา: <strong>${meMonth.ontime || 0}/${totalWork} วัน</strong> (${onTimePercentage}%)
              <br>${encourageText}
            </div>
          </div>
        </div>
      `;
    }
    
    function createSummaryCard(title, data, period){
      return `
        <div class='summary-card border rounded-xl p-4 bg-[var(--card)]' style='border-color:var(--bd)'>
          <div class='text-sm font-semibold mb-3 text-center'>${title}</div>
          <div class='space-y-2'>
            <div class='flex justify-between items-center'>
              <span class='text-sm'>มาทำงาน</span>
              <span class='font-bold text-lg'>${data.work || 0}</span>
            </div>
            <div class='flex justify-between items-center'>
              <span class='text-sm'>ประชุม</span>
              <span class='font-bold'>${data.meeting || 0}</span>
            </div>
            <div class='flex justify-between items-center'>
              <span class='text-sm'>อบรม</span>
              <span class='font-bold'>${data.training || 0}</span>
            </div>
            <div class='flex justify-between items-center'>
              <span class='text-sm'>ไปราชการ</span>
              <span class='font-bold'>${data.official || 0}</span>
            </div>
            ${period === 'month' && data.work > 0 ? `
              <hr style='border-color:var(--bd)' class='my-2'>
              <div class='text-xs text-ink3'>
                <div class='flex justify-between'>
                  <span>ตรงเวลา</span>
                  <span>${data.ontime || 0} วัน</span>
                </div>
                <div class='flex justify-between'>
                  <span>สาย</span>
                  <span>${data.late || 0} วัน</span>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }
    
    box.innerHTML = `
      <div class='summary-grid grid gap-3'>
        ${createSummaryCard('ของฉัน • สัปดาห์นี้', meWeek, 'week')}
        ${createSummaryCard('องค์กร • สัปดาห์นี้', orgWeek, 'week')}
        ${createSummaryCard('ของฉัน • เดือนนี้', meMonth, 'month')}
        ${createSummaryCard('องค์กร • เดือนนี้', orgMonth, 'month')}
        ${createSummaryCard('ของฉัน • ปีนี้', meYear, 'year')}
        ${createSummaryCard('องค์กร • ปีนี้', orgYear, 'year')}
        ${encouragementCard}
      </div>
    `;
    
  } catch(error) {
    console.error('Render summary error:', error);
    box.innerHTML = '<div class="text-center text-red-600 p-4">โหลดสรุปผลไม่สำเร็จ</div>';
  }
}

// === Export Functions ===
export async function initTabs(){
  document.querySelectorAll('[data-ci-tab]').forEach(btn => btn.classList.remove('btn-prim'));
  const defaultTab = document.querySelector('[data-ci-tab="work"]');
  if(defaultTab) defaultTab.classList.add('btn-prim');
}

export async function render(){
  currentView = 'checkin';
  
  try {
    await loadGeoConfig();
    
    // Setup UI
    setupCheckinFilterBar();
    ensureLoginForActions();
    setupButtonLayout();
    
    // Initialize map
    initMap();
    
    // Get initial location
    const geoState = document.getElementById('geoState');
    if(geoState) getGeo(geoState);
    
    // Setup event handlers
    setupEventHandlers();
    
    // Load data
    await loadToday();
    await renderSummary();
    
  } catch(error) {
    console.error('Checkin render error:', error);
    toast('เกิดข้อผิดพลาดในการโหลดหน้าเช็คอิน');
  }
}

function setupEventHandlers(){
  // Button handlers
  const btnOpenScanner = document.getElementById('btnOpenScanner');
  const btnCloseScanner = document.getElementById('btnCloseScanner');
  const btnCheckin = document.getElementById('btnCheckin');
  const btnRefreshGeo = document.getElementById('btnRefreshGeo');
  const btnGpsOnly = document.getElementById('btnGpsOnly');
  
  if(btnOpenScanner) btnOpenScanner.onclick = openScanner;
  if(btnCloseScanner) btnCloseScanner.onclick = closeScanner;
  if(btnCheckin) btnCheckin.onclick = () => doCheckin('gps');
  if(btnGpsOnly) btnGpsOnly.onclick = () => doCheckin('gps');
  if(btnRefreshGeo) btnRefreshGeo.onclick = () => {
    const geoState = document.getElementById('geoState');
    if(geoState) getGeo(geoState);
  };
}

// === Home View Functions ===
export async function renderHomeRecent(kind = 'work'){
  const box = document.getElementById('homeCheckins');
  if(!box) return;
  
  box.innerHTML = skel(5, '52px');
  
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  
  try {
    const { data, error } = await supabase
      .from('checkins')
      .select('id,line_display_name,line_picture_url,created_at,distance_m,within_radius,purpose,status')
      .eq('purpose', kind)
      .gte('created_at', start.toISOString())
      .lt('created_at', new Date(end.getTime() + 1).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);
    
    if(error) throw error;
    
    const checkins = data || [];
    
    // Update tab buttons
    document.querySelectorAll('[data-ci-tab]').forEach(btn => {
      btn.classList.toggle('btn-prim', btn.getAttribute('data-ci-tab') === kind);
    });
    
    if(checkins.length === 0){
      box.innerHTML = '<div class="text-ink3 text-center py-4">ยังไม่มีรายการ</div>';
      return;
    }
    
    box.innerHTML = checkins.map(record => {
      const statusText = record.status === 'on_time' ? 'ตรงเวลา' : 
                        record.status === 'late' ? 'สาย' : 'นอกพื้นที่';
      const distanceColor = record.within_radius ? 'text-green-600' : 'text-red-600';
      
      return `
        <div class='p-3 border rounded-lg flex items-center gap-3 bg-[var(--card)]' style='border-color:var(--bd)'>
          <img src='${record.line_picture_url || ''}' 
               class='w-8 h-8 rounded-full border flex-shrink-0' 
               onerror="this.style.display='none'">
          <div class='flex-1 min-w-0'>
            <div class='text-sm font-medium truncate'>${record.line_display_name || 'ไม่ระบุ'}</div>
            <div class='text-xs text-ink3'>
              ${new Date(record.created_at).toLocaleTimeString('th-TH', {hour: '2-digit', minute: '2-digit'})} • 
              ${purposeLabel(record.purpose)} • ${statusText}
            </div>
          </div>
          <div class='${distanceColor} text-xs font-medium'>
            ${fmtDist(record.distance_m || 0)}
          </div>
        </div>
      `;
    }).join('');
    
  } catch(error) {
    console.error('Render home recent error:', error);
    box.innerHTML = '<div class="text-red-600 text-center py-4">โหลดไม่สำเร็จ</div>';
  }
}

export async function renderHomeSummary(){
  const box = document.getElementById('homeSummary');
  if(!box) return;
  
  box.innerHTML = skel(4, '64px');
  
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  
  try {
    const purposes = ['work', 'meeting', 'training', 'official'];
    const counts = {};
    
    await Promise.all(purposes.map(async (purpose) => {
      const { count, error } = await supabase
        .from('checkins')
        .select('id', { count: 'exact', head: true })
        .eq('purpose', purpose)
        .gte('created_at', start.toISOString())
        .lt('created_at', new Date(end.getTime() + 1).toISOString());
      
      counts[purpose] = error ? 0 : (count || 0);
    }));
    
    function createTile(label, value){
      return `
        <div class='p-3 border rounded-xl bg-[var(--card)] text-center' style='border-color:var(--bd)'>
          <div class='text-xs text-ink3 mb-1'>${label}</div>
          <div class='text-xl font-bold' style='color:var(--ink)'>${value}</div>
        </div>
      `;
    }
    
    box.innerHTML = [
      createTile('มาทำงาน', counts.work),
      createTile('ประชุม', counts.meeting),
      createTile('อบรม', counts.training),
      createTile('ไปราชการ', counts.official)
    ].join('');
    
  } catch(error) {
    console.error('Render home summary error:', error);
    box.innerHTML = '<div class="text-red-600 text-center py-4">โหลดไม่สำเร็จ</div>';
  }
}

// === Global Functions ===
window.editOffsite = function(id, purpose, note){
  openSheet(`
    <div class='space-y-3'>
      <div class='font-semibold'>แก้ไขภารกิจนอกสถานที่</div>
      <div class='space-y-2'>
        <label class='flex items-center gap-3 p-2 border rounded-lg cursor-pointer'>
          <input type='radio' name='editPurpose' value='meeting' ${purpose==='meeting'?'checked':''}>
          <span>ประชุม</span>
        </label>
        <label class='flex items-center gap-3 p-2 border rounded-lg cursor-pointer'>
          <input type='radio' name='editPurpose' value='training' ${purpose==='training'?'checked':''}>
          <span>อบรม</span>
        </label>
        <label class='flex items-center gap-3 p-2 border rounded-lg cursor-pointer'>
          <input type='radio' name='editPurpose' value='official' ${purpose==='official'?'checked':''}>
          <span>ไปราชการ</span>
        </label>
      </div>
      <input id='editNote' class='w-full p-3 border rounded-lg' placeholder='รายละเอียดงาน' value='${note?String(note).replace(/'/g,'&#39;'):''}'/>
      <div class='text-xs text-ink3'>* ไม่สามารถแก้ไขเวลาเช็คอินได้</div>
      <div class='grid grid-cols-2 gap-2'>
        <button id='confirmEdit' class='btn btn-prim'>บันทึก</button>
        <button id='cancelEdit' class='btn'>ยกเลิก</button>
      </div>
    </div>
  `);
  
  document.getElementById('cancelEdit').onclick = closeSheet;
  document.getElementById('confirmEdit').onclick = async () => {
    const selected = document.querySelector('input[name="editPurpose"]:checked');
    const noteText = document.getElementById('editNote').value.trim();
    
    if(!selected){
      toast('กรุณาเลือกเหตุผล');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('checkins')
        .update({
          purpose: selected.value,
          note: noteText || null
        })
        .eq('id', id);
      
      if(error) throw error;
      
      closeSheet();
      toast('อัปเดตแล้ว');
      await loadToday();
      
    } catch(error) {
      console.error('Edit error:', error);
      toast('บันทึกไม่สำเร็จ');
    }
  };
};

window.deleteCheckin = function(id){
  openSheet(`
    <div class='text-center space-y-3'>
      <div class='w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto'>
        <svg class="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd"/>
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414L8.586 12l-2.293 2.293a1 1 0 101.414 1.414L9 13.414l2.293 2.293a1 1 0 001.414-1.414L10.414 12l2.293-2.293z" clip-rule="evenodd"/>
        </svg>
      </div>
      <div class='font-semibold text-red-600'>ยืนยันการลบเช็คอิน</div>
      <div class='text-sm text-ink3'>การลบไม่สามารถยกเลิกได้</div>
      <div class='grid grid-cols-2 gap-2'>
        <button id='confirmDelete' class='btn text-red-600 border-red-300 hover:bg-red-50'>ลบ</button>
        <button id='cancelDelete' class='btn btn-prim'>ยกเลิก</button>
      </div>
    </div>
  `);
  
  document.getElementById('cancelDelete').onclick = closeSheet;
  document.getElementById('confirmDelete').onclick = async () => {
    try {
      const { error } = await supabase.from('checkins').delete().eq('id', id);
      if(error) throw error;
      
      closeSheet();
      toast('ลบแล้ว');
      await loadToday();
      
    } catch(error) {
      console.error('Delete error:', error);
      toast('ลบไม่สำเร็จ');
    }
  };
};

// === Cleanup Function ===
export function cleanup(){
  currentView = null;
  geoLoading = false;
  checkinInProgress = false;
  
  if(scanner){
    try {
      scanner.stop();
      scanner.clear();
    } catch(e) {}
    scanner = null;
  }
  
  if(map){
    try {
      map.remove();
    } catch(e) {}
    map = null;
    meMarker = null;
  }
}

// === Enhanced CSS for better responsive design ===
(() => {
  try {
    const style = document.createElement('style');
    style.id = 'checkin-enhanced-styles';
    style.textContent = `
      /* Enhanced Summary Grid */
      .summary-grid {
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }
      
      @media (min-width: 768px) {
        .summary-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      
      @media (min-width: 1024px) {
        .summary-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      
      /* Enhanced Checkin Items */
      .checkin-item {
        transition: all 0.2s ease;
      }
      
      .checkin-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0,0,0,0.1);
      }
      
      /* Enhanced Button Grid */
      .checkin-button-grid {
        gap: 8px;
      }
      
      @media (min-width: 640px) {
        .checkin-button-grid {
          gap: 12px;
        }
      }
      
      /* Badge Styles */
      .badge {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 12px;
        text-transform: uppercase;
        letter-spacing: 0.025em;
      }
      
      .badge-ontime {
        background: #dcfce7;
        color: #166534;
      }
      
      .badge-late {
        background: #fef3c7;
        color: #92400e;
      }
      
      .badge-offsite {
        background: #e0e7ff;
        color: #3730a3;
      }
      
      /* Loading Animation */
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      
      .animate-spin {
        animation: spin 1s linear infinite;
      }
      
      /* Map Container Enhancement */
      #map {
        position: relative;
        border-radius: 12px;
        overflow: hidden;
      }
      
      .leaflet-container {
        border-radius: 12px;
      }
    `;
    document.head.appendChild(style);
  } catch(e) {
    console.warn('Failed to add enhanced styles:', e);
  }
})();="evenodd"/>
              </svg>
              <span>สแกน QR สำเร็จ: ${decodedText.substring(0, 50)}${decodedText.length > 50 ? '...' : ''}</span>
            </div>
          `;
        }
      }
    );
  } catch(error) {
    console.error('QR Scanner error:', error);
    holder.innerHTML = `
      <div class="p-4 text-center">
        <div class="text-red-600 mb-2">ไม่สามารถเปิดกล้องได้</div>
        <div class="text-sm text-ink3">${error.message || error}</div>
      </div>
    `;
  }
}

async function closeScanner(){
  const panel = document.getElementById('scanPanel');
  if(panel) panel.classList.add('hide');
  
  if(scanner){
    try{
      await scanner.stop();
      await scanner.clear();
    } catch(e) {
      console.warn('Scanner cleanup error:', e);
    }
    scanner = null;
  }
}

// === Enhanced Checkin Process ===
async function doCheckin(method = 'gps'){
  if(checkinInProgress){
    toast('กำลังประมวลผล กรุณารอสักครู่...');
    return;
  }
  
  const profile = getProfile();
  if(!profile){
    toast('ต้องเข้าสู่ระบบด้วย LINE ก่อน');
    return;
  }
  
  if(!lastGeo){
    toast('ยังไม่ได้ตำแหน่ง (กดอ่านตำแหน่งอีกครั้ง)');
    return;
  }
  
  checkinInProgress = true;
  const loadingToast = toast('กำลังเช็คอิน...', 'info', false);
  
  try {
    // Check existing checkin
    const todayStatus = await checkTodayCheckinStatus(profile.userId);
    const distance = calculateDistance(G_LAT, G_LNG, lastGeo.lat, lastGeo.lng);
    const withinRadius = distance <= G_RADIUS;
    
    if(withinRadius && todayStatus.hasWork){
      checkinInProgress = false;
      if(loadingToast) loadingToast.remove();
      
      openSheet(`
        <div class='text-center space-y-3'>
          <div class='w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto'>
            <svg class="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div class='font-semibold'>เช็คอินแล้วในวันนี้</div>
          <div class='text-sm text-ink3'>คุณได้เช็คอินมาทำงานไปแล้ว ${todayStatus.workCount} ครั้งในวันนี้</div>
          <button id='closeWarning' class='btn btn-prim w-full'>รับทราب</button>
        </div>
      `);
      document.getElementById('closeWarning').onclick = closeSheet;
      return;
    }
    
    let purpose = 'work';
    let note = lastText || null;
    
    // Handle outside radius checkin
    if(!withinRadius){
      const purposeResult = await handleOutsideRadiusCheckin();
      if(!purposeResult) {
        checkinInProgress = false;
        if(loadingToast) loadingToast.remove();
        return;
      }
      purpose = purposeResult.purpose;
      note = purposeResult.note;
    }
    
    await saveCheckin({ method, withinRadius, purpose, note, distance });
    
  } catch(error) {
    console.error('Checkin error:', error);
    toast('เกิดข้อผิดพลาดในการเช็คอิน');
  } finally {
    checkinInProgress = false;
    if(loadingToast) loadingToast.remove();
  }
}

function handleOutsideRadiusCheckin(){
  return new Promise((resolve) => {
    openSheet(`
      <div class='space-y-3'>
        <div class='font-semibold text-orange-600'>อยู่นอกเขตโรงเรียน — ระบุเหตุผล</div>
        <div class='space-y-2'>
          <label class='flex items-center gap-3 p-2 border rounded-lg cursor-pointer hover:bg-gray-50'>
            <input type='radio' name='outsidePurpose' value='meeting' class='w-4 h-4'>
            <span>ประชุม</span>
          </label>
          <label class='flex items-center gap-3 p-2 border rounded-lg cursor-pointer hover:bg-gray-50'>
            <input type='radio' name='outsidePurpose' value='training' class='w-4 h-4'>
            <span>อบรม</span>
          </label>
          <label class='flex items-center gap-3 p-2 border rounded-lg cursor-pointer hover:bg-gray-50'>
            <input type='radio' name='outsidePurpose' value='official' class='w-4 h-4'>
            <span>ไปราชการ</span>
          </label>
        </div>
        <input id='outsideNote' class='w-full p-3 border rounded-lg' placeholder='รายละเอียดงาน/หน่วยงาน/ภารกิจ'>
        <div class='grid grid-cols-2 gap-2'>
          <button id='confirmOutside' class='btn btn-prim'>บันทึก</button>
          <button id='cancelOutside' class='btn'>ยกเลิก</button>
        </div>
      </div>
    `);
    
    document.getElementById('cancelOutside').onclick = () => {
      closeSheet();
      resolve(null);
    };
    
    document.getElementById('confirmOutside').onclick = () => {
      const selected = document.querySelector('input[name="outsidePurpose"]:checked');
      const noteText = document.getElementById('outsideNote').value.trim();
      
      if(!selected){
        toast('กรุณาเลือกเหตุผล');
        return;
      }
      
      if(!noteText){
        toast('กรุณากรอกรายละเอียด');
        return;
      }
      
      closeSheet();
      resolve({
        purpose: selected.value,
        note: noteText
      });
    };
  });
}

async function saveCheckin({ method, withinRadius, purpose, note, distance }){
  const profile = getProfile();
  const status = withinRadius ? statusFromTime() : 'offsite';
  
  const payload = {
    line_user_id: profile?.userId || null,
    line_display_name: profile?.displayName || null,
    line_picture_url: profile?.pictureUrl || null,
    method,
    purpose,
    status,
    note,
    lat: Number(lastGeo.lat) || null,
    lng: Number(lastGeo.lng) || null,
    accuracy: Number(lastGeo.accuracy) || 0,
    distance_m: Math.round(distance || 0),
    within_radius: !!withinRadius
  };
  
  // Clean undefined values
  Object.keys(payload).forEach(key => {
    if(payload[key] === undefined || (typeof payload[key] === 'number' && !isFinite(payload[key]))){
      delete payload[key];
    }
  });
  
  const { data, error } = await supabase
    .from('checkins')
    .insert(payload)
    .select('id')
    .single();
  
  if(error){
    console.error('Save checkin error:', error);
    throw new Error('บันทึกไม่สำเร็จ');
  }
  
  // Success feedback
  const successMsg = withinRadius ? 'เช็คอินสำเร็จ ✅' : 'บันทึกภารกิจนอกสถานที่ ✅';
  toast(successMsg, 'success');
  
  // Update UI
  hasCheckedInToday = true;
  await loadToday();
  await renderSummary();
