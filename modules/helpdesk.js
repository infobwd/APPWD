import { supabase, currentUser } from '../api.js';
export async function render(){
  const form=document.getElementById('ticketForm'); if(form) form.onsubmit=onSubmit;
  await refreshMy();
}
async function onSubmit(e){
  e.preventDefault();
  const u=await currentUser(); if(!u){ alert('กรุณาเข้าสู่ระบบ'); return; }
  const fd=new FormData(e.target);
  const file=fd.get('file'); let attachment=null;
  if(file && file.size){ const path=`helpdesk/${u.id}/${Date.now()}_${file.name}`; const up=await supabase.storage.from('helpdesk').upload(path,file,{ upsert:false, contentType:file.type }); if(!up.error) attachment=path; }
  const payload={ user_id:u.id, category:fd.get('category'), title:fd.get('title'), detail:fd.get('detail')||null, attachment, status:'open' };
  const { error } = await supabase.from('tickets').insert(payload);
  if(error){ alert('ส่งคำร้องไม่สำเร็จ: '+error.message); return; }
  e.target.reset(); await refreshMy();
}
async function refreshMy(){
  const u=await currentUser(); const box=document.getElementById('myTickets'); if(!u){ box.innerHTML='<div class="text-slate-400">กรุณาเข้าสู่ระบบ</div>'; return; }
  const { data, error, count }=await supabase.from('tickets').select('id,category,title,status,created_at',{count:'exact'}).eq('user_id', u.id).order('created_at',{ascending:false});
  document.getElementById('ticketCounter').textContent = String(count ?? (data||[]).length);
  if(error){ box.innerHTML='<div class="text-red-300">โหลดรายการไม่สำเร็จ</div>'; return; }
  box.innerHTML=(data||[]).map(t=>`<div class="p-3 border border-[#223052] rounded-lg"><div class="font-semibold">${e(t.title)}</div><div class="text-xs text-slate-400">${e(t.category)} • ${fmt(t.created_at)}</div><div class="chip mt-2 ${t.status==='open'?'bg-warn text-black':'bg-primSoft text-[#102548]'}">${label(t.status)}</div></div>`).join('') || '<div class="text-slate-400">ยังไม่มีคำร้อง</div>';
}
function label(s){return ({open:'เปิด',in_progress:'กำลังดำเนินการ',resolved:'แก้ไขแล้ว',rejected:'ตีกลับ'})[s]||s}
function fmt(x){const d=new Date(x);return d.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})}
function e(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) }
