import { supabase } from '../api.js';
import { openSheet, closeSheet, toast, esc, skel } from '../ui.js';

async function canManageLinks(){
  try{
    const au = await supabase.auth.getUser();
    const uid = au?.data?.user?.id || null;
    if(!uid) return false;
    // 1) users.role (admin|editor)
    try{
      const u = (await supabase.from('users').select('role,auth_user_id').eq('auth_user_id', uid).maybeSingle()).data;
      if(u && (u.role==='admin' || u.role==='editor')) return true;
    }catch(_){}
    // 2) editors table fallback
    try{
      const e = (await supabase.from('editors').select('user_id').eq('user_id', uid).maybeSingle()).data;
      if(e) return true;
    }catch(_){}
    // 3) local hint
    const role = (JSON.parse(localStorage.getItem('APPWD_PROFILE')||'{}').role)||localStorage.getItem('APPWD_ROLE');
    return role==='admin' || role==='editor';
  }catch(_){ return false; }
}

export async function render(){
  const grid = document.getElementById('linksGrid') || document.getElementById('linksList');
  if(!grid) return;
  grid.innerHTML = skel(6,'68px');

  // compose button visibility
  const btn = document.getElementById('btnComposeLink');
  const can = await canManageLinks();
  if(btn){ btn.classList.toggle('hide', !can); btn.onclick = () => openComposeSheet(); }

  const { data, error } = await supabase
    .from('app_links')
    .select('id,title,url,image_url,category,sort_order,is_active')
    .eq('is_active', true)
    .order('category', {ascending:true})
    .order('sort_order', {ascending:true})
    .order('title', {ascending:true});

  if(error){ grid.innerHTML = `<div class='text-ink3'>โหลดรายการลิงก์ไม่สำเร็จ</div>`; return; }

  const canEdit = await canManageLinks();
  grid.innerHTML = (data||[]).map(r => linkCard(r, canEdit)).join('') || '<div class="text-ink3">ยังไม่มีลิงก์</div>';

  // attach edit handlers
  grid.querySelectorAll('[data-edit]').forEach(el=>{
    el.addEventListener('click', async (e)=>{
      const id = Number(e.currentTarget.getAttribute('data-id'));
      const row = (await supabase.from('app_links').select('*').eq('id', id).maybeSingle()).data;
      if(row) openEditSheet(row);
    });
  });
  grid.querySelectorAll('[data-del]').forEach(el=>{
    el.addEventListener('click', async (e)=>{
      const id = Number(e.currentTarget.getAttribute('data-id'));
      if(!confirm('ลบรายการนี้?')) return;
      const del = await supabase.from('app_links').delete().eq('id', id);
      if(del.error){ toast('ลบไม่สำเร็จ'); return; }
      document.dispatchEvent(new CustomEvent('appwd:linkSaved'));
      toast('ลบแล้ว','ok');
      render();
    });
  });
}

function linkCard(r, canEdit){
  const img = r.image_url
    ? `<img class='w-12 h-12 rounded-xl object-cover border' style='border-color:var(--bd)' src='${esc(r.image_url)}' onerror="this.remove()">`
    : `<div class='w-12 h-12 rounded-xl grid place-items-center bg-brandSoft text-brand'>🔗</div>`;
  const tools = canEdit ? `<div class='flex gap-2'>
      <button class='btn' data-edit data-id='${r.id}'>แก้ไข</button>
      <button class='btn' data-del data-id='${r.id}'>ลบ</button>
    </div>` : '';
  return `<div class='p-3 border rounded-xl flex items-center justify-between' style='border-color:var(--bd)'>
    <div class='flex items-center gap-3'>
      ${img}
      <div>
        <div class='font-semibold'>${esc(r.title||'')}</div>
        <div class='text-sm opacity-80'>${esc(r.category||'ทั่วไป')}</div>
      </div>
    </div>
    <div class='flex items-center gap-2'>
      <a class='btn btn-prim' href='${esc(r.url)}' target='_blank' rel='noopener'>เปิด</a>
      ${tools}
    </div>
  </div>`;
}

