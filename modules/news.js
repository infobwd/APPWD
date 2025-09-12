import { supabase } from '../api.js';
import { openSheet, closeSheet, toast, skel, esc } from '../ui.js';

const homeBox = ()=>document.getElementById('homeNews');
const listBox = ()=>document.getElementById('newsList');

export async function renderHome(){
  if(!homeBox()) return;
  homeBox().innerHTML = skel(3);
  const { data } = await supabase.from('posts').select('id,title,category,published_at,cover_url').lte('published_at', new Date().toISOString()).order('published_at',{ascending:false}).limit(6);
  homeBox().innerHTML = (data||[]).map(card).join('') || '<div class="text-gray-500">ยังไม่มีข่าว</div>';
}

export async function renderList(){
  if(!listBox()) return;
  listBox().innerHTML = skel(8,'72px');
  const editor = await isEditor();
  const btn = document.getElementById('btnComposePost');
  if(btn){ btn.classList.toggle('hide', !editor); btn.onclick = ()=> openComposeSheet(); }
  const { data } = await supabase.from('posts').select('id,title,category,published_at,cover_url').order('published_at',{ascending:false}).limit(100);
  listBox().innerHTML = (data||[]).map(card).join('') || '<div class="text-gray-500">ยังไม่มีข่าว</div>';
}

export async function renderDetail(id){
  const box=document.getElementById('postDetail'); if(!box) return;
  box.innerHTML = skel(4,'80px');
  const { data: p, error } = await supabase.from('posts').select('id,title,category,body,cover_url,published_at,created_by').eq('id', id).maybeSingle();
  if(error || !p){ box.innerHTML = '<div class="text-gray-500">ไม่พบข่าว</div>'; return; }
  const cover = p.cover_url ? `<img class="cover mb-3" src="${p.cover_url}" alt="cover">` : '';
  const md = window.marked ? window.marked.parse(p.body||'') : (p.body||'');
  const safe = window.DOMPurify ? window.DOMPurify.sanitize(md) : md;
  const d = p.published_at ? new Date(p.published_at).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}) : '';
  const tools = (await isEditor(p.created_by)) ? `<div class="mt-3 flex gap-2"><button class="btn btn-prim" id="editP">แก้ไข</button><button class="btn" id="delP">ลบ</button></div>` : '';
  box.innerHTML = `${cover}<h1 class="text-xl font-semibold mb-1">${esc(p.title)}</h1><div class="text-xs text-gray-500 mb-3">${esc(p.category||'ทั่วไป')} • ${d}</div><div class="prose prose-sm max-w-none">${safe}</div>${tools}`;
  const editBtn = document.getElementById('editP'); const delBtn=document.getElementById('delP');
  if(editBtn){ editBtn.onclick = ()=> openEditSheet(p); }
  if(delBtn){ delBtn.onclick = async ()=>{ if(!confirm('ลบข่าวนี้?')) return; const {error} = await supabase.from('posts').delete().eq('id', p.id); if(error){ toast('ลบไม่สำเร็จ'); return; } location.hash = '#news'; }; }
}

function card(p){
  const d = new Date(p.published_at||new Date()).toLocaleDateString('th-TH');
  const img = p.cover_url ? `<img class="w-16 h-16 object-cover rounded-lg border border-[#E6EAF0]" src="${p.cover_url}" alt="cover">`
                          : `<div class="w-16 h-16 rounded-lg bg-brandSoft grid place-items-center text-brand">📰</div>`;
  return `<article class="p-3 border border-[#E6EAF0] rounded-xl bg-white flex items-center gap-3 cursor-pointer" onclick="location.hash='#post?id=${p.id}'">
    ${img}
    <div class="flex-1"><div class="font-semibold line-clamp-2">${esc(p.title)}</div><div class="text-[12px] text-gray-500">${esc(p.category||'ทั่วไป')} • ${d}</div></div>
    <div class="text-brand text-sm">อ่านต่อ ›</div>
  </article>`;
}

async function isEditor(created_by){
  const { data: session } = await supabase.auth.getUser();
  const u = session.user; if(!u) return false;
  if(created_by && created_by === u.id) return true;
  const { data } = await supabase.from('editors').select('user_id').eq('user_id', u.id).maybeSingle();
  return !!data;
}

function openComposeSheet(){
  openSheet(`<form id="composePostForm" class="grid gap-2 text-sm">
    <input name="title" placeholder="หัวข้อข่าว" class="border border-[#E6EAF0] rounded p-2" required>
    <input name="category" placeholder="หมวด (เช่น ประกาศ, วิชาการ)" class="border border-[#E6EAF0] rounded p-2">
    <input name="cover_url" placeholder="ลิงก์ภาพปก (cover_url)" class="border border-[#E6EAF0] rounded p-2">
    <textarea name="body" rows="8" placeholder="เนื้อหา (Markdown)" class="border border-[#E6EAF0] rounded p-2"></textarea>
    <label class="text-sm">เผยแพร่: <input type="datetime-local" name="published_at" class="border border-[#E6EAF0] rounded p-1"></label>
    <div class="flex gap-2"><button class="btn btn-prim">บันทึก</button><button type="button" id="cancelSheet" class="btn">ยกเลิก</button></div>
  </form>`);
  const cancel=document.getElementById('cancelSheet'); if(cancel) cancel.onclick = closeSheet;
  const form=document.getElementById('composePostForm');
  if(form){ form.onsubmit = async (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      title: fd.get('title'), category: fd.get('category')||null, body: fd.get('body')||null,
      cover_url: fd.get('cover_url')||null,
      published_at: fd.get('published_at')? new Date(fd.get('published_at')).toISOString() : new Date().toISOString()
    };
    const { data: row, error } = await supabase.from('posts').insert(payload).select('id').single();
    if(error){ toast('บันทึกข่าวไม่สำเร็จ'); return; }
    closeSheet(); location.hash = `#post?id=${row.id}`;
  };}
}

function openEditSheet(p){
  openSheet(`<form id="editPostForm" class="grid gap-2 text-sm">
    <input name="title" class="border border-[#E6EAF0] rounded p-2" value="${esc(p.title||'')}">
    <input name="category" class="border border-[#E6EAF0] rounded p-2" value="${esc(p.category||'')}">
    <input name="cover_url" class="border border-[#E6EAF0] rounded p-2" value="${esc(p.cover_url||'')}" placeholder="ลิงก์ภาพปก">
    <textarea name="body" rows="10" class="border border-[#E6EAF0] rounded p-2">${esc(p.body||'')}</textarea>
    <label class="text-sm">เผยแพร่: <input type="datetime-local" name="published_at" class="border border-[#E6EAF0] rounded p-1" value="${p.published_at? new Date(p.published_at).toISOString().slice(0,16):''}"></label>
    <div class="flex gap-2"><button class="btn btn-prim">บันทึก</button><button type="button" id="cancelSheet" class="btn">ยกเลิก</button></div>
  </form>`);
  const cancel=document.getElementById('cancelSheet'); if(cancel) cancel.onclick = closeSheet;
  const form=document.getElementById('editPostForm');
  if(form){ form.onsubmit = async (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const upd = {
      title: fd.get('title'), category: fd.get('category')||null, body: fd.get('body')||null,
      cover_url: fd.get('cover_url')||null,
      published_at: fd.get('published_at')? new Date(fd.get('published_at')).toISOString() : null,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('posts').update(upd).eq('id', p.id);
    if(error){ toast('บันทึกไม่สำเร็จ'); return; }
    toast('บันทึกแล้ว'); closeSheet(); location.hash = `#post?id=${p.id}`;
  };}
}
