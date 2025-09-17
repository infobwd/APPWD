import { supabase } from '../api.js';
import { isAdmin as checkIsAdmin } from './profile_admin.js';
import { SCHOOL_LAT,SCHOOL_LNG,SCHOOL_RADIUS_METERS, CHECKIN_ON_TIME_UNTIL } from '../config.js';
import { toast, skel, openSheet, closeSheet } from '../ui.js';

const CheckinState = {
  scope: localStorage.getItem('APPWD_CHECKIN_SCOPE') || 'mine',
  lastText: null,
  lastGeo: null,
  map: null,
  meMarker: null,
  _accCircle: null,
  scanner: null,
  isLoadingGps: false,
  isLoadingScan: false,
  isCheckingin: false,
  geoConfig: { lat: SCHOOL_LAT, lng: SCHOOL_LNG, radius: SCHOOL_RADIUS_METERS },
  setScope(s){ this.scope=s; localStorage.setItem('APPWD_CHECKIN_SCOPE', s); },
  cleanup(){ this.cleanupMap(); this.cleanupScanner(); this.lastText=null; this.lastGeo=null; this.isLoadingGps=false; this.isLoadingScan=false; this.isCheckingin=false; },
  cleanupMap(){ if(this.map){ try{ this.map.remove(); }catch(_){} this.map=null; this.meMarker=null; this._accCircle=null; } },
  async cleanupScanner(){ if(this.scanner){ try{ await this.scanner.stop(); await this.scanner.clear(); }catch(_){} this.scanner=null; } }
};

async function loadGeoConfig(){
  try{
    const { data } = await supabase.from('settings').select('key,value').in('key',['SCHOOL_LAT','SCHOOL_LNG','SCHOOL_RADIUS_METERS']);
    const m = Object.fromEntries((data||[]).map(r=>[r.key,r.value]));
    if(m.SCHOOL_LAT) CheckinState.geoConfig.lat = parseFloat(m.SCHOOL_LAT);
    if(m.SCHOOL_LNG) CheckinState.geoConfig.lng = parseFloat(m.SCHOOL_LNG);
    if(m.SCHOOL_RADIUS_METERS) CheckinState.geoConfig.radius = parseFloat(m.SCHOOL_RADIUS_METERS);
  }catch(e){ console.warn('geo load fail', e); }
}

function fmtDist(m){ return m>=1000 ? (m/1000).toFixed(2)+' km' : Math.round(m)+' m'; }
function toMinutes(t){ const [h,m]=t.split(':').map(Number); return h*60+m; }
function nowMinutes(){ const d=new Date(); return d.getHours()*60+d.getMinutes(); }
function statusFromTime(){ return nowMinutes()<=toMinutes(CHECKIN_ON_TIME_UNTIL) ? 'on_time':'late'; }
function purposeLabel(p){ return ({work:'มาทำงาน',meeting:'ประชุม',training:'อบรม',official:'ไปราชการ'})[p]||'อื่น ๆ'; }
function dist(a,b,c,d){ const R=6371000, rad=x=>x*Math.PI/180; const dLat=rad(c-a), dLng=rad(d-b); const A=Math.sin(dLat/2)**2 + Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.sqrt(A)); }

function showCheckinStatus(msg,type='info',ms=3000){
  let el=document.getElementById('checkinStatus');
  if(!el){ el=document.createElement('div'); el.id='checkinStatus'; document.body.appendChild(el); }
  el.className='fixed top-4 left-4 right-4 z-50 p-3 rounded-lg border text-sm font-medium transition-all duration-300';
  if(type==='success'){ el.classList.add('bg-green-50','border-green-200','text-green-800'); }
  else if(type==='warning'){ el.classList.add('bg-yellow-50','border-yellow-200','text-yellow-800'); }
  else if(type==='error'){ el.classList.add('bg-red-50','border-red-200','text-red-800'); }
  else { el.classList.add('bg-blue-50','border-blue-200','text-blue-800'); }
  el.textContent = msg;
  setTimeout(()=>{ el.remove(); }, ms);
}

function updateButtonStates(){
  const profile = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  const isLoggedIn = profile && profile.userId;
  const ids=['btnOpenScanner','btnCheckin','btnRefreshGeo','btnGpsOnly'];
  ids.forEach(id=>{ const b=document.getElementById(id); if(!b) return; b.disabled=!isLoggedIn; b.classList.toggle('opacity-50',!isLoggedIn); b.classList.toggle('cursor-not-allowed',!isLoggedIn); });
}

