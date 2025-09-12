
// modules/links.js — clean rewrite (ES modules safe)

import { supabase } from '../api.js';
import { openSheet, closeSheet, toast, esc, skel } from '../ui.js';

/* ---------- PUBLIC RENDER API ---------- */
export async function render(){
  const container = document.getElementById('linksGrid') || document.getElementById('linksList');
  if(!container) return;
  container.innerHTML = skel(6,'68px');

  const btn = document.getElementById('btnComposeLink');
  const canEdit = await canManageLinks();
  if(btn){ btn.classList.toggle('hide', !canEdit); btn.onclick = ()=> openComposeSheet(); }

  const { data, error } = await supabase
    .from('app_links')
    .select('id,title,url,image_url,category,sort_order,is_active')
    .order('category', {ascending:true})
    .order('sort_order', {ascending:true})
    .order('title', {ascending:true});

  if(error){
    container.innerHTML = `<div class='text-ink3'>โหลดลิงก์ไม่สำเร็จ</div>`;
    return;
  }
  const rows = (data||[]).filter(r => r.is_active !== false);
  if(rows.length === 0){
    container.innerHTML = `<div class='text-ink3'>ยังไม่มีลิงก์</div>`;
  }else{
    container.innerHTML = rows.map(r => card(r, canEdit)).join('');
    // delegate edit buttons
    container.querySelectorAll('[data-edit]').forEach(el=>{
      el.addEventListener('click', async (e)=>{
        e.preventDefault();
        const id = Number(e.currentTarget.getAttribute('data-id'));
        const row = (await supabase.from('app_links').select('*').eq('id', id).maybeSingle()).data;
        if(row) openEditSheet(row);
      });
    });
  }
}

export async function renderHome(){
  const box = document.getElementById('homeLinks') || document.getElementById('homeApps') || document.getElementById('homeLinksGrid');
  if(!box) return;
  box.innerHTML = skel(4,'72px');
  const { data, error } = await supabase
    .from('app_links')
    .select('id,title,url,image_url,category,sort_order,is_active')
    .order('sort_order',{ascending:true})
    .limit(8);
  if(error){ box.innerHTML = `<div class='text-ink3'>โหลดลิงก์ไม่สำเร็จ</div>`; return; }
  const rows = (data||[]).filter(r => r.is_active !== false);
  box.innerHTML = (rows.length ? rows.map(r => homeItem(r)).join('') : `<div class='text-ink3'>ยังไม่มีลิงก์</div>`);
}

/* ---------- VIEW HELPERS ---------- */
function card(r, canEdit){
  const img = r.image_url
    ? `<img class='w-12 h-12 rounded-xl object-cover border' style='border-color:var(--bd)' src='${r.image_url}' alt=''>`
    : `<div class='w-12 h-12 rounded-xl grid place-items-center bg-brandSoft text-brand'>🔗</div>`;
  const tools = canEdit ? `<div class='ml-auto'><button class='btn text-xs' data-edit data-id='${r.id}'>แก้ไข</button></div>` : '';
  return `<a class='p-3 border rounded-xl bg-[var(--card)] flex items-center gap-3' style='border-color:var(--bd)' href='${r.url}' target='_blank' rel='noopener'>
    ${img}
    <div class='flex-1'>
      <div class='font-semibold leading-snug' style='color:var(--ink)'>${esc(r.title)}</div>
      <div class='text-[12px] text-ink3'>${esc(r.category||'ทั่วไป')}</div>
    </div>
    ${tools}
  </a>`;
}

function homeItem(r){
  const img = r.image_url
    ? `<img class='w-10 h-10 rounded-xl object-cover border' style='border-color:var(--bd)' src='${r.image_url}' alt=''>`
    : `<div class='w-10 h-10 rounded-xl grid place-items-center bg-brandSoft text-brand'>🔗</div>`;
  return `<a class='p-3 border rounded-xl bg-[var(--card)] flex items-center gap-3' style='border-color:var(--bd)' href='${r.url}' target='_blank' rel='noopener'>
    ${img}
    <div class='flex-1'>
      <div class='font-medium leading-snug' style='color:var(--ink)'>${esc(r.title)}</div>
      <div class='text-[12px] text-ink3'>${esc(r.category||'ทั่วไป')}</div>
    </div>
  </a>`;
}

/* ---------- PERMISSION ---------- */
async function canManageLinks(){
  const auth = await supabase.auth.getUser();
  const user = auth.data && auth.data.user;
  if(user){
    const ed = await supabase.from('editors').select('user_id').eq('user_id', user.id).maybeSingle();
    if(ed.data) return true;
  }
  const prof = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  const lineId = prof?.userId || null;
  if(lineId){
    const u = await supabase.from('users').select('role').eq('line_user_id', lineId).maybeSingle();
    if(u.data && (u.data.role==='admin'||u.data.role==='editor')) return true;
  }
  return false;
}

