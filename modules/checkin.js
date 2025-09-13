import { supabase } from '../api.js';
import { SCHOOL_LAT,SCHOOL_LNG,SCHOOL_RADIUS_METERS, CHECKIN_START, CHECKIN_ON_TIME_UNTIL, SUMMARY_DEFAULT_RANGE_DAYS } from '../config.js';
import { toast, skel, openSheet, closeSheet } from '../ui.js';
let lastText=null,lastGeo=null,map=null,meMarker=null,scanner=null;
function fmtDist(m){ if(m>=1000) return (m/1000).toFixed(2)+' km'; return Math.round(m)+' m'; }
function toMinutes(t){ const [h,m]=t.split(':').map(Number); return h*60+m; }
function nowMinutes(){ const d=new Date(); return d.getHours()*60+d.getMinutes(); }
function statusFromTime(){ const n=nowMinutes(), ok=toMinutes(CHECKIN_ON_TIME_UNTIL); return n<=ok?'on_time':'late'; }
function purposeLabel(p){ return p==='work'?'มาทำงาน': p==='meeting'?'ประชุม': p==='training'?'อบรม': p==='official'?'ไปราชการ':'อื่น ๆ'; }
export async function initTabs(){ document.querySelectorAll('[data-ci-tab]').forEach(b=>b.classList.remove('btn-prim')); const def=document.querySelector('[data-ci-tab="work"]'); if(def) def.classList.add('btn-prim'); }
export async function render(){ const btnGps=document.getElementById('btnGpsOnly'), btnScan=document.getElementById('btnOpenScanner'), btnCheck=document.getElementById('btnCheckin'), btnRefresh=document.getElementById('btnRefreshGeo'), btnClose=document.getElementById('btnCloseScanner'); const geoState=document.getElementById('geoState'); initMap(); getGeo(geoState); if(btnScan) btnScan.onclick=openScanner; if(btnClose) btnClose.onclick=closeScanner; if(btnRefresh) btnRefresh.onclick=()=>getGeo(geoState); if(btnGps) btnGps.onclick=()=>doCheckin('gps'); if(btnCheck) btnCheck.onclick=()=>doCheckin('qr+gps'); await loadToday(); await renderSummary(); }
export async function renderHomeRecent(kind){ const box=document.getElementById('homeCheckins'); if(!box)return; box.innerHTML=skel(5,'52px'); const q=supabase.from('checkins').select('id,line_display_name,line_picture_url,created_at,distance_m,within_radius,purpose,status').order('created_at',{ascending:false}).limit(5); const resp=(kind && kind!=='work')?await q.eq('purpose',kind):await q.eq('purpose','work'); if(resp.error){ box.innerHTML='<div class="text-ink3">โหลดเช็คอินไม่สำเร็จ</div>'; return; } const data=resp.data||[]; document.querySelectorAll('[data-ci-tab]').forEach(b=>b.classList.toggle('btn-prim', b.getAttribute('data-ci-tab')===(kind||'work'))); box.innerHTML=data.map(r=>`<div class='p-2 border rounded-lg flex items-center gap-2 bg-[var(--card)]' style='border-color:var(--bd)'><img src='${r.line_picture_url||''}' class='w-8 h-8 rounded-full border' onerror="this.style.display='none'"><div class='flex-1 min-w-0'><div class='text-sm font-medium truncate' style='color:var(--ink)'>${r.line_display_name||'ไม่ระบุ'}</div><div class='text-[12px] text-ink3'>${new Date(r.created_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} • ${purposeLabel(r.purpose)}${r.status?(' • '+(r.status==='on_time'?'ตรงเวลา':(r.status==='late'?'สาย':'นอกพื้นที่'))):''}</div></div><div class='${r.within_radius?'text-green-600':'text-red-600'} text-[12px]'>${fmtDist(r.distance_m||0)}</div></div>`).join('')||'<div class="text-ink3">ยังไม่มีรายการ</div>'; }
export async function renderHomeSummary(){ const box=document.getElementById('homeSummary'); if(!box) return; box.innerHTML=skel(4,'64px'); const since=new Date(); since.setDate(since.getDate()-SUMMARY_DEFAULT_RANGE_DAYS); const {data,error}=await supabase.rpc('summary_counts',{p_since:since.toISOString()}); if(error){ box.innerHTML='<div class="text-ink3">โหลดสรุปไม่สำเร็จ</div>'; return; } const m=(data||{}); const tile=(label,val)=>`<div class='p-3 border rounded-xl bg-[var(--card)]' style='border-color:var(--bd)'><div class='text-[12px] text-ink3'>${label}</div><div class='text-xl font-semibold' style='color:var(--ink)'>${val||0}</div></div>`; box.innerHTML=[tile('มาทำงาน',m.work),tile('ประชุม',m.meeting),tile('อบรม',m.training),tile('ไปราชการ',m.official)].join(''); }
function initMap(){ const el=document.getElementById('map'); if(!el) return; if(map){ map.remove(); map=null; } map=L.map('map').setView([SCHOOL_LAT,SCHOOL_LNG],16); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map); L.circle([SCHOOL_LAT,SCHOOL_LNG],{radius:SCHOOL_RADIUS_METERS,color:'#2563EB',fillOpacity:0.08}).addTo(map); L.marker([SCHOOL_LAT,SCHOOL_LNG]).addTo(map).bindPopup('โรงเรียน'); }
function updateMeMarker(lat,lng){ if(!map) return; if(!meMarker){ meMarker=L.marker([lat,lng]).addTo(map).bindPopup('ตำแหน่งของฉัน'); } else { meMarker.setLatLng([lat,lng]); } }
function getGeo(out){ out.textContent='กำลังอ่านตำแหน่ง…'; if(!navigator.geolocation){ out.textContent='อุปกรณ์ไม่รองรับตำแหน่ง'; return; } navigator.geolocation.getCurrentPosition((pos)=>{ const {latitude,longitude,accuracy}=pos.coords; lastGeo={lat:latitude,lng:longitude,accuracy:accuracy||0}; updateMeMarker(latitude,longitude); const d=dist(SCHOOL_LAT,SCHOOL_LNG,latitude,longitude); const ok=d<=SCHOOL_RADIUS_METERS; out.innerHTML=`ตำแหน่ง: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy||0)}m) → ${ok?'<span class="text-green-600">ในเขต</span>':'<span class="text-red-600">นอกเขต ('+Math.round(d)+'m)'}`; }, (err)=>{ out.textContent='อ่านตำแหน่งไม่สำเร็จ: '+(err?.message||err); }, {enableHighAccuracy:true,timeout:8000,maximumAge:0}); }
function dist(a,b,c,d){ const R=6371000; const toR=x=>x*Math.PI/180; const dLat=toR(c-a), dLon=toR(d-b); const A=Math.sin(dLat/2)**2 + Math.cos(toR(a))*Math.cos(toR(c))*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(A)); }
async function openScanner(){ const panel=document.getElementById('scanPanel'); const holder=document.getElementById('qrReader'); if(!panel||!holder) return; panel.classList.remove('hide'); holder.innerHTML=''; try{ scanner=new Html5Qrcode('qrReader'); await scanner.start({facingMode:'environment'},{fps:10,qrbox:240}, t=>{ lastText=t; const res=document.getElementById('scanResult'); if(res) res.textContent='QR: '+t; }); }catch(e){ holder.innerHTML='<div class="p-4 text-sm text-red-600">ไม่สามารถเปิดกล้อง: '+(e?.message||e)+'</div>'; } }
async function closeScanner(){ const panel=document.getElementById('scanPanel'); if(panel) panel.classList.add('hide'); if(scanner){ try{ await scanner.stop(); }catch{} try{ await scanner.clear(); }catch{} scanner=null; } }
async function doCheckin(method){ const profile=JSON.parse(localStorage.getItem('LINE_PROFILE')||'null'); if(!profile){ toast('ต้องเข้าสู่ระบบด้วย LINE ก่อน'); return; } if(!lastGeo){ toast('ยังไม่ได้ตำแหน่ง (กดอ่านตำแหน่งอีกครั้ง)'); return; } const distance=dist(SCHOOL_LAT,SCHOOL_LNG,lastGeo.lat,lastGeo.lng); const within=distance<=SCHOOL_RADIUS_METERS; let purpose='work'; let note=null; if(!within){ openSheet(`<div class='text-sm space-y-2'><div class='font-semibold'>อยู่นอกเขตโรงเรียน — ระบุเหตุผล</div><label class='flex items-center gap-2'><input type='radio' name='p' value='meeting'> ประชุม</label><label class='flex items-center gap-2'><input type='radio' name='p' value='training'> อบรม</label><label class='flex items-center gap-2'><input type='radio' name='p' value='official'> ไปราชการ</label><input id='pWork' class='border rounded p-2 w-full' placeholder='หัวข้อ/หน่วยงาน/ภารกิจ'><div class='grid grid-cols-2 gap-2'><button id='okOut' class='btn btn-prim'>บันทึก</button><button id='cancelOut' class='btn'>ยกเลิก</button></div></div>`); document.getElementById('cancelOut').onclick=closeSheet; document.getElementById('okOut').onclick=async()=>{ const sel=document.querySelector('input[name="p"]:checked'); const desc=document.getElementById('pWork').value.trim(); if(!sel){ toast('กรุณาเลือกเหตุผล'); return; } if(!desc){ toast('กรุณากรอกรายละเอียด'); return; } purpose=sel.value; note=desc; closeSheet(); await saveCheckin({method,within,purpose,note,distance}); }; return; } purpose='work'; note=lastText||null; await saveCheckin({method,within,purpose,note,distance}); }
async function saveCheckin({method,within,purpose,note,distance}){ const profile=JSON.parse(localStorage.getItem('LINE_PROFILE')||'null'); const status=within?statusFromTime():'offsite'; const payload={ line_user_id:profile?.userId||null, line_display_name:profile?.displayName||null, line_picture_url:profile?.pictureUrl||null, method, purpose, status, note, lat:Number(lastGeo.lat)||null, lng:Number(lastGeo.lng)||null, accuracy:Number(lastGeo.accuracy)||0, distance_m:Math.round(distance||0), within_radius:!!within }; Object.keys(payload).forEach(k=>{ if(payload[k]===undefined || (typeof payload[k]==='number' && !isFinite(payload[k])) ) delete payload[k]; }); const ins=await supabase.from('checkins').insert(payload).select('id').single(); if(ins.error){ console.warn(ins.error); toast('เช็คอินไม่สำเร็จ'); return; } toast(within?'เช็คอินสำเร็จ ✅':'บันทึกภารกิจนอกสถานที่ ✅'); await loadToday(); await renderSummary(); }

