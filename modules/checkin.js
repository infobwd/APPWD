import { supabase } from '../api.js';
import { SCHOOL_LAT,SCHOOL_LNG,SCHOOL_RADIUS_METERS, CHECKIN_START, CHECKIN_ON_TIME_UNTIL, SUMMARY_DEFAULT_RANGE_DAYS } from '../config.js';
import { toast, skel, openSheet, closeSheet } from '../ui.js';

// ==== Checkin View Scope (all vs mine) ====
let checkinScope = 'mine'; // default

function parseHashParams(){
  try{
    const h = location.hash || '';
    const q = h.includes('?') ? h.split('?')[1] : '';
    return new URLSearchParams(q);
  }catch(_){ return new URLSearchParams(''); }
}

function setupCheckinFilterBar(){
  const bar = document.getElementById('checkinFilterBar');
  if(!bar) return;
  bar.innerHTML = `
    <div class="seg" id="chkScopeSeg">
      <button data-scope="all" class="btn sm ${checkinScope==='all'?'btn-prim':''}">ทั้งหมด (วันนี้)</button>
      <button data-scope="mine" class="btn sm ${checkinScope==='mine'?'btn-prim':''}">ของฉัน (วันนี้)</button>
    </div>
  `;
  bar.querySelectorAll('[data-scope]').forEach(btn=>{
    btn.onclick = ()=>{
      checkinScope = btn.getAttribute('data-scope');
      // toggle UI state
      bar.querySelectorAll('[data-scope]').forEach(b=>b.classList.remove('btn-prim'));
      btn.classList.add('btn-prim');
      loadToday();
    };
  });
}

function ensureLoginForActions(){
  const lpStr = localStorage.getItem('LINE_PROFILE');
  const lp = lpStr ? JSON.parse(lpStr) : null;
  const need = !lp || !lp.userId;
  const btnGps = document.getElementById('btnGpsOnly');
  const btnScan = document.getElementById('btnOpenScanner');
  const btnCheck = document.getElementById('btnCheckin');
  if(need){
    [btnGps, btnScan, btnCheck].forEach(b=>{ if(b){ b.setAttribute('disabled','disabled'); b.classList.add('opacity-60','cursor-not-allowed'); }});
    // Inject banner once
    const parentCard = document.querySelector('#checkinView .card');
    if(parentCard && !document.getElementById('loginWarn')){
      const warn = document.createElement('div');
      warn.id = 'loginWarn';
      warn.className = 'p-2 rounded-md bg-yellow-50 border text-sm text-yellow-800';
      warn.style.borderColor = 'var(--bd)';
      warn.innerHTML = 'กรุณาเข้าสู่ระบบด้วย LINE ก่อนจึงจะเช็คอินได้';
      parentCard.insertBefore(warn, parentCard.children[1]);
    }
  }else{
    [btnGps, btnScan, btnCheck].forEach(b=>{ if(b){ b.removeAttribute('disabled'); b.classList.remove('opacity-60','cursor-not-allowed'); }});
    const warn = document.getElementById('loginWarn');
    if(warn) warn.remove();
  }
}

