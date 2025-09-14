
import { supabase } from '../api.js';
import { toast } from '../ui.js';

const PAGE_SIZE = 20;
let state = { page: 0, total: 0, rows: [] };

const esc = s => { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; };
const $ = (sel, root=document) => root.querySelector(sel);

async function fetchPage(page=0){
  const from = page*PAGE_SIZE;
  const to   = from + PAGE_SIZE - 1;
  const { data, error, count } = await supabase
    .from('app_links')
    .select('id,title,url,image_url,category,sort_order,is_active', { count: 'exact' })
    .order('category', { ascending:true })
    .order('sort_order', { ascending:true })
    .order('title', { ascending:true })
    .range(from, to);
  if (error) throw error;
  state = { page, total: count||0, rows: data||[] };
  return state;
}

async function upsertLink(row){
  const { data, error } = await supabase.from('app_links').upsert(row, { onConflict:'id' }).select();
  if (error) throw error;
  return data?.[0] || row;
}
async function deleteLink(id){
  const { error } = await supabase.from('app_links').delete().eq('id', id);
  if (error) throw error;
}

function openModal(title, contentHTML, onSave){
  document.querySelector('.modal-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-header"><div class="font-semibold">${esc(title)}</div><button class="modal-close" aria-label="close">×</button></div>
      <div class="modal-body">${contentHTML}</div>
      <div class="modal-footer"><button class="btn" id="btnCancel">ยกเลิก</button><button class="btn btn-primary" id="btnSave">บันทึก</button></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').onclick = () => overlay.remove();
  overlay.querySelector('#btnCancel').onclick = () => overlay.remove();
  overlay.querySelector('#btnSave').onclick = async () => { await onSave(); overlay.remove(); };
  return overlay;
}

function formHTML(r){
  return `
  <form id="applinksForm" class="space-y-3" data-id="${r?.id||''}">
    <div class="form-row">
      <label class="block"><div class="text-xs text-slate-500 mb-1">ชื่อ (title)</div><input class="w-full p-2 rounded border border-slate-300" name="title" value="${esc(r?.title||'')}" required></label>
      <label class="block"><div class="text-xs text-slate-500 mb-1">หมวดหมู่ (category)</div><input class="w-full p-2 rounded border border-slate-300" name="category" value="${esc(r?.category||'')}"></label>
    </div>
    <label class="block"><div class="text-xs text-slate-500 mb-1">ลิงก์ (url)</div><input class="w-full p-2 rounded border border-slate-300" name="url" value="${esc(r?.url||'')}" required></label>
    <div class="form-row">
      <label class="block"><div class="text-xs text-slate-500 mb-1">ภาพ (image_url)</div><input class="w-full p-2 rounded border border-slate-300" name="image_url" value="${esc(r?.image_url||'')}"></label>
      <label class="block"><div class="text-xs text-slate-500 mb-1">ลำดับ (sort_order)</div><input type="number" class="w-full p-2 rounded border border-slate-300" name="sort_order" value="${esc(r?.sort_order ?? 100)}"></label>
    </div>
    <label class="inline-flex items-center gap-2"><input type="checkbox" name="is_active" ${r?.is_active===false?'':'checked'}> <span>ใช้งาน</span></label>
  </form>`;
}

function listItem(r){
  return `<div class="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
    <div class="min-w-0"><div class="font-medium truncate">${esc(r.title)}</div><div class="text-xs text-slate-500 truncate">${esc(r.url)}</div></div>
    <div class="flex items-center gap-2">
      <span class="badge ${r.is_active===false?'badge-gray':'badge-green'}">${r.is_active===false?'ปิดใช้งาน':'ใช้งาน'}</span>
      <button class="btn" data-edit="${r.id}">แก้ไข</button>
      <button class="btn btn-danger" data-del="${r.id}">ลบ</button>
    </div>
  </div>`;
}

function renderList(host){
  host.innerHTML = `<div class="p-4 border border-slate-200 rounded-xl bg-white">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-base font-semibold">จัดการ “แอป/ระบบในโรงเรียน”</h3>
      <div class="flex items-center gap-2"><button id="btnNew" class="btn btn-primary">เพิ่มรายการ</button></div>
    </div>
    <div id="list" class="space-y-2"></div>
    <div class="pager"><span class="info"></span><button class="btn" id="pgPrev">ก่อนหน้า</button><button class="btn" id="pgNext">ถัดไป</button></div>
  </div>`;
  const list = host.querySelector('#list');
  list.innerHTML = state.rows.map(listItem).join('') || '<div class="text-slate-500">ยังไม่มีรายการ</div>';

  const pages = Math.max(1, Math.ceil((state.total||0)/PAGE_SIZE));
  host.querySelector('.info').textContent = `หน้า ${state.page+1}/${pages} • ทั้งหมด ${state.total} รายการ`;
  const prevBtn = host.querySelector('#pgPrev'), nextBtn = host.querySelector('#pgNext');
  prevBtn.disabled = state.page <= 0;
  nextBtn.disabled = state.page >= pages-1;
  prevBtn.onclick = async ()=>{ await fetchPage(state.page-1); renderList(host); };
  nextBtn.onclick = async ()=>{ await fetchPage(state.page+1); renderList(host); };

  host.querySelector('#btnNew').onclick = ()=>{
    const overlay = openModal('เพิ่ม “แอป/ระบบในโรงเรียน”', formHTML(null), async ()=>{
      const form = overlay.querySelector('#applinksForm');
      const fd = new FormData(form);
      const payload = {
        title: fd.get('title'),
        category: fd.get('category') || null,
        url: fd.get('url'),
        image_url: fd.get('image_url') || null,
        sort_order: Number(fd.get('sort_order') || 100),
        is_active: form.querySelector('[name="is_active"]').checked
      };
      await upsertLink(payload);
      toast('บันทึกสำเร็จ');
      window.dispatchEvent(new CustomEvent('APP_LINKS_CHANGED'));
      await fetchPage(state.page);
      renderList(host);
    });
  };

  list.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.onclick = ()=>{
      const id = Number(btn.getAttribute('data-edit'));
      const row = state.rows.find(r => r.id === id);
      const overlay = openModal('แก้ไข “แอป/ระบบในโรงเรียน”', formHTML(row), async ()=>{
        const form = overlay.querySelector('#applinksForm');
        const fd = new FormData(form);
        const payload = {
          id,
          title: fd.get('title'),
          category: fd.get('category') || null,
          url: fd.get('url'),
          image_url: fd.get('image_url') || null,
          sort_order: Number(fd.get('sort_order') || 100),
          is_active: form.querySelector('[name="is_active"]').checked
        };
        await upsertLink(payload);
        toast('บันทึกสำเร็จ');
        window.dispatchEvent(new CustomEvent('APP_LINKS_CHANGED'));
        await fetchPage(state.page);
        renderList(host);
      });
    };
  });
  list.querySelectorAll('[data-del]').forEach(btn=>{
    btn.onclick = async ()=>{
      const id = Number(btn.getAttribute('data-del'));
      if (!confirm('ยืนยันการลบรายการนี้?')) return;
      await deleteLink(id);
      toast('ลบแล้ว');
      window.dispatchEvent(new CustomEvent('APP_LINKS_CHANGED'));
      if (state.page>0 && state.rows.length===1) state.page -= 1;
      await fetchPage(state.page);
      renderList(host);
    };
  });
}

export async function renderAppLinksAdmin(containerId='applinksAdmin'){
  const host = document.getElementById(containerId);
  if (!host) return;
  await fetchPage(0);
  renderList(host);
}