/* ---------- SHEETS ---------- */
function openComposeSheet(){
  const html = `<form id='composeLinkForm' class='form-grid'>
    <div><label>ชื่อแอป/ระบบ</label><input name='title' required></div>
    <div><label>URL</label><input name='url' required placeholder='https://...'></div>
    <div><label>รูปแอป (image_url)</label><input name='image_url' placeholder='https://...'></div>
    <div class='grid grid-cols-2 gap-2'>
      <div><label>หมวด</label><input name='category' placeholder='ทั่วไป'></div>
      <div><label>ลำดับแสดง</label><input type='number' name='sort_order' value='100'></div>
    </div>
    <label class='text-sm flex items-center gap-2'><input type='checkbox' name='is_active' checked> แสดงผล</label>
  </form>`;
  openSheet(html, { title:'เพิ่มลิงก์', actions:`<div class='flex gap-2 justify-end'>
    <button class='btn' id='cancelLink'>ยกเลิก</button>
    <button class='btn btn-prim' id='okLink'>บันทึก</button>
  </div>` });
  const cancel = document.getElementById('cancelLink'); if(cancel) cancel.onclick = closeSheet;
  const ok = document.getElementById('okLink');
  if(ok) ok.onclick = async ()=>{
    const fd = new FormData(document.getElementById('composeLinkForm'));
    const payload = {
      title: fd.get('title'),
      url: fd.get('url'),
      image_url: fd.get('image_url') || null,
      category: fd.get('category') || null,
      sort_order: Number(fd.get('sort_order') || 100),
      is_active: !!fd.get('is_active')
    };
    const ins = await supabase.from('app_links').insert(payload);
    if(ins.error){ toast('บันทึกไม่สำเร็จ','error'); return; }
    toast('เพิ่มลิงก์แล้ว','ok'); closeSheet();
    try{ await import('./links.js').then(m=>m.render()); }catch(_){}
    try{ await import('./links.js').then(m=>m.renderHome()); }catch(_){}
  };
}

function openEditSheet(r){
  const html = `<form id='editLinkForm' class='form-grid'>
    <div><label>ชื่อแอป/ระบบ</label><input name='title' value='${esc(r.title||"")}'></div>
    <div><label>URL</label><input name='url' value='${esc(r.url||"")}'></div>
    <div><label>รูปแอป (image_url)</label><input name='image_url' value='${esc(r.image_url||"")}'></div>
    <div class='grid grid-cols-2 gap-2'>
      <div><label>หมวด</label><input name='category' value='${esc(r.category||"")}'></div>
      <div><label>ลำดับแสดง</label><input type='number' name='sort_order' value='${(r.sort_order!=null)?r.sort_order:100}'></div>
    </div>
    <label class='text-sm flex items-center gap-2'><input type='checkbox' name='is_active' ${r.is_active?'checked':''}> แสดงผล</label>
  </form>`;
  openSheet(html, { title:'แก้ไขลิงก์', actions:`<div class='flex gap-2 justify-between'>
    <button class='btn' id='cancelLink'>ยกเลิก</button>
    <div class='flex gap-2'>
      <button class='btn' id='delLink'>ลบ</button>
      <button class='btn btn-prim' id='okLink'>บันทึก</button>
    </div>
  </div>` });
  const cancel = document.getElementById('cancelLink'); if(cancel) cancel.onclick = closeSheet;
  const del = document.getElementById('delLink');
  if(del) del.onclick = async ()=>{
    if(!confirm('ลบรายการนี้?')) return;
    await supabase.from('app_links').delete().eq('id', r.id);
    closeSheet(); toast('ลบแล้ว','ok');
    try{ await import('./links.js').then(m=>m.render()); }catch(_){}
    try{ await import('./links.js').then(m=>m.renderHome()); }catch(_){}
  };
  const ok = document.getElementById('okLink');
  if(ok) ok.onclick = async ()=>{
    const fd = new FormData(document.getElementById('editLinkForm'));
    const upd = {
      title: fd.get('title'),
      url: fd.get('url'),
      image_url: fd.get('image_url') || null,
      category: fd.get('category') || null,
      sort_order: Number(fd.get('sort_order') || 100),
      is_active: !!fd.get('is_active')
    };
    const up = await supabase.from('app_links').update(upd).eq('id', r.id);
    if(up.error){ toast('บันทึกไม่สำเร็จ','error'); return; }
    toast('อัปเดตแล้ว','ok'); closeSheet();
    try{ await import('./links.js').then(m=>m.render()); }catch(_){}
    try{ await import('./links.js').then(m=>m.renderHome()); }catch(_){}
  };
}

/* ---------- LEGACY BUTTON HELPERS (optional) ---------- */
window.editLink = async function(id){
  const row = (await supabase.from('app_links').select('*').eq('id', id).maybeSingle()).data;
  if(row) openEditSheet(row);
};
window.deleteLink = async function(id){
  if(!confirm('ลบรายการนี้?')) return;
  await supabase.from('app_links').delete().eq('id', id);
  toast('ลบแล้ว','ok');
  try{ await import('./links.js').then(m=>m.render()); }catch(_){}
  try{ await import('./links.js').then(m=>m.renderHome()); }catch(_){}
};
