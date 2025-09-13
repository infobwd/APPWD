import { supabase } from '../api.js';
import { esc, skel } from '../ui.js';

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

export async function render(){
  await renderSummary();
  await loadToday();
}

async function renderSummary(){
  const box=document.getElementById('checkinSummary'); if(!box) return;
  box.innerHTML = skel(3,'88px');

  const auth = await supabase.auth.getUser();
  const prof = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  const lineId = prof?.userId || null;
  const userId = auth?.data?.user?.id || null;
  const isLogged = !!(userId || lineId);

  async function collect(since){
    let q = supabase.from('checkins')
      .select('id,category,created_by,line_user_id',{head:false})
      .gte('created_at', since.toISOString());
    if(isLogged){
      const ors=[]; if(userId) ors.push(`created_by.eq.${userId}`); if(lineId) ors.push(`line_user_id.eq.${lineId}`);
      if(ors.length) q = q.or(ors.join(','));
    }
    const {data,error} = await q; if(error||!data) return {rows:[],people:0};
    const ppl = new Set(); data.forEach(r=>{ if(r.line_user_id) ppl.add('L:'+r.line_user_id); else if(r.created_by) ppl.add('U:'+r.created_by); });
    return {rows:data, people:ppl.size};
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
  const note = rec => !isLogged ? `<div class="text-xs mt-1 opacity-80">ข้อมูลภาพรวม (เกี่ยวข้อง ${rec.people} คน)</div>` : '';
  const tile=(t,rec)=>{ const s=stat(rec.rows); return `<div class="p-3 border rounded-xl" style="border-color:var(--bd)">
    <div class="font-semibold mb-1">สรุปผล — ${t}</div>
    <div class="grid grid-cols-2 gap-2 text-sm">
      <div>รวม</div><div class="text-right">${s.total}</div>
      <div>ปฏิบัติงาน</div><div class="text-right">${s.work}</div>
      <div>ประชุม</div><div class="text-right">${s.meeting}</div>
      <div>อบรม</div><div class="text-right">${s.training}</div>
      <div>ราชการ</div><div class="text-right">${s.official}</div>
    </div>${note(rec)}</div>`; };
  box.innerHTML = `<div class="grid gap-3 sm:grid-cols-3">
    ${tile('สัปดาห์นี้', w)}${tile('เดือนนี้', m)}${tile('ปีนี้', y)}
  </div>`;
}

async function loadToday(){
  const box=document.getElementById('todayList'); if(!box) return;
  box.innerHTML = skel(3,'68px');

  const d0=new Date(); d0.setHours(0,0,0,0);
  const d1=new Date(); d1.setHours(23,59,59,999);

  const { data, error } = await supabase.from('checkins')
    .select('id,category,created_at,lat,lng,note')
    .gte('created_at', d0.toISOString()).lte('created_at', d1.toISOString())
    .order('created_at', { ascending:false });
  if(error){ box.innerHTML = `<div class="text-ink3">โหลดรายการไม่สำเร็จ</div>`; return; }

  function haversineKm(lat1,lon1,lat2,lon2){
    const toRad=d=>d*Math.PI/180, R=6371;
    const dLat=toRad(lat2-lat1), dLon=toRad(lat2-lon1);
    const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(a));
  }
  const baseLat=SCHOOL_LAT, baseLng=SCHOOL_LNG;

  box.innerHTML = (data||[]).map(r=>{
    const t=new Date(r.created_at);
    const hm = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
    const st = classifyStatus(r);
    const cat=(r.category||'').toLowerCase();
    const isOff = cat.includes('meet')||cat.includes('ประชุม')||cat.includes('train')||cat.includes('อบรม')||cat.includes('official')||cat.includes('ราชการ');
    let distNote='';
    if(isOff && r.lat!=null && r.lng!=null){
      const km = haversineKm(baseLat,baseLng, Number(r.lat),Number(r.lng));
      distNote = `ระยะทางไป-กลับ ~ ${(km*2).toFixed(km<50?2:1)} กม.`;
    }
    return `<div class="p-3 border rounded-xl mb-2" style="border-color:var(--bd)">
      <div class="flex items-center justify-between text-sm opacity-80"><div>${hm}</div><div>${esc(r.category||'')}</div></div>
      <div class="mt-1">${pill(st)}</div>
      <div class="text-xs mt-1">${esc(r.note||'')}</div>
      ${distNote? `<div class="text-xs mt-1">${distNote}</div>`:''}
    </div>`;
  }).join('') || '<div class="text-ink3">ยังไม่มีรายการวันนี้</div>';
}

