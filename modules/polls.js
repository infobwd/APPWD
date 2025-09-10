import { supabase, anyRole, currentUser } from '../api.js';
export async function render(){
  const list=document.getElementById('pollList'); const btn=document.getElementById('btnNewPoll');
  if(btn){ btn.style.display='none'; }
  const { data: polls, error }=await supabase.from('polls').select('id,title,description,multi,start_at,end_at').order('id',{ascending:false}).limit(20);
  if(error){ list.innerHTML='<div class="text-red-300">โหลดโหวตไม่สำเร็จ</div>'; return; }
  list.innerHTML = await Promise.all((polls||[]).map(renderPoll)).then(x=>x.join('')) || '<div class="text-slate-400">ยังไม่มีโหวต</div>';
}
async function renderPoll(p){
  const { data: opts }=await supabase.from('poll_options').select('id,label').eq('poll_id', p.id).order('id');
  const { data: my }=await supabase.from('poll_votes').select('option_id').eq('poll_id', p.id).maybeSingle();
  const voted = !!my;
  const html = `
    <div class="card p-4">
      <div class="font-semibold">${e(p.title)}</div>
      <div class="text-xs text-slate-400 mb-2">${p.multi?'เลือกได้หลายข้อ':'เลือกได้ 1 ข้อ'}</div>
      <div class="grid gap-2">${(opts||[]).map(o=>{
        const isMy = my && my.option_id===o.id;
        return `<button data-opt="${o.id}" data-poll="${p.id}" class="btn ${isMy?'btn-prim':''}" ${voted?'disabled':''}>${e(o.label)}</button>`;
      }).join('')}</div>
    </div>`;
  queueMicrotask(()=>{ document.querySelectorAll(`[data-poll="${p.id}"]`).forEach(btn=>{ btn.onclick = async()=>{ const u=await currentUser(); if(!u){ alert('กรุณาเข้าสู่ระบบ'); return; } const optId=Number(btn.getAttribute('data-opt')); const payload={ poll_id:p.id, option_id:optId, user_id:u.id }; const { error }=await supabase.from('poll_votes').upsert(payload,{onConflict:'poll_id,user_id'}); if(error){ alert('โหวตไม่สำเร็จ: '+error.message); return; } location.hash = '#polls'; }; }); });
  return html;
}
function e(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) }
