
import { supabase } from '../api.js';
import { toast } from '../ui.js';
const PAGE_SIZE = 20; let currentPage = 1; let currentQuery = '';
const esc = s => { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; };
async function fetchLinks(page=1,q=''){
  const from=(page-1)*PAGE_SIZE, to=from+PAGE_SIZE-1;
  let rq = supabase.from('app_links').select('id,title,url,image_url,category,sort_order,is_active',{count:'exact'}).order('category',{ascending:true}).order('sort_order',{ascending:true}).order('title',{ascending:true}).range(from,to);
  if(q && q.trim()){ const qq=`%${q.trim()}%`; rq = rq.or(`title.ilike.${qq},url.ilike.${qq},category.ilike.${qq}`); }
  const { data, count, error } = await rq; if(error) throw error; return { rows:data||[], total:count||0 };
}
async function upsertLink(row){ const { data, error } = await supabase.from('app_links').upsert(row,{onConflict:'id'}).select(); if(error) throw error; return data?.[0]||row; }
async function deleteLink(id){ const { error } = await supabase.from('app_links').delete().eq('id',id); if(error) throw error; }
function formHTML(r){ return `<form class="post-editor post-form space-y-3" data-id="${r?.id||''}">
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <label class="form-group block"><div class="form-label text-xs text-slate-500 mb-1">ชื่อ (title)</div><input class="form-control w-full p-2 rounded border border-slate-300" name="title" value="${esc(r?.title||'')}" required></label>
    <label class="form-group block"><div class="form-label text-xs text-slate-500 mb-1">หมวดหมู่ (category)</div><input class="form-control w-full p-2 rounded border border-slate-300" name="category" value="${esc(r?.category||'')}"></label>
  </div>
  <label class="form-group block"><div class="form-label text-xs text-slate-500 mb-1">ลิงก์ (url)</div><input class="form-control w-full p-2 rounded border border-slate-300" name="url" value="${esc(r?.url||'')}" required></label>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <label class="form-group block"><div class="form-label text-xs text-slate-500 mb-1">ภาพ (image_url)</div><input class="form-control w-full p-2 rounded border border-slate-300" name="image_url" value="${esc(r?.image_url||'')}"></label>
    <label class="form-group block"><div class="form-label text-xs text-slate-500 mb-1">ลำดับ (sort_order)</div><input type="number" class="form-control w-full p-2 rounded border border-slate-300" name="sort_order" value="${esc(r?.sort_order ?? 100)}"></label>
    <label class="form-group inline-flex items-center gap-2 mt-6"><input type="checkbox" name="is_active" ${r?.is_active===false?'':'checked'}> <span>ใช้งาน</span></label>
  </div>
  <div class="flex items-center gap-2">
    <button type="submit" class="btn btn-primary px-3 py-2 rounded-lg">บันทึก</button>
    ${r?.id?`<button type="button" class="btn btn-danger px-3 py-2 rounded-lg" data-delete="${r.id}">ลบ</button>`:''}
  </div></form>`; }
function listItemHTML(r){ return `<div class="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
  <div class="min-w-0"><div class="font-medium truncate">${esc(r.title)}</div><div class="text-xs text-slate-500 truncate">${esc(r.url)}</div></div>
  <div class="flex items-center gap-2 flex-shrink-0"><span class="text-xs px-2 py-0.5 rounded ${r.is_active===false?'bg-slate-200 text-slate-600':'bg-green-100 text-green-700'}">${r.is_active===false?'ปิดใช้งาน':'ใช้งาน'}</span><button class="btn btn-outline px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50" data-edit="${r.id}">แก้ไข</button></div></div>`; }
function paginator(total, ps, page){ const totalPages=Math.max(1,Math.ceil(total/ps)); return `<div class="mt-4 flex items-center justify-between gap-2"><button class="btn btn-outline btn-sm" data-prev ${page<=1?'disabled':''}>&laquo; ก่อนหน้า</button><div class="text-sm text-slate-600">หน้า ${page} / ${totalPages}</div><button class="btn btn-outline btn-sm" data-next ${page>=totalPages?'disabled':''}>ถัดไป &raquo;</button></div>`; }
export async function renderAppLinksAdmin(containerId='applinksAdmin'){
  const host=document.getElementById(containerId); if(!host) return;
  host.innerHTML=`<div class="post-editor p-4 border border-slate-200 rounded-xl bg-white">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-base font-semibold">จัดการ “แอป/ระบบในโรงเรียน”</h3>
      <div class="flex items-center gap-2">
        <input id="applinksSearch" class="form-control w-48 p-2 rounded border border-slate-300" placeholder="ค้นหา...">
        <button id="btnNewAppLink" class="btn btn-primary px-3 py-2 rounded-lg">เพิ่มรายการ</button>
      </div>
    </div>
    <div id="applinksList" class="space-y-2"></div>
    <div id="applinksPager"></div>
    <div id="applinksEditor" class="mt-4"></div>
  </div>`;
  const listEl=document.getElementById('applinksList'), editorEl=document.getElementById('applinksEditor'), pagerEl=document.getElementById('applinksPager'), searchEl=document.getElementById('applinksSearch');
  async function refresh(){
    const { rows, total } = await fetchLinks(currentPage, currentQuery);
    listEl.innerHTML = rows.map(listItemHTML).join('') || '<div class="text-slate-500">ยังไม่มีรายการ</div>';
    pagerEl.innerHTML = paginator(total, PAGE_SIZE, currentPage);
    listEl.querySelectorAll('[data-edit]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id = Number(btn.getAttribute('data-edit'));
        const row = (await fetchLinks(currentPage, currentQuery)).rows.find(r=>r.id===id) || null;
        editorEl.innerHTML = formHTML(row);
        wireForm(editorEl.querySelector('form'));
      });
    });
    pagerEl.querySelector('[data-prev]')?.addEventListener('click', ()=>{ if(currentPage>1){ currentPage--; refresh(); } });
    pagerEl.querySelector('[data-next]')?.addEventListener('click', ()=>{ currentPage++; refresh(); });
  }
  function wireForm(form){
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd=new FormData(form);
      const payload={ id: form.getAttribute('data-id')?Number(form.getAttribute('data-id')):undefined, title:fd.get('title'), category:fd.get('category')||null, url:fd.get('url'), image_url:fd.get('image_url')||null, sort_order:Number(fd.get('sort_order')||100), is_active: fd.get('is_active')?true:false };
      await upsertLink(payload); toast('บันทึกสำเร็จ'); editorEl.innerHTML=''; await refresh();
    });
    const delBtn=form.querySelector('[data-delete]'); if(delBtn){ delBtn.addEventListener('click', async ()=>{ const id=Number(delBtn.getAttribute('data-delete')); if(!confirm('ยืนยันการลบรายการนี้?')) return; await deleteLink(id); toast('ลบแล้ว'); editorEl.innerHTML=''; await refresh(); }); }
  }
  document.getElementById('btnNewAppLink').addEventListener('click', ()=>{ editorEl.innerHTML=formHTML(null); wireForm(editorEl.querySelector('form')); });
  searchEl.addEventListener('input', ()=>{ currentQuery=searchEl.value||''; currentPage=1; refresh(); });
  await refresh();
}
