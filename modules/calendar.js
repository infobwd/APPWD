import { supabase, anyRole } from '../api.js';
export async function render(){
  const list = document.getElementById('eventList');
  const btnAdd = document.getElementById('btnAddEvent');
  const canEdit = await anyRole(['editor','admin']);
  btnAdd.style.display = canEdit ? '' : 'none';
  btnAdd.onclick = async ()=>{
    const title = prompt('ชื่อกิจกรรม'); if(!title) return;
    const start = prompt('วันเริ่ม (YYYY-MM-DD HH:MM)');
    const end = prompt('วันสิ้นสุด (YYYY-MM-DD HH:MM)');
    const payload = { title, start_at: new Date(start||Date.now()).toISOString(), end_at: new Date(end||Date.now()).toISOString(), visibility:'public' };
    const { error } = await supabase.from('events').insert(payload);
    if(error) alert('เพิ่มกิจกรรมไม่สำเร็จ: '+error.message); else await render();
  };
  list.innerHTML = '<div class="animate-pulse h-5 bg-slate-700/20 rounded w-1/2"></div>';
  const { data, error } = await supabase.from('events').select('id,title,start_at,end_at,location,category,visibility').gte('end_at', new Date(Date.now()-86400000).toISOString()).order('start_at',{ascending:true}).limit(60);
  if(error){ list.innerHTML = '<div class="text-red-300">โหลดกิจกรรมไม่สำเร็จ</div>'; return; }
  list.innerHTML = (data||[]).map(ev => `<article class="card p-4"><div class="font-semibold">${escapeHtml(ev.title)}</div><div class="text-xs text-slate-400">${formatDate(ev.start_at)} → ${formatDate(ev.end_at)}</div><div class="text-xs text-slate-400">${escapeHtml(ev.location||'')}</div><div class="chip inline-block mt-2">${escapeHtml(ev.category||'ทั่วไป')}</div></article>`).join('') || '<div class="text-slate-400">ยังไม่มีกิจกรรม</div>';
}
function formatDate(iso){ if(!iso) return '—'; const d = new Date(iso); return d.toLocaleString('th-TH', { dateStyle:'medium', timeStyle:'short' }); }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
