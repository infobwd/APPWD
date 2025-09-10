import { supabase, currentUser } from '../api.js';
export async function render(){
  const list = document.getElementById('resList');
  const sel = document.getElementById('resourceSelect');
  const form = document.getElementById('bookingForm');
  const my = document.getElementById('myBookings');
  form.onsubmit = onSubmit;
  list.innerHTML = '<div class="animate-pulse h-4 bg-slate-700/20 rounded w-2/3"></div>';
  sel.innerHTML = '<option>กำลังโหลด...</option>';
  const { data: res, error } = await supabase.from('resources').select('id,name,category,location,availability').order('name');
  if(error){ list.innerHTML = '<div class="text-red-300">โหลดทรัพยากรไม่สำเร็จ</div>'; return; }
  list.innerHTML = (res||[]).map(r=>`<div class="p-3 border border-[#223052] rounded-lg"><div class="font-medium">${escapeHtml(r.name)}</div><div class="text-xs text-slate-400">${escapeHtml(r.category||'ทั่วไป')} • ${escapeHtml(r.location||'')}</div><div class="text-xs text-slate-400">สถานะ: ${escapeHtml(r.availability||'พร้อมใช้งาน')}</div></div>`).join('') || '<div class="text-slate-400">ยังไม่มีรายการ</div>';
  sel.innerHTML = (res||[]).map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  await refreshMyBookings();
}
async function onSubmit(e){
  e.preventDefault();
  const user = await currentUser();
  if(!user){ alert('กรุณาเข้าสู่ระบบ'); return; }
  const fd = new FormData(e.target);
  const payload = {
    user_id: user.id,
    resource_id: Number(fd.get('resource_id')),
    start_at: new Date(fd.get('start_at')||Date.now()).toISOString(),
    end_at: new Date(fd.get('end_at')||Date.now()).toISOString(),
    status: 'pending'
  };
  const { error } = await supabase.from('bookings').insert(payload);
  if(error){ alert('ส่งคำขอไม่สำเร็จ: ' + error.message); return; }
  e.target.reset();
  await refreshMyBookings();
}
async function refreshMyBookings(){
  const user = await currentUser();
  const box = document.getElementById('myBookings');
  if(!user){ box.innerHTML = '<div class="text-slate-400">กรุณาเข้าสู่ระบบ</div>'; return; }
  const { data, error } = await supabase.from('bookings').select('id,resource_id,start_at,end_at,status,resources(name)').eq('user_id', user.id).order('created_at',{ascending:false});
  if(error){ box.innerHTML = '<div class="text-red-300">โหลดคำขอไม่สำเร็จ</div>'; return; }
  box.innerHTML = (data||[]).map(b => `<div class="p-2 border border-[#223052] rounded-lg"><div class="font-medium">${escapeHtml(b.resources?.name||'ทรัพยากร')}</div><div class="text-xs text-slate-400">${formatDate(b.start_at)} → ${formatDate(b.end_at)}</div><div class="chip mt-1 inline-block">${labelStatus(b.status)}</div></div>`).join('') || '<div class="text-slate-400">ยังไม่มีคำขอ</div>';
}
function labelStatus(s){ return ({pending:'รออนุมัติ', approved:'อนุมัติ', rejected:'ตีกลับ'})[s] || s; }
function formatDate(iso){ const d=new Date(iso); return d.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}); }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