let lastText=null,lastGeo=null,map=null,meMarker=null,scanner=null;
function fmtDist(m){ if(m>=1000) return (m/1000).toFixed(2)+' km'; return Math.round(m)+' m'; }
function toMinutes(t){ const [h,m]=t.split(':').map(Number); return h*60+m; }
function nowMinutes(){ const d=new Date(); return d.getHours()*60+d.getMinutes(); }
function statusFromTime(){ const n=nowMinutes(), ok=toMinutes(CHECKIN_ON_TIME_UNTIL); return n<=ok?'on_time':'late'; }
function purposeLabel(p){ return p==='work'?'มาทำงาน': p==='meeting'?'ประชุม': p==='training'?'อบรม': p==='official'?'ไปราชการ':'อื่น ๆ'; }
export async function initTabs(){ document.querySelectorAll('[data-ci-tab]').forEach(b=>b.classList.remove('btn-prim')); const def=document.querySelector('[data-ci-tab="work"]'); if(def) def.classList.add('btn-prim'); }
export async function render(){
  // Determine scope from hash
  try{ const p = parseHashParams(); checkinScope = (p.get('all')==='today') ? 'all' : 'mine'; }catch(_){}
  ensureLoginForActions();
  setupCheckinFilterBar(); const btnGps=document.getElementById('btnGpsOnly'), btnScan=document.getElementById('btnOpenScanner'), btnCheck=document.getElementById('btnCheckin'), btnRefresh=document.getElementById('btnRefreshGeo'), btnClose=document.getElementById('btnCloseScanner'); const geoState=document.getElementById('geoState'); initMap(); getGeo(geoState); if(btnScan) btnScan.onclick=openScanner; if(btnClose) btnClose.onclick=closeScanner; if(btnRefresh) btnRefresh.onclick=()=>getGeo(geoState); if(btnGps) btnGps.onclick=()=>doCheckin('gps'); if(btnCheck) btnCheck.onclick = () => openScanner(); await loadToday(); await renderSummary(); }
