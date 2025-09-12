
import { supabase } from '../api.js';
import { esc } from '../ui.js';

function parseHHMM(s){
  const [hh,mm] = String(s||'00:00').split(':').map(n=>parseInt(n,10)||0);
  const d = new Date(); d.setHours(hh, mm, 0, 0); return d;
}
function getStatus(row, settings){
  const start = parseHHMM(settings.CHECKIN_START || '07:30');
  const onTimeUntil = parseHHMM(settings.CHECKIN_ON_TIME_UNTIL || '08:00');
  const t = new Date(row.checkin_at || row.created_at);
  const offsite = !!row.is_offsite || (row.category && row.category !== 'work');
  if(offsite) return 'offsite';
  return (t <= onTimeUntil) ? 'ontime' : 'late';
}
function badge(status){
  const label = {ontime:'ตรงเวลา', late:'สาย', offsite:'นอกสถานที่'}[status] || status;
  return `<span class="badge badge-${status}">${label}</span>`;
}

let chkTimer = null;
async function renderCheckinLatest(){
  const box = document.getElementById('checkinLatest');
  if(!box) return;
  box.innerHTML = `<div class="skeleton" style="height:72px"></div><div class="skeleton" style="height:72px"></div>`;

  const st = JSON.parse(localStorage.getItem('APPWD_SETTINGS')||'{}');
  const { data } = await supabase
    .from('checkins')
    .select('id, full_name, category, note, is_offsite, checkin_at, created_at, distance_m')
    .order('created_at', {ascending:false})
    .limit(5);

  const rows = data || [];
  box.classList.add('slider-x');
  box.innerHTML = rows.map(r=>{
    const s = getStatus(r, st);
    const t = new Date(r.checkin_at || r.created_at).toLocaleString('th-TH',{timeStyle:'short'});
    const dist = (r.distance_m!=null) ? (r.distance_m>=1000 ? (r.distance_m/1000).toFixed(2)+' กม.' : r.distance_m+' ม.') : '';
    return `<div class="slide card p-3 border rounded-xl" style="border-color:var(--bd)">
      <div class="flex items-center gap-2 mb-1">
        ${badge(s)} <div class="text-[12px] text-ink3">${t}${dist? ' • '+dist:''}</div>
      </div>
      <div class="font-medium">${esc(r.full_name||'-')}</div>
      ${r.note? `<div class="text-[12px] text-ink3 mt-1 line-clamp-2">${esc(r.note)}</div>`:''}
    </div>`;
  }).join('') || `<div class="text-ink3">ยังไม่มีรายการ</div>`;

  // Auto-scroll
  const small = (typeof matchMedia!=='undefined') && matchMedia('(max-width: 640px)').matches;
  const ms = Number(st.SLIDER_AUTO_MS || 4000);
  clearInterval(chkTimer);
  if(small && box.children.length > 1){
    chkTimer = setInterval(()=>{
      const w = box.clientWidth;
      const next = Math.round((box.scrollLeft + w) / w);
      const max = box.children.length - 1;
      const to = (next > max ? 0 : next) * w;
      box.scrollTo({ left: to, behavior: 'smooth' });
    }, ms);
  }
}

document.addEventListener('DOMContentLoaded', renderCheckinLatest);
document.addEventListener('appwd:checkinSaved', renderCheckinLatest);
window.addEventListener('resize', renderCheckinLatest);
