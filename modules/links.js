import { supabase } from '../api.js'; import { openSheet, closeSheet, toast, skel, esc } from '../ui.js';
const homeGrid=()=>document.getElementById('homeLinks'); const grid=()=>document.getElementById('linkGrid'); const composeBtn=()=>document.getElementById('btnComposeLink');
export async function renderHome(){ if(!homeGrid())return; homeGrid().innerHTML=skel(8); const resp=await supabase.from('app_links').select('id,title,url,image_url,category').eq('is_active',true).order('sort_order').limit(8);
  const data=resp.data||[]; homeGrid().innerHTML=data.map(tile).join('')||'<div class="text-ink3">ยังไม่มีลิงก์</div>'; }
export async function render(){ if(!grid())return; grid().innerHTML=skel(10); const editor=await canManage(); const btn=composeBtn(); if(btn){btn.classList.toggle('hide',!editor); btn.onclick=()=>openComposeSheet();}
  const resp=await supabase.from('app_links').select('id,title,url,image_url,category,is_active,sort_order').order('category').order('sort_order'); const rows=resp.data||[];
  const groups=rows.reduce((m,r)=>{const k=r.category||'ทั่วไป';(m[k]=m[k]||[]).push(r);return m;},{}); const html=Object.keys(groups).map(cat=>section(cat,groups[cat],editor)).join(''); grid().innerHTML=html||'<div class="text-ink3">ยังไม่มีลิงก์</div>'; }