async function loadToday(){
  const box=document.getElementById('todayList'); if(!box) return;
  box.innerHTML = `<div class="skeleton h-[68px]"></div>`;
  const d0=new Date(); d0.setHours(0,0,0,0);
  const d1=new Date(); d1.setHours(23,59,59,999);
  const { data, error } = await supabase.from('checkins').select('id,category,created_at,lat,lng,note').gte('created_at', d0.toISOString()).lte('created_at', d1.toISOString()).order('created_at', { ascending:false });
  if(error){ box.innerHTML = `<div class="text-ink3">โหลดรายการไม่สำเร็จ</div>`; return; }
  function haversineKm(lat1,lon1,lat2,lon2){ const toRad=d=>d*Math.PI/180, R=6371; const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
    const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(a)); }
  const baseLat=SCHOOL_LAT, baseLng=SCHOOL_LNG;
  box.innerHTML = (data||[]).map(r=>{
    const t=new Date(r.created_at); const hm=`${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
    const st = classifyStatus(r);
    const cat=(r.category||'').toLowerCase();
    const isOff = cat.includes('meet')||cat.includes('ประชุม')||cat.includes('train')||cat.includes('อบรม')||cat.includes('official')||cat.includes('ราชการ');
    let distNote=''; if(isOff && r.lat!=null && r.lng!=null){ const km=haversineKm(baseLat,baseLng, Number(r.lat),Number(r.lng)); distNote = `ระยะทางไป-กลับ ~ ${(km*2).toFixed(km<50?2:1)} กม.`; }
    return `<div class="p-3 border rounded-xl mb-2" style="border-color:var(--bd)">
      <div class="flex items-center justify-between text-sm opacity-80"><div>${hm}</div><div>${esc(r.category||'')}</div></div>
      <div class="mt-1">${pill(st)}</div>
      <div class="text-xs mt-1">${esc(r.note||'')}</div>
      ${distNote? `<div class="text-xs mt-1">${distNote}</div>`:''}
    </div>`;
  }).join('') || '<div class="text-ink3">ยังไม่มีรายการวันนี้</div>';
}
const start=new Date(); start.setHours(0,0,0,0); const resp=await supabase.from('checkins').select('*').eq('line_user_id',profile.userId).gte('created_at',start.toISOString()).order('created_at',{ascending:false}).limit(50); const data=resp.data||[]; box.innerHTML=data.map(r=>{ const canEdit=(!r.within_radius); const editBtn=canEdit?`<button class='btn text-xs' onclick='editOffsite(${r.id}, "${r.purpose||''}", ${JSON.stringify(r.note||'').replace(/"/g,'&quot;')})'>แก้ไข</button>`:''; return `<div class='p-2 border rounded-lg flex items-center gap-2 text-sm bg-[var(--card)]' style='border-color:var(--bd)'><img src='${r.line_picture_url||''}' class='w-8 h-8 rounded-full border' onerror="this.style.display='none'"><div class='flex-1'>${new Date(r.created_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} — ${purposeLabel(r.purpose)}${r.note?' • '+r.note:''} ${r.status ? ' • ' + (r.status==='on_time'?'ตรงเวลา': (r.status==='late'?'สาย':'นอกสถานที่')) : ''}</div><div class='${r.within_radius?'text-green-600':'text-red-600'}'>${fmtDist(r.distance_m||0)}</div>${editBtn}</div>`; }).join('')||'<div class="text-ink3">ยังไม่มีรายการวันนี้</div>'; }
window.editOffsite=function(id,purpose,note){ openSheet(`<div class='text-sm space-y-2'><div class='font-semibold'>แก้ไขภารกิจนอกสถานที่ (วันนี้)</div><label class='flex items-center gap-2'><input type='radio' name='p' value='meeting' ${purpose==='meeting'?'checked':''}> ประชุม</label><label class='flex items-center gap-2'><input type='radio' name='p' value='training' ${purpose==='training'?'checked':''}> อบรม</label><label class='flex items-center gap-2'><input type='radio' name='p' value='official' ${purpose==='official'?'checked':''}> ไปราชการ</label><input id='pNote' class='border rounded p-2 w-full' placeholder='รายละเอียดงาน' value='${note?String(note).replace(/"/g,'&quot;'):''}'><div class='text-ink3'>* ไม่สามารถแก้ไขเวลาเช็คอินได้</div><div class='grid grid-cols-2 gap-2'><button id='okEditOff' class='btn btn-prim'>บันทึก</button><button id='cancelEditOff' class='btn'>ยกเลิก</button></div></div>`); document.getElementById('cancelEditOff').onclick=closeSheet; document.getElementById('okEditOff').onclick=async()=>{ const sel=document.querySelector('input[name="p"]:checked'); const desc=document.getElementById('pNote').value.trim(); if(!sel){ toast('กรุณาเลือกเหตุผล'); return; } const upd={ purpose:sel.value, note:desc||null }; const res=await supabase.from('checkins').update(upd).eq('id',id); if(res.error){ toast('บันทึกไม่สำเร็จ'); return; } closeSheet(); toast('อัปเดตแล้ว'); await loadToday(); }; }

async function renderSummary(){
  const box=document.getElementById('checkinSummary'); if(!box) return;
  box.innerHTML = `<div class="skeleton h-[88px]"></div>`;
  const auth = await supabase.auth.getUser();
  const prof = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  const lineId = prof?.userId || null;
  const userId = auth?.data?.user?.id || null;
  const isLogged = !!(userId || lineId);
  function applyUserFilter(q){
    if(userId) return q.eq('created_by', userId);
    if(lineId) return q.eq('line_user_id', lineId);
    return q;
  }
  async function collect(since){
    let base = supabase.from('checkins').select('id,category,created_by,line_user_id').gte('created_at', since.toISOString());
    let resp = await applyUserFilter(base);
    if(resp.error && (resp.status===400 || /invalid input syntax/i.test(resp.error.message||''))){
      resp = await base;
    }
    const data = resp.data||[];
    const ppl=new Set(); data.forEach(r=>{ if(r.line_user_id) ppl.add('L:'+r.line_user_id); else if(r.created_by) ppl.add('U:'+r.created_by); });
    return {rows:data, people:ppl.size, isOverall: !isLogged || (resp.error && resp.status===400)};
  }
  const now=new Date(), weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
  const monthStart=new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart=new Date(now.getFullYear(), 0, 1);
  const [w,m,y] = await Promise.all([collect(weekStart), collect(monthStart), collect(yearStart)]);
  const stat = rows => { const s={total:rows.length,work:0,meeting:0,training:0,official:0};
    rows.forEach(r=>{ const c=(r.category||'work').toLowerCase();
      if(c.startsWith('work')) s.work++; else if(c.startsWith('meet')||c.includes('ประชุม')) s.meeting++;
      else if(c.startsWith('train')||c.includes('อบรม')) s.training++; else s.official++; });
    return s; };
  const note = rec => (!isLogged || rec.isOverall) ? `<div class="text-xs mt-1 opacity-80">ข้อมูลภาพรวม (เกี่ยวข้อง ${rec.people} คน)</div>` : '';
  const tile=(t,rec)=>{ const s=stat(rec.rows); return `<div class="p-3 border rounded-xl" style="border-color:var(--bd)">
    <div class="font-semibold mb-1">สรุปผล — ${t}</div>
    <div class="grid grid-cols-2 gap-2 text-sm">
      <div>รวม</div><div class="text-right">${s.total}</div>
      <div>ปฏิบัติงาน</div><div class="text-right">${s.work}</div>
      <div>ประชุม</div><div class="text-right">${s.meeting}</div>
      <div>อบรม</div><div class="text-right">${s.training}</div>
      <div>ราชการ</div><div class="text-right">${s.official}</div>
    </div>${note(rec)}</div>`; };
  box.innerHTML = `<div class="grid gap-3 sm:grid-cols-3">${tile('สัปดาห์นี้', w)}${tile('เดือนนี้', m)}${tile('ปีนี้', y)}</div>`;
}
), supabase.rpc('summary_counts',{p_since:monthStart.toISOString()}), supabase.rpc('summary_counts',{p_since:yearStart.toISOString()}) ]); function card(title,obj){ const o=obj.data||{}; return `<div class='p-3 border rounded-xl bg-[var(--card)]' style='border-color:var(--bd)'><div class='text-sm font-semibold mb-2'>${title}</div><div class='grid grid-cols-2 gap-2 text-[13px]'><div>มาทำงาน</div><div class='text-right font-semibold'>${o.work||0}</div><div>ประชุม</div><div class='text-right font-semibold'>${o.meeting||0}</div><div>อบรม</div><div class='text-right font-semibold'>${o.training||0}</div><div>ไปราชการ</div><div class='text-right font-semibold'>${o.official||0}</div></div></div>`; } box.innerHTML=card('สัปดาห์นี้',w)+card('เดือนนี้',m)+card('ปีนี้',y); }

function parseHM(s){ if(!s||typeof s!=='string') return null; const m=s.match(/^([0-2]?\d):([0-5]\d)$/); if(!m) return null; return {h:+m[1],m:+m[2]}; }
function getCheckinWindows(){
  const st = JSON.parse(localStorage.getItem('APPWD_SETTINGS')||'{}');
  const A = parseHM(st.CHECKIN_START) || {h:7,m:30};
  const B = parseHM(st.CHECKIN_ON_TIME_UNTIL) || {h:8,m:30};
  return {A,B};
}
function classifyStatus(row){
  const cat=(row.category||'work').toLowerCase();
  if(cat.includes('meet')||cat.includes('ประชุม')||cat.includes('train')||cat.includes('อบรม')||cat.includes('official')||cat.includes('ราชการ')){
    return {key:'off', label:'นอกสถานที่'};
  }
  const {A,B}=getCheckinWindows(); const t=new Date(row.created_at); const mins=t.getHours()*60+t.getMinutes();
  const a=A.h*60+A.m, b=B.h*60+B.m;
  if(mins<=b) return {key:'on', label:'ตรงเวลา'};
  return {key:'late', label:'สาย'};
}
function pill(status){ return `<span class="badge ${status.key}">${status.label}</span>`; }