function parseHashParams(){ try{ const h=location.hash||''; const q=h.includes('?')?h.split('?')[1]:''; return new URLSearchParams(q);}catch(_){return new URLSearchParams('');} }
function setupCheckinFilterBar(){
  const bar=document.getElementById('checkinFilterBar'); if(!bar) return;
  bar.innerHTML=`
    <div class="flex items-center gap-2 flex-wrap">
      <button data-scope="all" class="btn text-sm ${CheckinState.scope==='all'?'btn-prim':''}">ทั้งหมด (วันนี้)</button>
      <button data-scope="mine" class="btn text-sm ${CheckinState.scope==='mine'?'btn-prim':''}">ของฉัน (วันนี้)</button>
    </div>`;
  bar.querySelectorAll('[data-scope]').forEach(btn=>{
    btn.onclick=()=>{ CheckinState.setScope(btn.getAttribute('data-scope')); bar.querySelectorAll('[data-scope]').forEach(b=>b.classList.remove('btn-prim')); btn.classList.add('btn-prim'); loadToday(); };
  });
}

function ensureLoginForActions(){
  const profile = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  const isLoggedIn = profile && profile.userId; updateButtonStates();
  const parentCard=document.querySelector('#checkinView .card'); const warn=document.getElementById('loginWarn');
  if(!isLoggedIn && parentCard && !warn){
    const el=document.createElement('div'); el.id='loginWarn'; el.className='mb-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-800';
    el.innerHTML='<div class="flex items-center gap-2"><span class="text-yellow-600">⚠️</span><span>กรุณาเข้าสู่ระบบด้วย LINE ก่อนจึงจะเช็คอินได้</span></div>';
    parentCard.insertBefore(el,parentCard.children[1]);
  }else if(isLoggedIn && warn){ warn.remove(); }
  return isLoggedIn;
}

// Map
function initMap(){
  const el=document.getElementById('map'); if(!el) return; CheckinState.cleanupMap();
  const {lat,lng,radius}=CheckinState.geoConfig;
  CheckinState.map=L.map('map',{center:[lat,lng],zoom:16,zoomControl:true,attributionControl:false});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(CheckinState.map);
  L.circle([lat,lng],{radius,color:'#22c55e',fillColor:'#22c55e',fillOpacity:0.1,weight:2}).addTo(CheckinState.map);
  L.marker([lat,lng],{icon:L.divIcon({html:'<div style="background:#22c55e;width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>',className:'school-marker',iconSize:[20,20],iconAnchor:[10,10]})}).addTo(CheckinState.map).bindPopup('โรงเรียน');
}
function updateMeMarker(lat,lng,accuracy=0){
  if(!CheckinState.map) return;
  if(!CheckinState.meMarker){ CheckinState.meMarker=L.circleMarker([lat,lng],{radius:8,color:'#2563EB',fillColor:'#60A5FA',fillOpacity:0.9,weight:2}).addTo(CheckinState.map); }
  else { CheckinState.meMarker.setLatLng([lat,lng]); }
  if(accuracy>0){
    if(!CheckinState._accCircle){ CheckinState._accCircle=L.circle([lat,lng],{radius:accuracy,color:'#2563EB',fillColor:'#60A5FA',fillOpacity:0.08,weight:1,dashArray:'5, 5'}).addTo(CheckinState.map); }
    else { CheckinState._accCircle.setLatLng([lat,lng]).setRadius(accuracy); }
  }
  CheckinState.map.panTo([lat,lng]);
}

function getGeoLocation(out,{showLoading=true}={}){
  if(!out) return Promise.reject('no element');
  if(showLoading){ out.textContent='กำลังอ่านตำแหน่ง...'; }
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation){ out.textContent='อุปกรณ์ไม่รองรับตำแหน่ง'; return reject(); }
    navigator.geolocation.getCurrentPosition((pos)=>{
      const {latitude,longitude,accuracy}=pos.coords;
      CheckinState.lastGeo={lat:latitude,lng:longitude,accuracy:accuracy||0,timestamp:Date.now()};
      updateMeMarker(latitude,longitude,accuracy);
      const {lat:sl,lng:sg,radius}=CheckinState.geoConfig;
      const d=dist(sl,sg,latitude,longitude); const ok=d<=radius;
      out.innerHTML=`<div class="space-y-2">
        <div class="font-medium">ห่างจุดเช็คอิน ~ <span class="font-bold">${fmtDist(d)}</span> <span class="${ok?'text-green-600':'text-red-600'}">${ok?'(ภายในพื้นที่)':'(นอกพื้นที่)'}</span></div>
        <div class="text-xs text-gray-500">ตำแหน่ง: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${Math.round(accuracy||0)}m)</div>
      </div>`;
      resolve({latitude,longitude,accuracy,distance:d,isWithinRadius:ok});
    },(err)=>{ out.textContent='อ่านตำแหน่งไม่สำเร็จ'; reject(err); },{enableHighAccuracy:true,timeout:8000,maximumAge:30000});
  });
}