export async function renderHomeRecent(category='all'){
  const box=document.getElementById('homeCheckins'); if(!box) return;
  box.innerHTML = skel(3,'68px');
  let q = supabase.from('checkins')
    .select('id,category,created_at,nickname')
    .order('created_at', {ascending:false}).limit(8);
  if(category && category!=='all'){
    q = q.like('category', `%${category}%`);
  }
  const {data,error} = await q;
  if(error){ box.innerHTML = `<div class="text-ink3">โหลดไม่สำเร็จ</div>`; return; }
  box.innerHTML = (data||[]).map(r=>{
    const t=new Date(r.created_at);
    const hm = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
    const st = classifyStatus(r);
    return `<div class="p-3 slide border rounded-xl" style="border-color:var(--bd)">
      <div class="flex items-center justify-between text-sm opacity-80"><div>${hm}</div><div>${esc(r.category||'')}</div></div>
      <div class="mt-1">${pill(st)}</div>
      <div class="text-xs mt-1 opacity-80">${esc(r.nickname||'')}</div>
    </div>`;
  }).join('') || '<div class="text-ink3">ยังไม่มีรายการ</div>';
  try{ applyHomeSlider(); startHomeAutoScroll(); }catch(_){}
}

export async function renderHomeSummary(){ await renderSummary(); }

// Slider helpers for Home
function applyHomeSlider(){
  const box=document.getElementById('homeCheckins'); if(!box) return;
  const small=(typeof matchMedia!=='undefined') && matchMedia('(max-width:640px)').matches;
  box.classList.toggle('slider-x', small);
}
let homeSliderTimer=null;
function startHomeAutoScroll(){
  const box=document.getElementById('homeCheckins'); if(!box) return;
  clearInterval(homeSliderTimer);
  const st=JSON.parse(localStorage.getItem('APPWD_SETTINGS')||'{}'); const ms=Number(st.SLIDER_AUTO_MS||4000);
  const small=(typeof matchMedia!=='undefined') && matchMedia('(max-width:640px)').matches;
  if(small && box.children.length>1){
    homeSliderTimer=setInterval(()=>{
      const w=box.clientWidth; const next=Math.round((box.scrollLeft+w)/w);
      const max=box.children.length-1; const to=(next>max?0:next)*w;
      box.scrollTo({left:to,behavior:'smooth'});
    },ms);
  }
}

// Guard FAB when not-logged-in
document.addEventListener('click', async (e)=>{
  const fab = e.target.closest?.('#fabScan'); if(!fab) return;
  const auth = await supabase.auth.getUser();
  const prof = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  if(!(auth?.data?.user || prof?.userId)){
    e.preventDefault(); e.stopPropagation();
    if(window.openSheet){
      openSheet(`<div class="space-y-2 text-sm">
        <div class="font-semibold">ต้องเข้าสู่ระบบก่อนเช็คอิน</div>
        <div>กรุณาเข้าสู่ระบบด้วย LINE แล้วลองใหม่อีกครั้ง</div>
      </div>`, { title:'ต้องเข้าสู่ระบบ' });
    }else{
      alert('ต้องเข้าสู่ระบบก่อนเช็คอิน');
    }
  }
}, true);
