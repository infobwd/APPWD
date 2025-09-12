
import { supabase } from '../api.js';
import { openSheet, closeSheet, toast, skel, esc } from '../ui.js';

const PAGE_SIZE = 10;
let page = 1, total = 0;

export async function renderHome(){
  const listEl = document.getElementById('homeNewsList');
  const cardsEl = document.getElementById('homeNewsCards');
  if(!listEl || !cardsEl) return;
  listEl.innerHTML = skel(2);
  cardsEl.innerHTML = skel(3,'180px');

  const latestResp = await supabase
    .from('posts')
    .select('id,title,category,published_at,cover_url,is_featured')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(8);
  const latest = latestResp.data || [];

  const featuredResp = await supabase
    .from('posts')
    .select('id,title,category,published_at,cover_url,is_featured')
    .eq('is_featured', true)
    .order('published_at', { ascending: false })
    .limit(12);
  const featured = featuredResp.data || [];

  const top2 = latest.slice(0,2);
  const top2Ids = new Set(top2.map(x=>x.id));
  const pool = [...featured, ...latest.filter(p=>!top2Ids.has(p.id))];

  const picked = [];
  const seen = new Set();
  for (const p of pool) {
    if (picked.length >= 3) break;
    if (top2Ids.has(p.id) || seen.has(p.id)) continue;
    picked.push(p); seen.add(p.id);
  }

  listEl.innerHTML = top2.map(p=>withStatsRow(p)).join('') || '<div class="text-gray-500">ยังไม่มีข่าว</div>';
  cardsEl.innerHTML = await withStatsCards(picked);
}

export async function renderList(){
  const box = document.getElementById('newsList'); if(!box) return;
  const btn = document.getElementById('btnComposePost');
  const isEd = await isEditor();
  if (btn) { btn.classList.toggle('hide', !isEd); btn.onclick = ()=>openComposeSheet(); }
  await loadPage(1);
  const prev = document.getElementById('btnPrev'); const next = document.getElementById('btnNext');
  if(prev) prev.onclick = ()=>{ if(page>1) loadPage(page-1); };
  if(next) next.onclick = ()=>{ const max = Math.ceil(total/PAGE_SIZE)||1; if(page<max) loadPage(page+1); };
}

async function loadPage(p){
  page = p;
  const box = document.getElementById('newsList'); if(!box) return;
  box.innerHTML = skel(PAGE_SIZE,'72px');
  const from = (page-1)*PAGE_SIZE, to = from + PAGE_SIZE - 1;
  const resp = await supabase
    .from('posts')
    .select('id,title,category,published_at,cover_url', { count: 'exact' })
    .order('published_at', { ascending: false })
    .range(from, to);
  const data = resp.data || []; total = resp.count || 0;
  const ids = data.map(x=>x.id);
  const statMap = await fetchStats(ids);
  box.innerHTML = data.map(p=>listItemWithStats(p, statMap.get(p.id)||{views:0,likes:0})).join('') || '<div class="text-gray-500">ยังไม่มีข่าว</div>';
  const info = document.getElementById('pageInfo');
  if (info) { const max = Math.ceil(total/PAGE_SIZE)||1; info.textContent = `หน้า ${page} / ${max} • ทั้งหมด ${total} ข่าว`; }
}

