import { supabase, anyRole } from '../api.js';
export async function render(){
  const can = await anyRole(['approver','admin']);
  const leavesBox = document.getElementById('pendingLeaves');
  const booksBox = document.getElementById('pendingBookings');
  if(!can){
    leavesBox.innerHTML = '<div class="text-slate-400">ต้องเป็นผู้อนุมัติ</div>';
    booksBox.innerHTML = '<div class="text-slate-400">ต้องเป็นผู้อนุมัติ</div>';
    return;
  }
  const { data: leaves } = await supabase.from('leave_requests').select('id,user_id,type,start_date,end_date,reason,status,profiles(display_name)').eq('status','pending').order('created_at',{ascending:true});
  leavesBox.innerHTML = (leaves||[]).map(l => card({ title: `ลา: ${labelType(l.type)} — ${l.profiles?.display_name||'ผู้ยื่น'}`, subtitle: `${l.start_date||'—'} → ${l.end_date||'—'}`, body: l.reason||'', onApprove: ()=> updateLeave(l.id,'approved'), onReject: ()=> updateLeave(l.id,'rejected') })).join('') || '<div class="text-slate-400">ไม่มีคำขอ</div>';
  const { data: books } = await supabase.from('bookings').select('id,user_id,start_at,end_at,status,resources(name)').eq('status','pending').order('created_at',{ascending:true});
  booksBox.innerHTML = (books||[]).map(b => card({ title: `จอง: ${b.resources?.name||'ทรัพยากร'}`, subtitle: `${formatDate(b.start_at)} → ${formatDate(b.end_at)}`, body: '', onApprove: ()=> updateBooking(b.id,'approved'), onReject: ()=> updateBooking(b.id,'rejected') })).join('') || '<div class="text-slate-400">ไม่มีคำขอ</div>';
}
function card({ title, subtitle, body, onApprove, onReject }){
  const id = Math.random().toString(36).slice(2);
  queueMicrotask(()=>{ const a=document.getElementById('ok_'+id); const r=document.getElementById('no_'+id); if(a) a.onclick=onApprove; if(r) r.onclick=onReject; });
  return `<div class="p-3 border border-[#223052] rounded-lg"><div class="font-medium">${escapeHtml(title)}</div><div class="text-xs text-slate-400 mb-2">${escapeHtml(subtitle)}</div><div class="text-sm mb-2">${escapeHtml(body||'')}</div><div class="flex gap-2"><button id="ok_${id}" class="btn btn-prim">อนุมัติ</button><button id="no_${id}" class="btn">ตีกลับ</button></div></div>`;
}
async function updateLeave(id, status){ const { error } = await supabase.from('leave_requests').update({ status, approved_at: new Date().toISOString() }).eq('id', id); if(error) alert('อัปเดตไม่สำเร็จ: '+error.message); else await render(); }
async function updateBooking(id, status){ const { error } = await supabase.from('bookings').update({ status }).eq('id', id); if(error) alert('อัปเดตไม่สำเร็จ: '+error.message); else await render(); }
function labelType(t){ return ({vacation:'ลาพักผ่อน', business:'ลากิจ', sick:'ลาป่วย'})[t] || t; }
function formatDate(iso){ const d=new Date(iso); return d.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}); }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
