import { supabase, currentUser } from '../api.js';

export async function render(){
  const form = document.getElementById('leaveForm');
  form.onsubmit = onSubmit;
  await refreshMyLeaves();
}

async function onSubmit(e){
  e.preventDefault();
  const user = await currentUser();
  if(!user){ alert('กรุณาเข้าสู่ระบบ'); return; }
  const fd = new FormData(e.target);
  const payload = {
    user_id: user.id,
    type: fd.get('type'),
    start_date: fd.get('start_date') || null,
    end_date: fd.get('end_date') || null,
    reason: fd.get('reason') || null,
    status: 'pending'
  };

  // attachment optional -> upload to 'attachments' bucket
  const file = fd.get('attachment');
  let attachment = null;
  if(file && file.size){
    const path = `leave/${user.id}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from('attachments').upload(path, file, { upsert:false, contentType:file.type });
    if(upErr){ alert('อัปโหลดไฟล์ไม่สำเร็จ: ' + upErr.message); return; }
    attachment = path;
  }
  payload.attachment = attachment;

  const { error } = await supabase.from('leave_requests').insert(payload);
  if(error){ alert('ยื่นคำขอไม่สำเร็จ: ' + error.message); return; }
  e.target.reset();
  await refreshMyLeaves();
}

async function refreshMyLeaves(){
  const user = await currentUser();
  const box = document.getElementById('myLeaves');
  if(!user){ box.innerHTML = '<div class="text-slate-400">กรุณาเข้าสู่ระบบ</div>'; return; }
  box.innerHTML = '<div class="animate-pulse h-4 bg-slate-700/20 rounded w-1/2"></div>';
  const { data, error } = await supabase
    .from('leave_requests')
    .select('id,type,start_date,end_date,status,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending:false })
    .limit(20);
  if(error){ box.innerHTML = '<div class="text-red-300">โหลดคำขอไม่สำเร็จ</div>'; return; }
  box.innerHTML = (data||[]).map(r => `
    <div class="p-2 border border-[#223052] rounded-lg">
      <div class="font-medium">${labelType(r.type)} • ${labelStatus(r.status)}</div>
      <div class="text-xs text-slate-400">${r.start_date||'—'} → ${r.end_date||'—'}</div>
    </div>
  `).join('') || '<div class="text-slate-400">ยังไม่มีคำขอ</div>';
}

function labelType(t){
  return ({vacation:'ลาพักผ่อน', business:'ลากิจ', sick:'ลาป่วย'})[t] || t;
}
function labelStatus(s){
  return ({pending:'รออนุมัติ', approved:'อนุมัติ', rejected:'ตีกลับ'})[s] || s;
}