export async function renderHomeRecent(kind){ const box=document.getElementById('homeCheckins'); if(!box)return; box.innerHTML=skel(5,'52px'); const start=new Date(); start.setHours(0,0,0,0);
const end=new Date(); end.setHours(23,59,59,999);
const q=supabase.from('checkins').select('id,line_display_name,line_picture_url,created_at,distance_m,within_radius,purpose,status').gte('created_at', start.toISOString()).lt('created_at', new Date(end.getTime()+1).toISOString()).order('created_at',{ascending:false}).limit(5); const resp=(kind && kind!=='work')?await q.eq('purpose',kind):await q.eq('purpose','work'); if(resp.error){ box.innerHTML='<div class="text-ink3">โหลดเช็คอินไม่สำเร็จ</div>'; return; } const data=resp.data||[]; document.querySelectorAll('[data-ci-tab]').forEach(b=>b.classList.toggle('btn-prim', b.getAttribute('data-ci-tab')===(kind||'work'))); box.innerHTML=data.map(r=>`<div class='p-2 border rounded-lg flex items-center gap-2 bg-[var(--card)]' style='border-color:var(--bd)'><img src='${r.line_picture_url||''}' class='w-8 h-8 rounded-full border' onerror="this.style.display='none'"><div class='flex-1 min-w-0'><div class='text-sm font-medium truncate' style='color:var(--ink)'>${r.line_display_name||'ไม่ระบุ'}</div><div class='text-[12px] text-ink3'>${new Date(r.created_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} • ${purposeLabel(r.purpose)}${r.status?(' • '+(r.status==='on_time'?'ตรงเวลา':(r.status==='late'?'สาย':'นอกพื้นที่'))):''}</div></div><div class='${r.within_radius?'text-green-600':'text-red-600'} text-[12px]'>${fmtDist(r.distance_m||0)}</div></div>`).join('')||'<div class="text-ink3">ยังไม่มีรายการ</div>'; }
export async function renderHomeSummary(){
  const box=document.getElementById('homeSummary');
  if(!box) return;
  box.innerHTML=skel(4,'64px');
  const start=new Date(); start.setHours(0,0,0,0);
  const end=new Date(); end.setHours(23,59,59,999);
  const m={ work:0, meeting:0, training:0, official:0 };
  try{
    await Promise.all(['work','meeting','training','official'].map(async (p)=>{
      const { count, error } = await supabase
        .from('checkins')
        .select('id',{ count:'exact', head:true })
        .gte('created_at', start.toISOString())
        .lt('created_at', new Date(end.getTime()+1).toISOString())
        .eq('purpose', p);
      if(!error) m[p] = count||0;
    }));
  }catch(_){}
  const tile=(label,val)=>`<div class='p-3 border rounded-xl bg-[var(--card)]' style='border-color:var(--bd)'><div class='text-[12px] text-ink3'>${label}</div><div class='text-xl font-semibold' style='color:var(--ink)'>${val||0}</div></div>`;
  box.innerHTML=[tile('มาทำงาน',m.work),tile('ประชุม',m.meeting),tile('อบรม',m.training),tile('ไปราชการ',m.official)].join('');
}
function initMap(){ const el=document.getElementById('map'); if(!el) return; if(map){ map.remove(); map=null; } map=L.map('map').setView([SCHOOL_LAT,SCHOOL_LNG],16); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map); L.circle([SCHOOL_LAT,SCHOOL_LNG],{radius:SCHOOL_RADIUS_METERS,color:'#2563EB',fillOpacity:0.08}).addTo(map); L.marker([SCHOOL_LAT,SCHOOL_LNG]).addTo(map).bindPopup('โรงเรียน'); }
function updateMeMarker(lat,lng){ if(!map) return; if(!meMarker){ meMarker=L.marker([lat,lng]).addTo(map).bindPopup('ตำแหน่งของฉัน'); } else { meMarker.setLatLng([lat,lng]); } }
function getGeo(out){ out.textContent='กำลังอ่านตำแหน่ง…'; if(!navigator.geolocation){ out.textContent='อุปกรณ์ไม่รองรับตำแหน่ง'; return; } navigator.geolocation.getCurrentPosition((pos)=>{ const {latitude,longitude,accuracy}=pos.coords; lastGeo={lat:latitude,lng:longitude,accuracy:accuracy||0}; updateMeMarker(latitude,longitude); const d=dist(SCHOOL_LAT,SCHOOL_LNG,latitude,longitude); const ok=d<=SCHOOL_RADIUS_METERS; out.innerHTML=`ตำแหน่ง: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy||0)}m) → ${ok?'<span class="text-green-600">ในเขต</span>':'<span class="text-red-600">นอกเขต ('+Math.round(d)+'m)'}`; }, (err)=>{ out.textContent='อ่านตำแหน่งไม่สำเร็จ: '+(err?.message||err); }, {enableHighAccuracy:true,timeout:8000,maximumAge:0}); }
function dist(a,b,c,d){ const R=6371000; const toR=x=>x*Math.PI/180; const dLat=toR(c-a), dLon=toR(d-b); const A=Math.sin(dLat/2)**2 + Math.cos(toR(a))*Math.cos(toR(c))*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(A)); }
async function openScanner(){ const panel=document.getElementById('scanPanel'); const holder=document.getElementById('qrReader'); if(!panel||!holder) return; panel.classList.remove('hide'); holder.innerHTML=''; try{ scanner=new Html5Qrcode('qrReader'); await scanner.start({facingMode:'environment'},{fps:10,qrbox:240}, t=>{ lastText=t; const res=document.getElementById('scanResult'); if(res) res.textContent='QR: '+t; }); }catch(e){ holder.innerHTML='<div class="p-4 text-sm text-red-600">ไม่สามารถเปิดกล้อง: '+(e?.message||e)+'</div>'; } }
async function closeScanner(){ const panel=document.getElementById('scanPanel'); if(panel) panel.classList.add('hide'); if(scanner){ try{ await scanner.stop(); }catch{} try{ await scanner.clear(); }catch{} scanner=null; } }
async function doCheckin(method){ const profile=JSON.parse(localStorage.getItem('LINE_PROFILE')||'null'); if(!profile){ toast('ต้องเข้าสู่ระบบด้วย LINE ก่อน'); return; } if(!lastGeo){ toast('ยังไม่ได้ตำแหน่ง (กดอ่านตำแหน่งอีกครั้ง)'); return; } const distance=dist(SCHOOL_LAT,SCHOOL_LNG,lastGeo.lat,lastGeo.lng); const within=distance<=SCHOOL_RADIUS_METERS; let purpose='work'; let note=null; if(!within){ openSheet(`<div class='text-sm space-y-2'><div class='font-semibold'>อยู่นอกเขตโรงเรียน — ระบุเหตุผล</div><label class='flex items-center gap-2'><input type='radio' name='p' value='meeting'> ประชุม</label><label class='flex items-center gap-2'><input type='radio' name='p' value='training'> อบรม</label><label class='flex items-center gap-2'><input type='radio' name='p' value='official'> ไปราชการ</label><input id='pWork' class='border rounded p-2 w-full' placeholder='หัวข้อ/หน่วยงาน/ภารกิจ'><div class='grid grid-cols-2 gap-2'><button id='okOut' class='btn btn-prim'>บันทึก</button><button id='cancelOut' class='btn'>ยกเลิก</button></div></div>`); document.getElementById('cancelOut').onclick=closeSheet; document.getElementById('okOut').onclick=async()=>{ const sel=document.querySelector('input[name="p"]:checked'); const desc=document.getElementById('pWork').value.trim(); if(!sel){ toast('กรุณาเลือกเหตุผล'); return; } if(!desc){ toast('กรุณากรอกรายละเอียด'); return; } purpose=sel.value; note=desc; closeSheet(); await saveCheckin({method,within,purpose,note,distance}); }; return; } purpose='work'; note=lastText||null; await saveCheckin({method,within,purpose,note,distance}); }
async function saveCheckin({method,within,purpose,note,distance}){ const profile=JSON.parse(localStorage.getItem('LINE_PROFILE')||'null'); const status=within?statusFromTime():'offsite'; const payload={ line_user_id:profile?.userId||null, line_display_name:profile?.displayName||null, line_picture_url:profile?.pictureUrl||null, method, purpose, status, note, lat:Number(lastGeo.lat)||null, lng:Number(lastGeo.lng)||null, accuracy:Number(lastGeo.accuracy)||0, distance_m:Math.round(distance||0), within_radius:!!within }; Object.keys(payload).forEach(k=>{ if(payload[k]===undefined || (typeof payload[k]==='number' && !isFinite(payload[k])) ) delete payload[k]; }); const ins=await supabase.from('checkins').insert(payload).select('id').single(); if(ins.error){ console.warn(ins.error); toast('เช็คอินไม่สำเร็จ'); return; } toast(within?'เช็คอินสำเร็จ ✅':'บันทึกภารกิจนอกสถานที่ ✅'); await loadToday(); await renderSummary(); }
async function loadToday(){  const profile = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
const box=document.getElementById('todayList'); if(!box)return; box.innerHTML=''; if(!profile){ box.innerHTML='<div class="text-ink3">ยังไม่เข้าสู่ระบบ</div>'; return; } const start=new Date(); start.setHours(0,0,0,0); const baseQuery = supabase.from('checkins').select('*').gte('created_at', start.toISOString()).lt('created_at', new Date(end.getTime()+1).toISOString());
  const query = (checkinScope==='mine' && profile?.userId) ? baseQuery.eq('line_user_id', profile.userId) : baseQuery;
  const resp = await query.order('created_at',{ascending:false}).limit(200); const data=resp.data||[]; box.innerHTML=data.map(r=>{ const canEdit=(!r.within_radius); const editBtn=canEdit?`<button class='btn text-xs' onclick='editOffsite(${r.id}, "${r.purpose||''}", ${JSON.stringify(r.note||'').replace(/"/g,'&quot;')})'>แก้ไข</button>`:''; return `<div class='p-2 border rounded-lg flex items-center gap-2 text-sm bg-[var(--card)]' style='border-color:var(--bd)'><img src='${r.line_picture_url||''}' class='w-8 h-8 rounded-full border' onerror="this.style.display='none'"><div class='flex-1'>${new Date(r.created_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} — ${purposeLabel(r.purpose)}${r.note?' • '+r.note:''} ${r.status ? ' • ' + (r.status==='on_time'?'ตรงเวลา': (r.status==='late'?'สาย':'นอกสถานที่')) : ''}</div><div class='${r.within_radius?'text-green-600':'text-red-600'}'>${fmtDist(r.distance_m||0)}</div>${editBtn}</div>`; }).join('')||'<div class="text-ink3">ยังไม่มีรายการวันนี้</div>'; }