// Scanner
async function openScanner(){
  const panel=document.getElementById('scanPanel'); const holder=document.getElementById('qrReader'); if(!panel||!holder) return;
  panel.classList.remove('hide'); holder.innerHTML=`<div class="p-4 text-center">กำลังเปิดกล้อง...</div>`;
  try{
    CheckinState.scanner=new Html5Qrcode('qrReader');
    const cams=await Html5Qrcode.getCameras(); const back=cams.find(d=>(d.label||'').toLowerCase().includes('back')) || cams[0];
    await CheckinState.scanner.start(back?.id || {facingMode:'environment'},{fps:10,qrbox:{width:250,height:250}},(txt)=>{
      CheckinState.lastText=txt;
      const res=document.getElementById('scanResult'); if(res) res.innerHTML=`<div class="p-2 bg-green-50 border border-green-200 rounded text-green-800"><strong>สแกนสำเร็จ:</strong><br><span class="text-xs break-all">${txt}</span></div>`;
      showCheckinStatus('สแกน QR สำเร็จ! ✅','success');
    },_=>{});
  }catch(e){ holder.innerHTML=`<div class="p-4 text-center text-red-600">ไม่สามารถเปิดกล้องได้</div>`; showCheckinStatus('ไม่สามารถเปิดกล้องได้','error'); }
}
async function closeScanner(){ const panel=document.getElementById('scanPanel'); if(panel) panel.classList.add('hide'); await CheckinState.cleanupScanner(); const res=document.getElementById('scanResult'); if(res) res.innerHTML=''; }

async function doCheckin(method='gps'){
  if(CheckinState.isCheckingin) return;
  const profile=JSON.parse(localStorage.getItem('LINE_PROFILE')||'null'); if(!profile||!profile.userId){ showCheckinStatus('ต้องเข้าสู่ระบบด้วย LINE ก่อน','error'); return; }
  if(!CheckinState.lastGeo){ showCheckinStatus('ยังไม่ได้ตำแหน่ง กรุณากดอ่านพิกัดใหม่','warning'); const st=document.getElementById('geoState'); if(st) await getGeoLocation(st).catch(()=>{}); return; }
  CheckinState.isCheckingin=true;
  const {lat:sl,lng:sg,radius}=CheckinState.geoConfig; const d=dist(sl,sg,CheckinState.lastGeo.lat,CheckinState.lastGeo.lng); const within=d<=radius;
  if(within){
    const start=new Date(); start.setHours(0,0,0,0); const end=new Date(); end.setHours(23,59,59,999);
    const { data } = await supabase.from('checkins').select('id,created_at').eq('line_user_id', profile.userId).eq('purpose','work').gte('created_at',start.toISOString()).lte('created_at',end.toISOString()).limit(1);
    if(data && data.length){ CheckinState.isCheckingin=false; openSheet(`<div class='text-center space-y-3'><div class='text-4xl'>✅</div><div class='font-semibold text-lg'>เช็คอินแล้ววันนี้</div><button id='okDupe' class='btn btn-prim w-full'>รับทราบ</button></div>`); document.getElementById('okDupe').onclick=closeSheet; showCheckinStatus('วันนี้เช็คอินแล้ว','warning'); return; }
  }
  let purpose='work', note = method.includes('qr') ? CheckinState.lastText : null;
  if(!within){ CheckinState.isCheckingin=false; await showOffsiteCheckinDialog(d); return; }
  await saveCheckin({method,within,purpose,note,distance:d,profile});
}

