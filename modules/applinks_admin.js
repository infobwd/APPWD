
import { supabase } from '../api.js';
import { toast } from '../ui.js';
const esc = s => { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; };
async function fetchLinks(){
  const { data, error } = await supabase.from('app_links').select('id,title,url,image_url,category,sort_order,is_active').order('category',{ascending:true}).order('sort_order',{ascending:true}).order('title',{ascending:true});
  if(error) throw error; return data||[];
}
async function upsertLink(row){
  const { data, error } = await supabase.from('app_links').upsert(row,{ onConflict:'id' }).select();
  if(error) throw error; return data?.[0]||row;
}
async function deleteLink(id){
  const { error } = await supabase.from('app_links').delete().eq('id', id);
  if(error) throw error;
}
function formHTML(r){
  return `<form class="applinks-form space-y-3" data-id="${r?.id||''}">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label class="block"><div class="text-xs text-slate-500 mb-1">ชื่อ (title)</div><input class="w-full p-2 rounded border border-slate-300" name="title" value="${esc(r?.title||'')}" required></label>
      <label class="block"><div class="text-xs text-slate-500 mb-1">หมวดหมู่ (category)</div><input class="w-full p-2 rounded border border-slate-300" name="category" value="${esc(r?.category||'')}"></label>
    </div>
    <label class="block"><div class="text-xs text-slate-500 mb-1">ลิงก์ (url)</div><input class="w-full p-2 rounded border border-slate-300" name="url" value="${esc(r?.url||'')}" required></label>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <label class="block"><div class="text-xs text-slate-500 mb-1">ภาพ (image_url)</div><input class="w-full p-2 rounded border border-slate-300" name="image_url" value="${esc(r?.image_url||'')}"></label>
      <label class="block"><div class="text-xs text-slate-500 mb-1">ลำดับ (sort_order)</div><input type="number" class="w-full p-2 rounded border border-slate-300" name="sort_order" value="${esc(r?.sort_order ?? 100)}"></label>
      <label class="inline-flex items-center gap-2 mt-6"><input type="checkbox" name="is_active" ${r?.is_active===false?'':'checked'}> <span>ใช้งาน</span></label>
    </div>
    <div class="flex items-center gap-2">
      <button type="submit" class="px-3 py-2 rounded-lg bg-blue-600 text-white">บันทึก</button>
      ${r?.id?`<button type="button" class="px-3 py-2 rounded-lg border border-red-500 text-red-600" data-delete="${r.id}">ลบ</button>`:''}
    </div>
  </form>`;
}
function listItemHTML(r){
  return `<div class="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
    <div class="min-w-0"><div class="font-medium truncate">${esc(r.title)}</div><div class="text-xs text-slate-500 truncate">${esc(r.url)}</div></div>
    <div class="flex items-center gap-2 flex-shrink-0">
      <span class="text-xs px-2 py-0.5 rounded ${r.is_active===false?'bg-slate-200 text-slate-600':'bg-green-100 text-green-700'}">${r.is_active===false?'ปิดใช้งาน':'ใช้งาน'}</span>
      <button class="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50" data-edit="${r.id}">แก้ไข</button>
    </div></div>`;
}
export async function renderAppLinksAdmin(containerId='applinksAdmin'){
  const host = document.getElementById(containerId); if(!host) return;
  host.innerHTML = `<div class="p-4 border border-slate-200 rounded-xl bg-white">
    <div class="flex items-center justify-between mb-3"><h3 class="text-base font-semibold">จัดการ “แอป/ระบบในโรงเรียน”</h3><button id="btnNewAppLink" class="px-3 py-2 rounded-lg bg-blue-600 text-white">เพิ่มรายการ</button></div>
    <div id="applinksList" class="space-y-2"></div><div id="applinksEditor" class="mt-4"></div></div>`;
  const listEl = document.getElementById('applinksList'); const editorEl = document.getElementById('applinksEditor');
  async function refresh(){
    const rows = await fetchLinks();
    listEl.innerHTML = rows.map(listItemHTML).join('') || '<div class="text-slate-500">ยังไม่มีรายการ</div>';
    listEl.querySelectorAll('[data-edit]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id = Number(btn.getAttribute('data-edit'));
        const rows2 = await fetchLinks();
        const row = rows2.find(r=>r.id===id);
        editorEl.innerHTML = formHTML(row);
        wireForm(editorEl.querySelector('form'));
      });
    });
  }
  function wireForm(form){
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        id: form.getAttribute('data-id') ? Number(form.getAttribute('data-id')) : undefined,
        title: fd.get('title'),
        category: fd.get('category') || null,
        url: fd.get('url'),
        image_url: fd.get('image_url') || null,
        sort_order: Number(fd.get('sort_order') || 100),
        is_active: fd.get('is_active') ? true : false,
      };
      await upsertLink(payload); toast('บันทึกสำเร็จ'); editorEl.innerHTML=''; await refresh();
    });
    const delBtn = form.querySelector('[data-delete]');
    if(delBtn){ delBtn.addEventListener('click', async ()=>{ const id=Number(delBtn.getAttribute('data-delete')); if(!confirm('ยืนยันการลบรายการนี้?')) return; await deleteLink(id); toast('ลบแล้ว'); editorEl.innerHTML=''; await refresh(); }); }
  }
  document.getElementById('btnNewAppLink').addEventListener('click', ()=>{ editorEl.innerHTML=formHTML(null); wireForm(editorEl.querySelector('form')); });
  await refresh();
}
