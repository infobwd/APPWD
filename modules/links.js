import { supabase } from '../api.js';
import { openSheet, closeSheet, toast, skel, esc } from '../ui.js';

const homeGrid=()=>document.getElementById('homeLinks');
const grid=()=>document.getElementById('linkGrid');
const composeBtn=()=>document.getElementById('btnComposeLink');

export async function renderHome(){
  if(!homeGrid()) return;
  homeGrid().innerHTML = skel(8);
  const { data } = await supabase.from('app_links').select('id,title,url,image_url,category').eq('is_active', true).order('sort_order').limit(8);
  homeGrid().innerHTML = (data||[]).map(tile).join('') || '<div class="text-gray-500">ยังไม่มีลิงก์</div>';
}

export async function render(){
  if(!grid()) return;
  grid().innerHTML = skel(10);
  const editor = await isEditor();
  const btn = composeBtn();
  if(btn){ btn.classList.toggle('hide', !editor); btn.onclick = ()=> openComposeSheet(); }
  const { data } = await supabase.from('app_links').select('id,title,url,image_url,category,is_active,sort_order').order('sort_order');
  grid().innerHTML = (data||[]).map(row => tile(row,true,editor)).join('') || '<div class="text-gray-500">ยังไม่มีลิงก์</div>';
}

function tile(row, full=false, editor=false){
  const img = row.image_url ? `<img src="${row.image_url}" class="w-12 h-12 object-cover rounded-2xl border border-[#E6EAF0]" alt="icon">`
                            : `<div class="w-12 h-12 rounded-2xl grid place-items-center bg-brandSoft text-brand">🔗</div>`;
  const actions = editor && full ? `<div class="flex gap-2 justify-center mt-1">
      <button class="btn text-xs" onclick="editLink(${row.id})">แก้ไข</button>
      <button class="btn text-xs" onclick="deleteLink(${row.id})">ลบ</button>
    </div>` : '';
  return `<div class="flex flex-col items-center gap-1">
      <a href="${encodeURI(row.url)}" target="_blank" rel="noopener">
        ${img}
        <div class="text-[12px] text-center leading-tight mt-1">${esc(row.title)}</div>
      </a>
      ${actions}
    </div>`;
}

window.editLink = async function(id){
  const { data: r } = await supabase.from('app_links').select('*').eq('id',id).maybeSingle();
  if(!r) return alert('ไม่พบรายการ');
  openEditSheet(r);
};
window.deleteLink = async function(id){
  if(!confirm('ลบรายการนี้?')) return;
  const { error } = await supabase.from('app_links').delete().eq('id',id);
  if(error) return toast('ลบไม่สำเร็จ');
  toast('ลบแล้ว'); await import('./links.js').then(m=>m.render());
};

async function isEditor(){
  const { data: session } = await supabase.auth.getUser();
  const u = session.user; if(!u) return false;
  const { data } = await supabase.from('editors').select('user_id').eq('user_id', u.id).maybeSingle();
  return !!data;
}

function openComposeSheet(){
  openSheet(`<form id="composeLinkForm" class="grid gap-2 text-sm">
    <input name="title" placeholder="ชื่อแอป/ระบบ" class="border border-[#E6EAF0] rounded p-2" required>
    <input name="url" placeholder="URL" class="border border-[#E6EAF0] rounded p-2" required>
    <input name="image_url" placeholder="รูปแอป (image_url)" class="border border-[#E6EAF0] rounded p-2">
    <input name="category" placeholder="หมวด (ถ้ามี)" class="border border-[#E6EAF0] rounded p-2">
    <div class="grid grid-cols-2 gap-2">
      <input name="sort_order" type="number" placeholder="ลำดับแสดง (ตัวเลข)" class="border border-[#E6EAF0] rounded p-2" value="100">
      <label class="text-sm flex items-center gap-2"><input type="checkbox" name="is_active" checked> แสดงผล</label>
    </div>
    <div class="flex gap-2"><button class="btn btn-prim">บันทึก</button><button type="button" id="cancelSheet" class="btn">ยกเลิก</button></div>
  </form>`);
  const cancel=document.getElementById('cancelSheet'); if(cancel) cancel.onclick = closeSheet;
  const form = document.getElementById('composeLinkForm');
  if(form){ form.onsubmit = async (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      title: fd.get('title'), url: fd.get('url'), image_url: fd.get('image_url')||null,
      category: fd.get('category')||null, sort_order: Number(fd.get('sort_order')||100),
      is_active: !!fd.get('is_active')
    };
    const { error } = await supabase.from('app_links').insert(payload);
    if(error){ toast('บันทึกไม่สำเร็จ'); return; }
    toast('เพิ่มลิงก์แล้ว'); closeSheet(); await import('./links.js').then(m=>m.render());
  };}
}

function openEditSheet(r){
  openSheet(`<form id="editLinkForm" class="grid gap-2 text-sm">
    <input name="title" class="border border-[#E6EAF0] rounded p-2" value="${esc(r.title||'')}">
    <input name="url" class="border border-[#E6EAF0] rounded p-2" value="${esc(r.url||'')}">
    <input name="image_url" class="border border-[#E6EAF0] rounded p-2" value="${esc(r.image_url||'')}" placeholder="รูปแอป (image_url)">
    <input name="category" class="border border-[#E6EAF0] rounded p-2" value="${esc(r.category||'')}">
    <div class="grid grid-cols-2 gap-2">
      <input name="sort_order" type="number" class="border border-[#E6EAF0] rounded p-2" value="${r.sort_order??100}">
      <label class="text-sm flex items-center gap-2"><input type="checkbox" name="is_active" ${r.is_active?'checked':''}> แสดงผล</label>
    </div>
    <div class="flex gap-2"><button class="btn btn-prim">บันทึก</button><button type="button" id="cancelSheet" class="btn">ยกเลิก</button></div>
  </form>`);
  const cancel=document.getElementById('cancelSheet'); if(cancel) cancel.onclick = closeSheet;
  const form=document.getElementById('editLinkForm');
  if(form){ form.onsubmit = async (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const upd = {
      title: fd.get('title'), url: fd.get('url'), image_url: fd.get('image_url')||null,
      category: fd.get('category')||null, sort_order: Number(fd.get('sort_order')||100),
      is_active: !!fd.get('is_active')
    };
    const { error } = await supabase.from('app_links').update(upd).eq('id', r.id);
    if(error){ toast('บันทึกไม่สำเร็จ'); return; }
    toast('อัปเดตแล้ว'); closeSheet(); await import('./links.js').then(m=>m.render());
  };}
}