async function showOffsiteCheckinDialog(distance){
  return new Promise(resolve=>{
    openSheet(`<div class='space-y-4'>
      <div class='text-center'><div class='text-4xl mb-2'>📍</div><div class='font-semibold text-lg'>อยู่นอกเขตโรงเรียน</div><div class='text-sm text-gray-600'>ห่างจุดเช็คอิน ${fmtDist(distance)}</div></div>
      <div class='space-y-3'>
        <div class='font-medium'>เลือกเหตุผล:</div>
        <label class='flex items-center gap-3 p-2 border rounded cursor-pointer hover:bg-gray-50'><input type='radio' name='offsite_purpose' value='meeting'> <span>ประชุม</span></label>
        <label class='flex items-center gap-3 p-2 border rounded cursor-pointer hover:bg-gray-50'><input type='radio' name='offsite_purpose' value='training'> <span>อบรม</span></label>
        <label class='flex items-center gap-3 p-2 border rounded cursor-pointer hover:bg-gray-50'><input type='radio' name='offsite_purpose' value='official'> <span>ไปราชการ</span></label>
        <input id='offsiteNote' class='w-full p-2 border rounded' placeholder='รายละเอียด (จำเป็น)'>
        <div class='grid grid-cols-2 gap-3'><button id='cancelOffsite' class='btn'>ยกเลิก</button><button id='confirmOffsite' class='btn btn-prim'>บันทึก</button></div>
      </div>`);
    document.getElementById('cancelOffsite').onclick=()=>{ closeSheet(); resolve(false); };
    document.getElementById('confirmOffsite').onclick=async()=>{
      const sel=document.querySelector('input[name="offsite_purpose"]:checked'); const note=(document.getElementById('offsiteNote').value||'').trim();
      if(!sel) return showCheckinStatus('กรุณาเลือกเหตุผล','warning');
      if(!note) return showCheckinStatus('กรุณาระบุรายละเอียด','warning');
      closeSheet();
      const profile=JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
      const {lat:sl,lng:sg}=CheckinState.geoConfig; const d=dist(sl,sg,CheckinState.lastGeo.lat,CheckinState.lastGeo.lng);
      await saveCheckin({ method:'gps', within:false, purpose:sel.value, note, distance:d, profile });
      resolve(true);
    };
  });
}