export async function renderDetail(id){
  const box = document.getElementById('postDetail'); if(!box) return;
  box.innerHTML = skel(4,'80px');
  const resp = await supabase.from('posts').select('id,title,category,body,cover_url,published_at,created_by,is_featured').eq('id',id).maybeSingle();
  const p = resp.data;
  if (!p) { box.innerHTML = '<div class="text-gray-500">ไม่พบข่าว</div>'; return; }
  try{ await supabase.rpc('increment_view',{ p_post_id: p.id }); }catch(_){}
  const statResp = await supabase.from('post_stats').select('view_count,like_count').eq('post_id',p.id).maybeSingle();
  const views = (statResp.data && statResp.data.view_count) || 0;
  const likes = (statResp.data && statResp.data.like_count) || 0;
  const prof = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null'); const lineId = prof?.userId||null;
  let liked = false;
  if (lineId){
    const lk = await supabase.from('post_likes').select('post_id').eq('post_id',p.id).eq('line_user_id',lineId).maybeSingle();
    liked = !!lk.data;
  }
  const cover = p.cover_url ? `<img class="cover mb-3" src="${p.cover_url}" alt="cover">` : '';
  const md = window.marked?window.marked.parse(p.body||''):(p.body||'');
  const safe = window.DOMPurify?window.DOMPurify.sanitize(md):md;
  const d = p.published_at?new Date(p.published_at).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}):'';
  const canEdit = await isEditor(p.created_by);
  const tools = canEdit?`<div class="mt-3 flex gap-2"><button class="btn btn-prim" id="editP">แก้ไข</button><button class="btn" id="delP">ลบ</button></div>`:'';
  box.innerHTML = `${cover}<h1 class="text-xl font-semibold mb-1">${esc(p.title)}</h1><div class="text-xs text-gray-500 mb-3">${esc(p.category||'ทั่วไป')} • ${d}</div><div class="prose prose-sm max-w-none mb-4">${safe}</div>
  <div class="flex items-center gap-2">
    <button id="btnLike" class="btn" aria-pressed="${liked}">${liked?'❤️':'🤍'} <span id="likeCount" class="ml-1">${likes}</span></button>
    <button id="btnShare" class="btn">แชร์ LINE</button>
    <div class="ml-auto text-sm text-gray-500">เปิดอ่าน <span id="viewCount">${views}</span> ครั้ง</div>
  </div>${tools}`;
  const editBtn=document.getElementById('editP'), delBtn=document.getElementById('delP');
  if(editBtn) editBtn.onclick=()=>openEditSheet(p);
  if(delBtn) delBtn.onclick=async()=>{ if(!confirm('ลบข่าวนี้?'))return; const del=await supabase.from('posts').delete().eq('id',p.id); if(del.error){toast('ลบไม่สำเร็จ');return;} location.hash='#news'; };
  const likeBtn=document.getElementById('btnLike');
  if(likeBtn){ likeBtn.onclick=async()=>{ if(!lineId){toast('กรุณาเข้าสู่ระบบด้วย LINE ก่อน');return;} const pressed=(likeBtn.getAttribute('aria-pressed')==='true');
      try{ if(pressed){ const res=await supabase.rpc('unlike_post',{p_post_id:p.id,p_line_user_id:lineId}); likeBtn.setAttribute('aria-pressed','false'); likeBtn.firstChild.nodeValue='🤍'; document.getElementById('likeCount').textContent=(res.data||0);
           }else{ const res=await supabase.rpc('like_post',{p_post_id:p.id,p_line_user_id:lineId}); likeBtn.setAttribute('aria-pressed','true'); likeBtn.firstChild.nodeValue='❤️'; document.getElementById('likeCount').textContent=(res.data||0);} }
      catch(e){ toast('ดำเนินการไม่สำเร็จ'); } }; }
  setTimeout(async()=>{ const s2=await supabase.from('post_stats').select('view_count').eq('post_id',p.id).maybeSingle(); if(s2.data&&document.getElementById('viewCount')) document.getElementById('viewCount').textContent=s2.data.view_count; },1200);
  const btnShare=document.getElementById('btnShare'); if(btnShare){ btnShare.onclick=()=>sharePost(p.id); }
}
function listItemWithStats(p, s){
  const d=new Date(p.published_at||new Date()).toLocaleDateString('th-TH');
  const img=p.cover_url?`<img class="w-16 h-16 object-cover rounded-lg border border-[#E6EAF0]" src="${p.cover_url}" alt="cover">`:`<div class="w-16 h-16 rounded-lg bg-brandSoft grid place-items-center text-brand">📰</div>`;
  return `<article class="p-3 border border-[#E6EAF0] rounded-xl bg-white flex items-center gap-3">
    <a class="flex-shrink-0" href="#post?id=${p.id}">${img}</a>
    <div class="flex-1"><a href="#post?id=${p.id}" class="font-semibold line-clamp-2">${esc(p.title)}</a><div class="text-[12px] text-gray-500">${esc(p.category||'ทั่วไป')} • ${d}</div>
      <div class="flex items-center gap-3 mt-1 text-[12px] text-gray-600">
        <span>👁️ ${s.views||0}</span><span>❤️ ${s.likes||0}</span><button onclick="sharePost(${p.id})" class="underline">แชร์</button>
      </div>
    </div>
  </article>`;
}
function withStatsRow(p){ return listItemWithStats(p, { views:0, likes:0 }); }
async function withStatsCards(list){
  if(!list || list.length===0) return '<div class="text-gray-500">ยังไม่มีการ์ดเด่น</div>';
  const ids=list.map(p=>p.id); const statMap=await fetchStats(ids);
  return list.map(p=>{
    const s=statMap.get(p.id)||{views:0,likes:0};
    const d=new Date(p.published_at||new Date()).toLocaleDateString('th-TH');
    const img=p.cover_url?`<img class="thumb" src="${p.cover_url}" alt="cover">`:`<div class="thumb grid place-items-center bg-brandSoft text-brand">📰</div>`;
    return `<div class="news-card">
      <a href="#post?id=${p.id}" aria-label="${esc(p.title)}">${img}</a>
      <div class="badge">เด่น</div>
      <div class="p-3">
        <div class="text-[12px] text-gray-500 mb-1">${esc(p.category||'ทั่วไป')} • ${d}</div>
        <a class="font-semibold leading-snug line-clamp-2 block" href="#post?id=${p.id}">${esc(p.title)}</a>
        <div class="flex items-center gap-3 mt-2 text-[12px] text-gray-600">
          <span>👁️ ${s.views}</span><span>❤️ ${s.likes}</span>
          <button onclick="sharePost(${p.id})" class="underline">แชร์</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
async function fetchStats(ids){
  const map=new Map(); if(!ids||ids.length===0) return map;
  const resp = await supabase.from('post_stats').select('post_id,view_count,like_count').in('post_id', ids);
  const rows = resp.data || [];
  rows.forEach(r=>map.set(r.post_id, { views:r.view_count||0, likes:r.like_count||0 }));
  return map;
}
window.sharePost = async function(id){
  const base=(localStorage.getItem('APPWD_PUBLIC_URL')||'./'); const row=await supabase.from('posts').select('id,title,category,cover_url').eq('id',id).maybeSingle();
  const p=row.data; if(!p){ toast('ไม่พบน้ำใจแชร์'); return; }
  const url=base+`index.html#post?id=${p.id}`;
  const bubble = {
    type:'bubble',
    hero: p.cover_url ? { type:'image', url:p.cover_url, size:'full', aspectRatio:'16:9', aspectMode:'cover' } : undefined,
    body:{ type:'box', layout:'vertical', contents:[
      { type:'text', text:p.title||'ข่าว', weight:'bold', size:'md', wrap:true },
      { type:'text', text:(p.category||'ทั่วไป'), size:'xs', color:'#6B7280', wrap:true, margin:'sm' }
    ]},
    footer:{ type:'box', layout:'vertical', spacing:'sm', contents:[
      { type:'button', style:'primary', height:'sm', action:{ type:'uri', label:'อ่านข่าว', uri:url } }
    ]}
  };
  try{
    if(window.liff && window.liff.isApiAvailable && window.liff.isApiAvailable('shareTargetPicker')){
      await window.liff.shareTargetPicker([{ type:'flex', altText:`แชร์ข่าว: ${p.title}`, contents:bubble }]);
    } else {
      await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว');
    }
  }catch(e){ toast('แชร์ไม่สำเร็จ'); }
};
async function isEditor(created_by){
  const uResp = await supabase.auth.getUser();
  const user = uResp.data && uResp.data.user;
  if(!user) return false;
  if (created_by && created_by === user.id) return true;
  const ed = await supabase.from('editors').select('user_id').eq('user_id',user.id).maybeSingle();
  return !!ed.data;
}
function openComposeSheet(){
  const html = `<form id="composePostForm" class="grid gap-2 text-sm">
    <input name="title" placeholder="หัวข้อข่าว" class="border border-[#E6EAF0] rounded p-2" required>
    <input name="category" placeholder="หมวด" class="border border-[#E6EAF0] rounded p-2">
    <input name="cover_url" placeholder="ลิงก์ภาพปก (cover_url)" class="border border-[#E6EAF0] rounded p-2">
    <label class="text-sm flex items-center gap-2"><input type="checkbox" name="is_featured"> ปักหมุด/สติกเกอร์</label>
    <textarea name="body" rows="8" placeholder="เนื้อหา (Markdown)" class="border border-[#E6EAF0] rounded p-2"></textarea>
    <label class="text-sm">เผยแพร่: <input type="datetime-local" name="published_at" class="border border-[#E6EAF0] rounded p-1"></label>
    <div class="flex gap-2"><button class="btn btn-prim">บันทึก</button><button type="button" id="cancelSheet" class="btn">ยกเลิก</button></div>
  </form>`;
  openSheet(html);
  const cancel=document.getElementById('cancelSheet'); if(cancel) cancel.onclick=closeSheet;
  const form=document.getElementById('composePostForm');
  if(form){ form.onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(form);
    const payload={ title:fd.get('title'), category:fd.get('category')||null, body:fd.get('body')||null, cover_url:fd.get('cover_url')||null, is_featured:!!fd.get('is_featured'), published_at:fd.get('published_at')?new Date(fd.get('published_at')).toISOString():new Date().toISOString() };
    const ins=await supabase.from('posts').insert(payload).select('id').single();
    if(ins.error){ toast('บันทึกข่าวไม่สำเร็จ'); return; }
    closeSheet(); location.hash=`#post?id=${ins.data.id}`;
  }; }
}
function openEditSheet(p){
  const html = `<form id="editPostForm" class="grid gap-2 text-sm">
    <input name="title" class="border border-[#E6EAF0] rounded p-2" value="${esc(p.title||'')}">
    <input name="category" class="border border-[#E6EAF0] rounded p-2" value="${esc(p.category||'')}">
    <input name="cover_url" class="border border-[#E6EAF0] rounded p-2" value="${esc(p.cover_url||'')}" placeholder="ลิงก์ภาพปก">
    <label class="text-sm flex items-center gap-2"><input type="checkbox" name="is_featured" ${p.is_featured?'checked':''}> ปักหมุด/สติกเกอร์</label>
    <textarea name="body" rows="10" class="border border-[#E6EAF0] rounded p-2">${esc(p.body||'')}</textarea>
    <label class="text-sm">เผยแพร่: <input type="datetime-local" name="published_at" class="border border-[#E6EAF0] rounded p-1" value="${p.published_at? new Date(p.published_at).toISOString().slice(0,16):''}"></label>
    <div class="flex gap-2"><button class="btn btn-prim">บันทึก</button><button type="button" id="cancelSheet" class="btn">ยกเลิก</button></div>
  </form>`;
  openSheet(html);
  const cancel=document.getElementById('cancelSheet'); if(cancel) cancel.onclick=closeSheet;
  const form=document.getElementById('editPostForm');
  if(form){ form.onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(form);
    const upd={ title:fd.get('title'), category:fd.get('category')||null, body:fd.get('body')||null, cover_url:fd.get('cover_url')||null, is_featured:!!fd.get('is_featured'), published_at:fd.get('published_at')?new Date(fd.get('published_at')).toISOString():null, updated_at:new Date().toISOString() };
    const up=await supabase.from('posts').update(upd).eq('id',p.id);
    if(up.error){ toast('บันทึกไม่สำเร็จ'); return; }
    toast('บันทึกแล้ว'); closeSheet(); location.hash=`#post?id=${p.id}`;
  }; }
}