function section(cat,items,editor){ return `<div class='space-y-2'><div class='text-sm font-semibold text-ink2'>${esc(cat)}</div><div class='grid grid-cols-2 md:grid-cols-4 gap-3'>${items.map(r=>tile(r,true,editor)).join('')}</div></div>`;}
function tile(row,full=false,editor=false){ const img=row.image_url?`<img src='${row.image_url}' class='w-12 h-12 object-cover rounded-2xl border'>`:`<div class='w-12 h-12 rounded-2xl grid place-items-center bg-brandSoft text-brand'>🔗</div>`; const actions=editor&&full?`<div class='flex gap-2 justify-center mt-1'><button class='btn text-xs' onclick='editLink(${row.id})'>แก้ไข</button><button class='btn text-xs' onclick='deleteLink(${row.id})'>ลบ</button></div>`:''; return `<div class='p-3 border rounded-xl bg-[var(--card)] text-center' style='border-color:var(--bd)'><a href='${encodeURI(row.url)}' target='_blank' rel='noopener' class='flex flex-col items-center gap-1'>${img}<div class='text-[12px] leading-tight mt-1' style='color:var(--ink)'>${esc(row.title)}</div></a>${actions}</div>`;}
window.editLink=async function(id){ const resp=await supabase.from('app_links').select('*').eq('id',id).maybeSingle(); const r=resp.data; if(!r)return alert('ไม่พบรายการ'); openEditSheet(r); };
window.deleteLink=async function(id){ if(!confirm('ลบรายการนี้?'))return; const del=await supabase.from('app_links').delete().eq('id',id); if(del.error)return toast('ลบไม่สำเร็จ'); toast('ลบแล้ว'); await import('./links.js').then(m=>m.render()); };
async function canManage(){ const prof=JSON.parse(localStorage.getItem('LINE_PROFILE')||'null'); const lineId=prof?.userId||null; if(lineId){ const u=await supabase.from('users').select('role').eq('line_user_id',lineId).maybeSingle(); if(u.data && (u.data.role==='admin'||u.data.role==='editor')) return true; } const auth=await supabase.auth.getUser(); const user=auth.data&&auth.data.user; if(user){ const ed=await supabase.from('editors').select('user_id').eq('user_id',user.id).maybeSingle(); if(ed.data) return true; } return false; }
function openComposeSheet(){
  const form = `<div class='form-grid'>
    <div><label>ชื่อแอป/ระบบ</label><input name='title' required></div>
    <div><label>URL</label><input name='url' required placeholder='https://...'></div>
    <div><label>รูปแอป (image_url)</label><input name='image_url' placeholder='https://...'></div>
    <div class='grid grid-cols-2 gap-2'>
      <div><label>หมวด</label><input name='category' placeholder='ทั่วไป'></div>
      <div><label>ลำดับแสดง</label><input name='sort_order' type='number' value='100'></div>
    </div>
    <label class='text-sm flex items-center gap-2'><input type='checkbox' name='is_active' checked> แสดงผล</label>
  </div>`;
  openSheet(form, { title:'เพิ่มลิงก์', actions:`<div class='flex gap-2 justify-end'>
    <button class='btn' id='cancelLink'>ยกเลิก</button>
    <button class='btn btn-prim' id='okLink'>บันทึก</button>
  </div>` });
  const cancel=document.getElementById('cancelLink'); if(cancel) cancel.onclick=closeSheet;
  const ok=document.getElementById('okLink');
  if(ok) ok.onclick=async()=>{
    const box=document.getElementById('sheet-body');
    const fd=new FormData(box.closest('.panel'));
    const payload={
      title:fd.get('title'),
      url:fd.get('url'),
      image_url:fd.get('image_url')||null,
      category:fd.get('category')||null,
      sort_order:Number(fd.get('sort_order')||100),
      is_active:!!fd.get('is_active')
    };
    const ins=await supabase.from('app_links').insert(payload);
    if(ins.error){ toast('บันทึกไม่สำเร็จ'); return; }
    toast('เพิ่มลิงก์แล้ว'); closeSheet(); await import('./links.js').then(m=>m.render());
  };
}; const ins=await supabase.from('app_links').insert(payload); if(ins.error){ toast('บันทึกไม่สำเร็จ'); return; } toast('เพิ่มลิงก์แล้ว'); closeSheet(); await import('./links.js').then(m=>m.render()); }; } }
function openEditSheet(r){
  const form = `<div class='form-grid'>
    <div><label>ชื่อแอป/ระบบ</label><input name='title' value='${esc(r.title||"")}'></div>
    <div><label>URL</label><input name='url' value='${esc(r.url||"")}'></div>
    <div><label>รูปแอป (image_url)</label><input name='image_url' value='${esc(r.image_url||"")}'></div>
    <div class='grid grid-cols-2 gap-2'>
      <div><label>หมวด</label><input name='category' value='${esc(r.category||"")}'></div>
      <div><label>ลำดับแสดง</label><input name='sort_order' type='number' value='${(r.sort_order!=null)?r.sort_order:100}'></div>
    </div>
    <label class='text-sm flex items-center gap-2'><input type='checkbox' name='is_active' ${r.is_active?'checked':''}> แสดงผล</label>
  </div>`;
  openSheet(form, { title:'แก้ไขลิงก์', actions:`<div class='flex gap-2 justify-between'>
    <button class='btn' id='cancelLink'>ยกเลิก</button>
    <div class='flex gap-2'>
      <button class='btn' id='delLink'>ลบ</button>
      <button class='btn btn-prim' id='okLink'>บันทึก</button>
    </div>
  </div>` });
  const cancel=document.getElementById('cancelLink'); if(cancel) cancel.onclick=closeSheet;
  const del=document.getElementById('delLink'); if(del) del.onclick=async()=>{ if(!confirm('ลบรายการนี้?'))return; await supabase.from('app_links').delete().eq('id',r.id); closeSheet(); await import('./links.js').then(m=>m.render()); };
  const ok=document.getElementById('okLink');
  if(ok) ok.onclick=async()=>{
    const box=document.getElementById('sheet-body');
    const fd=new FormData(box.closest('.panel'));
    const upd={
      title:fd.get('title'),
      url:fd.get('url'),
      image_url:fd.get('image_url')||null,
      category:fd.get('category')||null,
      sort_order:Number(fd.get('sort_order')||100),
      is_active:!!fd.get('is_active')
    };
    const up=await supabase.from('app_links').update(upd).eq('id',r.id);
    if(up.error){ toast('บันทึกไม่สำเร็จ'); return; }
    toast('อัปเดตแล้ว'); closeSheet(); await import('./links.js').then(m=>m.render());
  };
}'><input name='url' class='border rounded p-2' value='${esc(r.url||'')}'><input name='image_url' class='border rounded p-2' value='${esc(r.image_url||'')}' placeholder='รูปแอป (image_url)'><input name='category' class='border rounded p-2' value='${esc(r.category||'')}'><div class='grid grid-cols-2 gap-2'><input name='sort_order' type='number' class='border rounded p-2' value='${sortVal}'><label class='text-sm flex items-center gap-2'><input type='checkbox' name='is_active' ${r.is_active?'checked':''}> แสดงผล</label></div><div class='flex gap-2'><button class='btn btn-prim'>บันทึก</button><button type='button' id='cancelSheet' class='btn'>ยกเลิก</button></div></form>`); const cancel=document.getElementById('cancelSheet'); if(cancel) cancel.onclick=closeSheet; const form=document.getElementById('editLinkForm'); if(form){ form.onsubmit=async e=>{ e.preventDefault(); const fd=new FormData(form); const upd={ title:fd.get('title'), url:fd.get('url'), image_url:fd.get('image_url')||null, category:fd.get('category')||null, sort_order:Number(fd.get('sort_order')||100), is_active:!!fd.get('is_active') }; const up=await supabase.from('app_links').update(upd).eq('id',r.id); if(up.error){ toast('บันทึกไม่สำเร็จ'); return; } toast('อัปเดตแล้ว'); closeSheet(); await import('./links.js').then(m=>m.render()); }; } }