window.editOffsite=function(id,purpose,note){ openSheet(`<div class='text-sm space-y-2'><div class='font-semibold'>แก้ไขภารกิจนอกสถานที่ (วันนี้)</div><label class='flex items-center gap-2'><input type='radio' name='p' value='meeting' ${purpose==='meeting'?'checked':''}> ประชุม</label><label class='flex items-center gap-2'><input type='radio' name='p' value='training' ${purpose==='training'?'checked':''}> อบรม</label><label class='flex items-center gap-2'><input type='radio' name='p' value='official' ${purpose==='official'?'checked':''}> ไปราชการ</label><input id='pNote' class='border rounded p-2 w-full' placeholder='รายละเอียดงาน' value='${note?String(note).replace(/"/g,'&quot;'):''}'><div class='text-ink3'>* ไม่สามารถแก้ไขเวลาเช็คอินได้</div><div class='grid grid-cols-2 gap-2'><button id='okEditOff' class='btn btn-prim'>บันทึก</button><button id='cancelEditOff' class='btn'>ยกเลิก</button></div></div>`); document.getElementById('cancelEditOff').onclick=closeSheet; document.getElementById('okEditOff').onclick=async()=>{ const sel=document.querySelector('input[name="p"]:checked'); const desc=document.getElementById('pNote').value.trim(); if(!sel){ toast('กรุณาเลือกเหตุผล'); return; } const upd={ purpose:sel.value, note:desc||null }; const res=await supabase.from('checkins').update(upd).eq('id',id); if(res.error){ toast('บันทึกไม่สำเร็จ'); return; } closeSheet(); toast('อัปเดตแล้ว'); await loadToday(); }; }
async function renderSummary(){ const box=document.getElementById('checkinSummary'); if(!box) return; box.innerHTML=skel(3,'64px'); const now=new Date(); const weekStart=new Date(now); weekStart.setDate(now.getDate()-now.getDay()); weekStart.setHours(0,0,0,0); const monthStart=new Date(now.getFullYear(),now.getMonth(),1); const yearStart=new Date(now.getFullYear(),0,1); const [w,m,y]=await Promise.all([ supabase.rpc('summary_counts',{p_since:weekStart.toISOString()}), supabase.rpc('summary_counts',{p_since:monthStart.toISOString()}), supabase.rpc('summary_counts',{p_since:yearStart.toISOString()}) ]); function card(title,obj){ const o=obj.data||{}; return `<div class='p-3 border rounded-xl bg-[var(--card)]' style='border-color:var(--bd)'><div class='text-sm font-semibold mb-2'>${title}</div><div class='grid grid-cols-2 gap-2 text-[13px]'><div>มาทำงาน</div><div class='text-right font-semibold'>${o.work||0}</div><div>ประชุม</div><div class='text-right font-semibold'>${o.meeting||0}</div><div>อบรม</div><div class='text-right font-semibold'>${o.training||0}</div><div>ไปราชการ</div><div class='text-right font-semibold'>${o.official||0}</div></div></div>`; } box.innerHTML=card('สัปดาห์นี้',w)+card('เดือนนี้',m)+card('ปีนี้',y); }

function applyCheckinLatestSlider(){
  try{
    const box = document.getElementById('checkinLatest');
    if(!box) return;
    const isSmall = (typeof matchMedia!=='undefined') && matchMedia('(max-width: 640px)').matches;
    box.classList.toggle('slider', isSmall);
  }catch(_){}
}
window.addEventListener('resize', applyCheckinLatestSlider);
document.addEventListener('DOMContentLoaded', applyCheckinLatestSlider);
document.addEventListener('appwd:checkinSaved', applyCheckinLatestSlider);
