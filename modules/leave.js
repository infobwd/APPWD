import { supabase, currentUser } from '../api.js';
import { PUBLIC_URL } from '../config.js';
export async function render(){ const f=document.getElementById('leaveForm'); f.onsubmit=submit; await myLeaves(); }
async function submit(e){
  e.preventDefault();
  const u = await currentUser();
  if(!u){
    const email = prompt('กรุณาใส่อีเมลเพื่อยืนยัน (ครั้งแรกเท่านั้น):');
    if(!email) return;
    const { error } = await supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo: PUBLIC_URL } });
    if(error){ alert('ส่งลิงก์ไม่สำเร็จ: ' + error.message); return; }
    alert('ส่งลิงก์ยืนยันไปที่อีเมลแล้ว กดยืนยันแล้วกลับมาอีกครั้ง');
    return;
  }
  const fd=new FormData(e.target);
  const payload={ user_id:u.id, type:fd.get('type'), start_date:fd.get('start_date')||null, end_date:fd.get('end_date')||null, reason:fd.get('reason')||null, status:'pending' };
  const { error } = await supabase.from('leave_requests').insert(payload);
  if(error){ alert('ยื่นคำขอไม่สำเร็จ: '+error.message); return; }
  e.target.reset(); await myLeaves();
}
async function myLeaves(){
  const u = await currentUser(); const box = document.getElementById('myLeaves');
  if(!u){ box.innerHTML = '<div class="text-gray-500">เข้าสู่ระบบด้วย LINE เพื่อเห็นประวัติ และยืนยันอีเมลเมื่อต้องบันทึกข้อมูล</div>'; return; }
  const { data, error } = await supabase.from('leave_requests').select('id,type,start_date,end_date,status,created_at').eq('user_id',u.id).order('created_at',{ascending:false});
  if(error){ box.innerHTML='<div class="text-red-600">โหลดคำขอไม่สำเร็จ</div>'; return; }
  box.innerHTML = (data||[]).map(r => `<div class="p-3 border border-[#E6EAF0] rounded-xl bg-white"><div class="font-medium">${labelType(r.type)} • ${labelStatus(r.status)}</div><div class="text-xs text-gray-500">${r.start_date||'—'} → ${r.end_date||'—'}</div></div>`).join('') || '<div class="text-gray-500">ยังไม่มีคำขอ</div>';
}
function labelType(t){ return ({vacation:'ลาพักผ่อน', business:'ลากิจ', sick:'ลาป่วย'})[t]||t }
function labelStatus(s){ return ({pending:'รออนุมัติ', approved:'อนุมัติ', rejected:'ตีกลับ'})[s]||s }