function openComposeSheet(){
  const form = `<form id='composeLinkForm' class='form-grid'>
    <div><label>ชื่อแอป/ระบบ</label><input name='title' required></div>
    <div><label>URL</label><input name='url' required placeholder='https://...'></div>
    <div><label>รูปแอป (image_url)</label><input name='image_url' placeholder='https://...'></div>
    <div class='grid grid-cols-2 gap-2'>
      <div><label>หมวด</label><input name='category' placeholder='ทั่วไป'></div>
      <div><label>ลำดับแสดง</label><input type='number' name='sort_order' value='100'></div>
    </div>
    <label class='text-sm flex items-center gap-2'><input type='checkbox' name='is_active' checked> แสดงผล</label>
  </form>`;
  openSheet(form, { title:'เพิ่มลิงก์', actions:`<div class='flex gap-2 justify-end'>
    <button class='btn' id='cancelLink'>ยกเลิก</button>
    <button class='btn btn-prim' id='okLink'>บันทึก</button>
  </div>` });
  const cancel=document.getElementById('cancelLink'); if(cancel) cancel.onclick=closeSheet;
  const ok=document.getElementById('okLink'); if(ok) ok.onclick=async()=>{
    const fd = new FormData(document.getElementById('composeLinkForm'));
    const ins = await supabase.from('app_links').insert({
      title: fd.get('title'),
      url: fd.get('url'),
      image_url: fd.get('image_url')||null,
      category: fd.get('category')||null,
      sort_order: Number(fd.get('sort_order')||100),
      is_active: !!fd.get('is_active')
    }).select().single();
    if(ins.error){ toast('เพิ่มลิงก์ไม่สำเร็จ'); return; }
    document.dispatchEvent(new CustomEvent('appwd:linkSaved'));
    toast('เพิ่มลิงก์แล้ว','ok'); closeSheet(); render();
  };
}

function openEditSheet(r){
  const form = `<form id='editLinkForm' class='form-grid'>
    <div><label>ชื่อแอป/ระบบ</label><input name='title' value='${esc(r.title||'')}' required></div>
    <div><label>URL</label><input name='url' value='${esc(r.url||'')}' required></div>
    <div><label>รูปแอป (image_url)</label><input name='image_url' value='${esc(r.image_url||'')}'></div>
    <div class='grid grid-cols-2 gap-2'>
      <div><label>หมวด</label><input name='category' value='${esc(r.category||'')}'></div>
      <div><label>ลำดับแสดง</label><input type='number' name='sort_order' value='${Number(r.sort_order||100)}'></div>
    </div>
    <label class='text-sm flex items-center gap-2'><input type='checkbox' name='is_active' ${r.is_active?'checked':''}> แสดงผล</label>
  </form>`;
  openSheet(form, { title:'แก้ไขลิงก์', actions:`<div class='flex gap-2 justify-between w-full'>
    <button class='btn' id='delLink'>ลบ</button>
    <div class='flex gap-2'>
      <button class='btn' id='cancelLink'>ยกเลิก</button>
      <button class='btn btn-prim' id='okLink'>บันทึก</button>
    </div>
  </div>` });

  const cancel=document.getElementById('cancelLink'); if(cancel) cancel.onclick=closeSheet;
  const del=document.getElementById('delLink'); if(del) del.onclick=async()=>{
    if(!confirm('ลบรายการนี้?')) return;
    const del = await supabase.from('app_links').delete().eq('id', r.id);
    if(del.error){ toast('ลบไม่สำเร็จ'); return; }
    document.dispatchEvent(new CustomEvent('appwd:linkSaved'));
    toast('ลบแล้ว','ok'); closeSheet(); render();
  };
  const ok=document.getElementById('okLink');
  if(ok) ok.onclick=async()=>{
    const fd = new FormData(document.getElementById('editLinkForm'));
    const up = await supabase.from('app_links').update({
      title: fd.get('title'),
      url: fd.get('url'),
      image_url: fd.get('image_url') || null,
      category: fd.get('category') || null,
      sort_order: Number(fd.get('sort_order') || 100),
      is_active: !!fd.get('is_active')
    }).eq('id', r.id);
    if(up.error){ toast('บันทึกไม่สำเร็จ'); return; }
    document.dispatchEvent(new CustomEvent('appwd:linkSaved'));
    toast('บันทึกแล้ว','ok'); closeSheet(); render();
  };
}

export async function renderHome(){
  const box = document.getElementById('homeLinks'); if(!box) return;
  box.innerHTML = `<div class="skeleton h-[68px]"></div>`;
  const { data, error } = await supabase.from('app_links')
    .select('id,title,url,desc,image_url,sort_order,is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })
    .limit(8);
  if(error){ box.innerHTML = `<div class="text-ink3">โหลดลิงก์ไม่สำเร็จ</div>`; return; }
  box.innerHTML = (data||[]).map(r => `
    <div class="p-3 border rounded-xl bg-[var(--card)] text-center" style="border-color:var(--bd)">
      ${r.image_url
        ? `<img src="${esc(r.image_url)}" class="w-12 h-12 rounded-xl object-cover mx-auto mb-2 border" style="border-color:var(--bd)" onerror="this.remove()">`
        : `<div class="w-12 h-12 rounded-xl grid place-items-center mx-auto mb-2 bg-brandSoft text-brand">🔗</div>`}
      <div class="text-sm font-semibold line-clamp-2" style="color:var(--ink)">${esc(r.title)}</div>
      <a class="btn btn-prim mt-2 text-xs" href="${esc(r.url)}" target="_blank" rel="noopener">เปิด</a>
    </div>
  `).join('') || `<div class="text-ink3">ยังไม่มีลิงก์</div>`;
}