async function saveCheckin({method,within,purpose,note,distance,profile}){
  try{
    const status = within ? statusFromTime() : 'offsite';
    const payload = {
      line_user_id: profile?.userId || null,
      line_display_name: profile?.displayName || null,
      line_picture_url: profile?.pictureUrl || null,
      method, purpose, status, note,
      lat: Number(CheckinState.lastGeo.lat)||null,
      lng: Number(CheckinState.lastGeo.lng)||null,
      accuracy: Number(CheckinState.lastGeo.accuracy)||0,
      distance_m: Math.round(distance||0),
      within_radius: !!within
    };
    Object.keys(payload).forEach(k=>{ if(payload[k]===undefined || (typeof payload[k]==='number' && !isFinite(payload[k]))) delete payload[k]; });
    const { data, error } = await supabase.from('checkins').insert(payload).select('id,created_at').single();
    if(error) throw error;
    CheckinState.isCheckingin=false;
    const time=new Date(data.created_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
    openSheet(`<div class='text-center space-y-4'>
      <div class='text-5xl'>${within?'✅':'📍'}</div>
      <div class='font-semibold text-xl'>เช็คอินสำเร็จ!</div>
      <div class='space-y-2 p-4 bg-gray-50 rounded-lg text-sm'>
        <div class='grid grid-cols-2 gap-2'>
          <div class='text-gray-600'>เวลา:</div><div class='font-medium'>${time}</div>
          <div class='text-gray-600'>ประเภท:</div><div class='font-medium'>${purposeLabel(purpose)}</div>
          <div class='text-gray-600'>ระยะห่าง:</div><div class='font-medium'>${fmtDist(distance)}</div>
          <div class='text-gray-600'>สถานะ:</div><div class='font-medium ${within?(status==='on_time'?'text-green-600':'text-yellow-600'):'text-blue-600'}'>${within?(status==='on_time'?'ตรงเวลา':'สาย'):'นอกสถานที่'}</div>
        </div>
      </div>
      <button id='okSuccess' class='btn btn-prim w-full'>เสร็จสิ้น</button>
    </div>`);
    document.getElementById('okSuccess').onclick=closeSheet;
    showCheckinStatus('บันทึกเช็คอินเรียบร้อย ✅','success');
    await loadToday(); await renderSummary();
    document.dispatchEvent(new CustomEvent('appwd:checkinSaved',{detail:{checkinId:data.id}}));
  }catch(e){ console.error(e); CheckinState.isCheckingin=false; showCheckinStatus('เช็คอินไม่สำเร็จ','error'); }
}

// Render
export async function initTabs(){ document.querySelectorAll('[data-ci-tab]').forEach(b=>b.classList.remove('btn-prim')); const def=document.querySelector('[data-ci-tab="work"]'); if(def) def.classList.add('btn-prim'); }
export async function render(){
  await loadGeoConfig();
  try{ const p=parseHashParams(); if(p.get('all')==='today') CheckinState.setScope('all'); }catch(_){}
  ensureLoginForActions(); setupCheckinFilterBar(); setupButtonHandlers(); initMap();
  const geoState=document.getElementById('geoState'); if(geoState) getGeoLocation(geoState).catch(()=>{});
  await loadToday(); await renderSummary();
}

function setupButtonHandlers(){
  const ids=['btnOpenScanner','btnCloseScanner','btnRefreshGeo','btnGpsOnly','btnCheckin'];
  ids.forEach(id=>{ const el=document.getElementById(id); if(el) el.replaceWith(el.cloneNode(true)); });
  const btnOpenScanner=document.getElementById('btnOpenScanner');
  const btnCloseScanner=document.getElementById('btnCloseScanner');
  const btnRefreshGeo=document.getElementById('btnRefreshGeo');
  const btnGpsOnly=document.getElementById('btnGpsOnly');
  const btnCheckin=document.getElementById('btnCheckin');
  if(btnOpenScanner) btnOpenScanner.onclick=()=>openScanner();
  if(btnCloseScanner) btnCloseScanner.onclick=()=>closeScanner();
  if(btnRefreshGeo) btnRefreshGeo.onclick=()=>{ const el=document.getElementById('geoState'); if(el) getGeoLocation(el,{showLoading:true}).catch(console.error); };
  if(btnGpsOnly) btnGpsOnly.onclick=()=>doCheckin('gps');
  if(btnCheckin) btnCheckin.onclick=()=>doCheckin('gps');
}

// Home Recent
export async function renderHomeRecent(kind){
  const box=document.getElementById('homeCheckins'); if(!box) return;
  box.innerHTML=skel(5,'52px');
  const start=new Date(); start.setHours(0,0,0,0);
  const end=new Date(); end.setHours(23,59,59,999);
  let q=supabase.from('checkins').select('id,line_display_name,line_picture_url,created_at,distance_m,within_radius,purpose,status').gte('created_at',start.toISOString()).lt('created_at',new Date(end.getTime()+1).toISOString()).order('created_at',{ascending:false}).limit(5);
  q=(kind && kind!=='work')?q.eq('purpose',kind):q.eq('purpose','work');
  const { data, error } = await q;
  if(error){ box.innerHTML='<div class="text-ink3">โหลดเช็คอินไม่สำเร็จ</div>'; return; }
  document.querySelectorAll('[data-ci-tab]').forEach(b=>b.classList.toggle('btn-prim', b.getAttribute('data-ci-tab')===(kind||'work')));
  if(!data||!data.length){ box.innerHTML='<div class="text-ink3">ยังไม่มีรายการ</div>'; return; }
  box.innerHTML=data.map(r=>{
    const time=new Date(r.created_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
    const badge=r.status?(r.status==='on_time'?'<span class="badge badge-ontime">ตรงเวลา</span>':r.status==='late'?'<span class="badge badge-late">สาย</span>':'<span class="badge badge-offsite">นอกพื้นที่</span>'):'';
    return `<div class='card p-3 flex items-center gap-3 hover:shadow-md transition-shadow'>
      <img src='${r.line_picture_url || '/assets/default-avatar.png'}' class='w-10 h-10 rounded-full border object-cover' onerror="this.src='/assets/default-avatar.png'">
      <div class='flex-1 min-w-0'>
        <div class='font-medium truncate'>${r.line_display_name||'ไม่ระบุ'}</div>
        <div class='text-sm text-ink3 flex items-center gap-2 ci-badges'><span>${time}</span><span>•</span><span>${purposeLabel(r.purpose)}</span>${badge}</div>
      </div>
      <div class='text-sm ${r.within_radius?'text-green-600':'text-red-600'} font-medium'>${fmtDist(r.distance_m||0)}</div>
    </div>`;
  }).join('');
}

// Home Summary
export async function renderHomeSummary(){
  const box=document.getElementById('homeSummary'); if(!box) return;
  box.innerHTML=skel(4,'64px');
  const start=new Date(); start.setHours(0,0,0,0);
  const end=new Date(); end.setHours(23,59,59,999);
  const purposes=['work','meeting','training','official']; const counts={work:0,meeting:0,training:0,official:0};
  for(const p of purposes){ const {count}=await supabase.from('checkins').select('id',{count:'exact',head:true}).gte('created_at',start.toISOString()).lt('created_at',new Date(end.getTime()+1).toISOString()).eq('purpose',p); counts[p]=count||0; }
  const tile=(label,val,color='text-blue-600')=>`<div class='card p-4 text-center hover:shadow-md transition-shadow'><div class='text-2xl font-bold ${color} mb-1'>${val}</div><div class='text-sm text-ink3'>${label}</div></div>`;
  box.innerHTML=[tile('มาทำงาน',counts.work,'text-green-600'),tile('ประชุม',counts.meeting),tile('อบรม',counts.training,'text-purple-600'),tile('ไปราชการ',counts.official,'text-orange-600')].join('');
}

// Today list
async function loadToday(){
  const profile=JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  const box=document.getElementById('todayList'); if(!box) return;
  box.innerHTML=skel(3,'60px');
  if(!profile||!profile.userId){ box.innerHTML='<div class="text-ink3 text-center py-4">ยังไม่เข้าสู่ระบบ</div>'; return; }
  const start=new Date(); start.setHours(0,0,0,0);
  const end=new Date(); end.setHours(23,59,59,999);
  const admin=await checkIsAdmin();
  let q=supabase.from('checkins').select('*').gte('created_at',start.toISOString()).lt('created_at',new Date(end.getTime()+1).toISOString());
  if(CheckinState.scope==='mine') q=q.eq('line_user_id', profile.userId);
  const { data, error } = await q.order('created_at',{ascending:false}).limit(200);
  if(error){ box.innerHTML='<div class="text-red-600 text-center py-4">โหลดข้อมูลไม่สำเร็จ</div>'; return; }
  if(!data||!data.length){ box.innerHTML='<div class="text-ink3 text-center py-4">ยังไม่มีรายการวันนี้</div>'; return; }
  box.innerHTML=data.map(r=>{
    const time=new Date(r.created_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
    const canEdit = (admin || (!r.within_radius && r.purpose!=='work' && profile?.userId && r.line_user_id===profile.userId));
    const editBtn = canEdit ? `<button class='btn btn-sm text-blue-600' onclick='editOffsite(${r.id}, "${r.purpose||''}", ${JSON.stringify(r.note||'').replace(/"/g,'&quot;')})'>แก้ไข</button>` : '';
    const delBtn = admin ? `<button class='btn btn-sm text-red-600' onclick='deleteCheckin(${r.id})'>ลบ</button>` : '';
    const badge = r.status ? (r.status==='on_time' ? '<span class="badge badge-ontime">ตรงเวลา</span>' : r.status==='late' ? '<span class="badge badge-late">สาย</span>' : '<span class="badge badge-offsite">นอกพื้นที่</span>') : '';
    return `<div class='card p-3 space-y-2'>
      <div class='flex items-center gap-3'>
        <img src='${r.line_picture_url || "/assets/default-avatar.png"}' class='w-10 h-10 rounded-full border object-cover' onerror="this.src='/assets/default-avatar.png'">
        <div class='flex-1 min-w-0'>
          <div class='font-medium truncate'>${r.line_display_name || 'ไม่ระบุ'}</div>
          <div class='text-sm text-ink3'>${time} • ${purposeLabel(r.purpose)}${r.note?' • '+r.note:''}</div>
        </div>
        <div class='text-sm ${r.within_radius?'text-green-600':'text-red-600'} font-medium'>${fmtDist(r.distance_m||0)}</div>
      </div>
      <div class='flex items-center justify-between'>
        <div class='flex items-center gap-2 ci-badges'>${badge}</div>
        <div class='flex items-center gap-2'>${editBtn}${delBtn}</div>
      </div>
    </div>`;
  }).join('');
}

// Summary with positive tone & 3 cols layout
async function renderSummary(){
  const box=document.getElementById('checkinSummary'); if(!box) return;
  box.innerHTML=skel(6,'80px');
  const profile=JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  const now=new Date();
  const weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
  const yearStart=new Date(now.getFullYear(),0,1);
  async function stats(since,scope='org'){
    let q=supabase.from('checkins').select('purpose,status,line_user_id,created_at').gte('created_at',since.toISOString()).lte('created_at',now.toISOString());
    if(scope==='me' && profile?.userId) q=q.eq('line_user_id', profile.userId);
    const {data}=await q; const s={work:0,meeting:0,training:0,official:0,ontime:0,late:0,total:0};
    (data||[]).forEach(r=>{ s.total++; if(s.hasOwnProperty(r.purpose)) s[r.purpose]++; if(r.purpose==='work'){ if(r.status==='on_time') s.ontime++; else if(r.status==='late') s.late++; } });
    return s;
  }
  const [meW,meM,meY,orgW,orgM,orgY]=await Promise.all([stats(weekStart,'me'),stats(monthStart,'me'),stats(yearStart,'me'),stats(weekStart,'org'),stats(monthStart,'org'),stats(yearStart,'org')]);

  function card(title,st,type='personal'){
    const col = type==='personal' ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50';
    const titleColor = type==='personal' ? 'text-blue-800' : 'text-green-800';
    return `<div class='card p-4 ${col} hover:shadow-md transition-all duration-200'>
      <div class='text-sm font-semibold mb-3 ${titleColor}'>${title}</div>
      <div class='grid grid-cols-2 gap-3 text-sm'>
        <div class='flex justify-between'><span class='text-gray-600'>มาทำงาน</span><span class='font-semibold text-green-700'>${st.work||0}</span></div>
        <div class='flex justify-between'><span class='text-gray-600'>ประชุม</span><span class='font-semibold text-blue-700'>${st.meeting||0}</span></div>
        <div class='flex justify-between'><span class='text-gray-600'>อบรม</span><span class='font-semibold text-purple-700'>${st.training||0}</span></div>
        <div class='flex justify-between'><span class='text-gray-600'>ไปราชการ</span><span class='font-semibold text-orange-700'>${st.official||0}</span></div>
      </div>
      <div class='mt-3 pt-3 border-t border-gray-200'>
        <div class='flex justify-between text-xs text-gray-500'><span>รวมทั้งหมด</span><span class='font-semibold'>${st.total||0} ครั้ง</span></div>
      </div>
    </div>`;
  }

  const total = (meM.ontime||0)+(meM.late||0);
  let encouragement='';
  if(total>0){
    const pct=Math.round((meM.ontime||0)*100/total);
    let msg='', bg='bg-blue-50', text='text-blue-800';
    if(pct>=90){ msg='สุดยอด! คุณรักษาความตรงเวลาได้ดีมาก รักษามาตรฐานนี้ไว้ 👍'; bg='bg-green-50'; text='text-green-800'; }
    else if(pct>=75){ msg='ดีมาก! ใกล้แตะ 90% แล้ว ลองตั้งเป้าเพิ่มอีกนิด คุณทำได้ ✨'; bg='bg-sky-50'; text='text-sky-800'; }
    else if(pct>=50){ msg='แนวโน้มกำลังดีขึ้น ลองวางแผนเวลาออกจากบ้านให้เร็วขึ้นอีกเล็กน้อย 😊'; bg='bg-yellow-50'; text='text-yellow-800'; }
    else { msg='เริ่มต้นได้ดีแล้ว! ตั้งเป้าเล็ก ๆ เช่น ตื่นก่อนเดิม 10 นาที แล้วค่อย ๆ เพิ่ม 💪'; bg='bg-blue-50'; text='text-blue-800'; }
    encouragement = `<div class='card p-4 ${bg} border-l-4 border-current mt-4'>
      <div class='font-semibold mb-2 ${text}'>สถิติการมาทำงานเดือนนี้</div>
      <div class='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3'>
        <div class='text-center'><div class='text-2xl font-bold text-green-600'>${meM.ontime||0}</div><div class='text-gray-600'>ตรงเวลา</div></div>
        <div class='text-center'><div class='text-2xl font-bold text-yellow-600'>${meM.late||0}</div><div class='text-gray-600'>มาสาย</div></div>
        <div class='text-center'><div class='text-2xl font-bold text-blue-600'>${total}</div><div class='text-gray-600'>รวม</div></div>
        <div class='text-center'><div class='text-2xl font-bold ${pct>=75?'text-green-600':'text-sky-600'}'>${pct}%</div><div class='text-gray-600'>ตรงเวลา</div></div>
      </div>
      <div class='text-sm ${text}'>${msg}</div>
    </div>`;
  }

  box.innerHTML=`
    <div class='space-y-8'>
      <div class='space-y-4'>
        <h3 class='text-lg font-semibold text-blue-800 border-b border-blue-200 pb-2'>📊 สถิติของฉัน</h3>
        <div class='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          ${card('สัปดาห์นี้',meW,'personal')}
          ${card('เดือนนี้',meM,'personal')}
          ${card('ปีนี้',meY,'personal')}
        </div>
      </div>
      <div class='space-y-4'>
        <h3 class='text-lg font-semibold text-green-800 border-b border-green-200 pb-2'>🏢 สถิติองค์กร</h3>
        <div class='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          ${card('สัปดาห์นี้',orgW,'organization')}
          ${card('เดือนนี้',orgM,'organization')}
          ${card('ปีนี้',orgY,'organization')}
        </div>
      </div>
      ${encouragement}
    </div>`;
}

// globals
window.editOffsite=function(id,purpose,note){
  openSheet(`<div class='space-y-4'>
    <div class='text-center'><div class='text-2xl mb-2'>✏️</div><div class='font-semibold text-lg'>แก้ไขภารกิจนอกสถานที่</div></div>
    <div class='space-y-3'>
      <div class='font-medium'>เลือกประเภทภารกิจ:</div>
      <div class='space-y-2'>
        <label class='flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50'><input type='radio' name='edit_purpose' value='meeting' ${purpose==='meeting'?'checked':''}> <span>ประชุม</span></label>
        <label class='flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50'><input type='radio' name='edit_purpose' value='training' ${purpose==='training'?'checked':''}> <span>อบรม</span></label>
        <label class='flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50'><input type='radio' name='edit_purpose' value='official' ${purpose==='official'?'checked':''}> <span>ไปราชการ</span></label>
      </div>
      <textarea id='editOffsiteNote' class='w-full p-3 border rounded-lg resize-none' rows='3' placeholder='รายละเอียดเพิ่มเติม'>${note||''}</textarea>
      <div class='grid grid-cols-2 gap-3 pt-2'><button id='cancelEditOffsite' class='btn'>ยกเลิก</button><button id='confirmEditOffsite' class='btn btn-prim'>บันทึก</button></div>
    </div>`);
  document.getElementById('cancelEditOffsite').onclick=closeSheet;
  document.getElementById('confirmEditOffsite').onclick=async()=>{
    const sel=document.querySelector('input[name="edit_purpose"]:checked'); const v=(document.getElementById('editOffsiteNote').value||'').trim();
    if(!sel) return showCheckinStatus('กรุณาเลือกประเภทภารกิจ','warning');
    if(!v) return showCheckinStatus('กรุณาระบุรายละเอียด','warning');
    const { error } = await supabase.from('checkins').update({purpose:sel.value,note:v,updated_at:new Date().toISOString()}).eq('id',id);
    if(error){ showCheckinStatus('บันทึกไม่สำเร็จ','error'); } else { closeSheet(); showCheckinStatus('อัปเดตข้อมูลสำเร็จ ✅','success'); await loadToday(); }
  };
};
window.deleteCheckin=function(id){
  openSheet(`<div class='text-center space-y-4'><div class='text-4xl text-red-500'>🗑️</div><div class='font-semibold text-lg'>ยืนยันการลบเช็คอิน</div><div class='grid grid-cols-2 gap-3 pt-2'><button id='cancelDelete' class='btn'>ยกเลิก</button><button id='confirmDelete' class='btn bg-red-500 text-white border-red-500 hover:bg-red-600'>ลบเลย</button></div></div>`);
  document.getElementById('cancelDelete').onclick=closeSheet;
  document.getElementById('confirmDelete').onclick=async()=>{
    const { error } = await supabase.from('checkins').delete().eq('id',id);
    if(error){ showCheckinStatus('ลบไม่สำเร็จ','error'); } else { closeSheet(); showCheckinStatus('ลบเช็คอินสำเร็จ','success'); await loadToday(); }
  };
};
window.reloadSummary=function(){ renderSummary().catch(console.error); };

export function cleanup(){ CheckinState.cleanup(); const s=document.getElementById('checkinStatus'); if(s) s.remove(); delete window.editOffsite; delete window.deleteCheckin; delete window.reloadSummary; }

window.addEventListener('beforeunload', cleanup);
window.addEventListener('hashchange', ()=>{ if(!location.hash.includes('checkin')) cleanup(); });

function applyCheckinLatestSlider(){ try{ const box=document.getElementById('checkinLatest'); if(!box) return; const small=window.matchMedia && window.matchMedia('(max-width: 640px)').matches; box.classList.toggle('slider', small); box.classList.toggle('slider-x', small);}catch(_){ } }
window.addEventListener('resize', applyCheckinLatestSlider);
document.addEventListener('DOMContentLoaded', applyCheckinLatestSlider);
document.addEventListener('appwd:checkinSaved', applyCheckinLatestSlider);

// Scoped badge CSS (only inside .ci-badges)
(function injectStyles(){
  try{
    const old=document.getElementById('checkin-enhanced-styles'); if(old) old.remove();
    const st=document.createElement('style'); st.id='checkin-enhanced-styles'; st.textContent=`
      @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
      .animate-spin { animation: spin 1s linear infinite; }
      .ci-badges .badge { display:inline-flex !important; align-items:center; gap:0.25rem; padding:0.125rem 0.5rem; border-radius:9999px; font-size:0.75rem; font-weight:600; line-height:1; border:1px solid transparent; }
      .ci-badges .badge.badge-ontime { background-color:#dcfce7 !important; color:#166534 !important; border-color:rgba(16,185,129,0.25) !important; }
      .ci-badges .badge.badge-late   { background-color:#fef3c7 !important; color:#92400e !important; border-color:rgba(245,158,11,0.25) !important; }
      .ci-badges .badge.badge-offsite{ background-color:#e0e7ff !important; color:#3730a3 !important; border-color:rgba(99,102,241,0.25) !important; }
      #map{position:relative;border-radius:14px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);}
      .leaflet-container{z-index:1;}
      #qrReader{border-radius:14px;overflow:hidden;}
      #qrReader canvas,#qrReader video{border-radius:14px !important;}
    `; document.head.appendChild(st);
  }catch(e){ console.warn('style inject failed', e); }
})();
