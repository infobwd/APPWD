import { supabase } from '../api.js';
import { openSheet, closeSheet, toast, skel, esc } from '../ui.js';
const listBox=()=>document.getElementById('newsList');
export async function renderHome(){
  const listEl=document.getElementById('homeNewsList'); const cardsEl=document.getElementById('homeNewsCards');
  if(!listEl||!cardsEl)return; listEl.innerHTML=skel(2); cardsEl.innerHTML=skel(3,'180px');
  const { data: latest } = await supabase.from('posts').select('id,title,category,published_at,cover_url,is_featured').lte('published_at', new Date().toISOString()).order('published_at',{ascending:false}).limit(5);
  const top2=(latest||[]).slice(0,2); const top2Ids=new Set(top2.map(x=>x.id));
  listEl.innerHTML = top2.map(listItem).join('') || '<div class="text-gray-500">ยังไม่มีข่าว</div>';
  const { data: featured } = await supabase.from('posts').select('id,title,category,published_at,cover_url,is_featured').eq('is_featured',true).order('published_at',{ascending:false}).limit(6);
  const pool=[...(featured||[]),...((latest||[]).filter(p=>!top2Ids.has(p.id)))];
  const picked=[]; const pickedIds=new Set();
  for(const p of pool){ if(picked.length>=3) break; if(top2Ids.has(p.id)||pickedIds.has(p.id)) continue; picked.push(p); pickedIds.add(p.id); }
  cardsEl.innerHTML = picked.map(card).join('') || '<div class="text-gray-500">ยังไม่มีการ์ดเด่น</div>';
}
export async function renderList(){
  if(!listBox()) return; listBox().innerHTML=skel(8,'72px');
  const editor=await isEditor(); const btn=document.getElementById('btnComposePost'); if(btn){ btn.classList.toggle('hide',!editor); btn.onclick=()=>openComposeSheet(); }
  const { data } = await supabase.from('posts').select('id,title,category,published_at,cover_url').order('published_at',{ascending:false}).limit(100);
  listBox().innerHTML=(data||[]).map(listItem).join('')||'<div class="text-gray-500">ยังไม่มีข่าว</div>';
}
export async function renderDetail(id){
  const box=document.getElementById('postDetail'); if(!box)return; box.innerHTML=skel(4,'80px');
  const { data: p, error }=await supabase.from('posts').select('id,title,category,body,cover_url,published_at,created_by,is_featured').eq('id',id).maybeSingle();
  if(error||!p){ box.innerHTML='<div class="text-gray-500">ไม่พบข่าว</div>'; return; }
  const { data: stat }=await supabase.from('post_stats').select('view_count,like_count').eq('post_id',p.id).maybeSingle();
  const views=stat?.view_count||0; const likes=stat?.like_count||0;
  const prof=JSON.parse(localStorage.getItem('LINE_PROFILE')||'null'); const lineId=prof?.userId||null;
  const { data: likedRow } = lineId ? await supabase.from('post_likes').select('post_id').eq('post_id',p.id).eq('line_user_id',lineId).maybeSingle() : { data:null };
  const liked=!!likedRow;
  try{ await supabase.rpc('increment_view',{p_post_id:p.id}); }catch(e){}
  const cover=p.cover_url?`<img class="cover mb-3" src="${p.cover_url}" alt="cover">`:'';
  const md=window.marked?window.marked.parse(p.body||''):(p.body||''); const safe=window.DOMPurify?window.DOMPurify.sanitize(md):md;
  const d=p.published_at?new Date(p.published_at).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}):'';
  const tools=(await isEditor(p.created_by))?`<div class="mt-3 flex gap-2"><button class="btn btn-prim" id="editP">แก้ไข</button><button class="btn" id="delP">ลบ</button></div>`:'';
  box.innerHTML=`${cover}<h1 class="text-xl font-semibold mb-1">${esc(p.title)}</h1><div class="text-xs text-gray-500 mb-3">${esc(p.category||'ทั่วไป')} • ${d}</div><div class="prose prose-sm max-w-none mb-4">${safe}</div>
  <div class="flex items-center gap-2">
    <button id="btnLike" class="btn" aria-pressed="${liked}">${liked?'❤️':'🤍'} <span id="likeCount" class="ml-1">${likes}</span></button>
    <button id="btnShare" class="btn">แชร์ LINE</button>
    <div class="ml-auto text-sm text-gray-500">เปิดอ่าน <span id="viewCount">${views}</span> ครั้ง</div>
  </div>${tools}`;
  const editBtn=document.getElementById('editP'), delBtn=document.getElementById('delP');
  if(editBtn) editBtn.onclick=()=>openEditSheet(p);
  if(delBtn) delBtn.onclick=async()=>{ if(!confirm('ลบข่าวนี้?'))return; const {error}=await supabase.from('posts').delete().eq('id',p.id); if(error){toast('ลบไม่สำเร็จ');return;} location.hash='#news'; };
  const likeBtn=document.getElementById('btnLike');
  if(likeBtn){ likeBtn.onclick=async()=>{ if(!lineId){toast('กรุณาเข้าสู่ระบบด้วย LINE ก่อน');return;} const pressed=(likeBtn.getAttribute('aria-pressed')==='true');
      try{ if(pressed){ const { data: cnt }=await supabase.rpc('unlike_post',{p_post_id:p.id,p_line_user_id:lineId}); likeBtn.setAttribute('aria-pressed','false'); likeBtn.firstChild.nodeValue='🤍'; document.getElementById('likeCount').textContent=(cnt||0);
           }else{ const { data: cnt }=await supabase.rpc('like_post',{p_post_id:p.id,p_line_user_id:lineId}); likeBtn.setAttribute('aria-pressed','true'); likeBtn.firstChild.nodeValue='❤️'; document.getElementById('likeCount').textContent=(cnt||0);} }
      catch(e){ toast('ดำเนินการไม่สำเร็จ'); } }; }
  setTimeout(async()=>{ const { data: s2 }=await supabase.from('post_stats').select('view_count').eq('post_id',p.id).maybeSingle(); if(s2&&document.getElementById('viewCount')) document.getElementById('viewCount').textContent=s2.view_count; },1200);
  const btnShare=document.getElementById('btnShare');
  if(btnShare){ btnShare.onclick=async()=>{ const base=(localStorage.getItem('APPWD_PUBLIC_URL')||'./'); const url=base+`index.html#post?id=${p.id}`;
      const bubble={type:'bubble',hero:p.cover_url?{type:'image',url:p.cover_url,size:'full',aspectRatio:'16:9',aspectMode:'cover'}:undefined,body:{type:'box',layout:'vertical',contents:[{type:'text',text:p.title||'ข่าว',weight:'bold',size:'md',wrap:true},{type:'text',text:(p.category||'ทั่วไป'),size:'xs',color:'#6B7280',wrap:true,margin:'sm'}]},footer:{type:'box',layout:'vertical',spacing:'sm',contents:[{type:'button',style:'primary',height:'sm',action:{type:'uri',label:'อ่านข่าว',uri:url}}]}};
      try{ if(window.liff&&window.liff.isApiAvailable&&window.liff.isApiAvailable('shareTargetPicker')){ await window.liff.shareTargetPicker([{type:'flex',altText:`แชร์ข่าว: ${p.title}`,contents:bubble}]); } else { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว'); } }
      catch(e){ toast('แชร์ไม่สำเร็จ'); } }; }
}
function listItem(p){ const d=new Date(p.published_at||new Date()).toLocaleDateString('th-TH'); const img=p.cover_url?`<img class="w-16 h-16 object-cover rounded-lg border border-[#E6EAF0]" src="${p.cover_url}" alt="cover">`:`<div class="w-16 h-16 rounded-lg bg-brandSoft grid place-items-center text-brand">📰</div>`;
  return `<article class="p-3 border border-[#E6EAF0] rounded-xl bg-white flex items-center gap-3 cursor-pointer" onclick="location.hash='#post?id=${p.id}'">${img}<div class="flex-1"><div class="font-semibold line-clamp-2">${esc(p.title)}</div><div class="text-[12px] text-gray-500">${esc(p.category||'ทั่วไป')} • ${d}</div></div><div class="text-brand text-sm">อ่านต่อ ›</div></article>`;}
function card(p){ const d=new Date(p.published_at||new Date()).toLocaleDateString('th-TH'); const img=p.cover_url?`<img class="thumb" src="${p.cover_url}" alt="cover">`:`<div class="thumb grid place-items-center bg-brandSoft text-brand">📰</div>`;
  return `<div class="news-card cursor-pointer" onclick="location.hash='#post?id=${p.id}'">${img}<div class="p-3"><div class="text-[12px] text-gray-500 mb-1">${esc(p.category||'ทั่วไป')} • ${d}</div><div class="font-semibold leading-snug line-clamp-2">${esc(p.title)}</div></div></div>`;}
async function isEditor(created_by){ const { data: session }=await supabase.auth.getUser(); const u=session.user; if(!u)return false; if(created_by && created_by===u.id) return true; const { data }=await supabase.from('editors').select('user_id').eq('user_id',u.id).maybeSingle(); return !!data; }
function openComposeSheet(){ openSheet(`<form id="composePostForm" class="grid gap-2 text-sm"><input name="title" placeholder="หัวข้อข่าว" class="border border-[#E6EAF0] rounded p-2" required><input name="category" placeholder="หมวด" class="border border-[#E6EAF0] rounded p-2"><input name="cover_url" placeholder="ลิงก์ภาพปก (cover_url)" class="border border-[#E6EAF0] rounded p-2"><label class="text-sm flex items-center gap-2"><input type="checkbox" name="is_featured"> ปักหมุด/สติกเกอร์</label><textarea name="body" rows="8" placeholder="เนื้อหา (Markdown)" class="border border-[#E6EAF0] rounded p-2"></textarea><label class="text-sm">เผยแพร่: <input type="datetime-local" name="published_at" class="border border-[#E6EAF0] rounded p-1"></label><div class="flex gap-2"><button class="btn btn-prim">บันทึก</button><button type="button" id="cancelSheet" class="btn">ยกเลิก</button></div></form>`);
  const cancel=document.getElementById('cancelSheet'); if(cancel) cancel.onclick=closeSheet; const form=document.getElementById('composePostForm');
  if(form){ form.onsubmit=async e=>{ e.preventDefault(); const fd=new FormData(form); const payload={ title:fd.get('title'), category:fd.get('category')||null, body:fd.get('body')||null, cover_url:fd.get('cover_url')||null, is_featured:!!fd.get('is_featured'), published_at:fd.get('published_at')?new Date(fd.get('published_at')).toISOString():new Date().toISOString() };
    const { data: row, error }=await supabase.from('posts').insert(payload).select('id').single(); if(error){ toast('บันทึกข่าวไม่สำเร็จ'); return; } closeSheet(); location.hash=`#post?id=${row.id}`; }; } }
function openEditSheet(p){ openSheet(`<form id="editPostForm" class="grid gap-2 text-sm"><input name="title" class="border border-[#E6EAF0] rounded p-2" value="${esc(p.title||'')}"><input name="category" class="border border-[#E6EAF0] rounded p-2" value="${esc(p.category||'')}"><input name="cover_url" class="border border-[#E6EAF0] rounded p-2" value="${esc(p.cover_url||'')}" placeholder="ลิงก์ภาพปก"><label class="text-sm flex items-center gap-2"><input type="checkbox" name="is_featured" ${p.is_featured?'checked':''}> ปักหมุด/สติกเกอร์</label><textarea name="body" rows="10" class="border border-[#E6EAF0] rounded p-2">${esc(p.body||'')}</textarea><label class="text-sm">เผยแพร่: <input type="datetime-local" name="published_at" class="border border-[#E6EAF0] rounded p-1" value="${p.published_at? new Date(p.published_at).toISOString().slice(0,16):''}"></label><div class="flex gap-2"><button class="btn btn-prim">บันทึก</button><button type="button" id="cancelSheet" class="btn">ยกเลิก</button></div></form>`);
  const cancel=document.getElementById('cancelSheet'); if(cancel) cancel.onclick=closeSheet; const form=document.getElementById('editPostForm');
  if(form){ form.onsubmit=async e=>{ e.preventDefault(); const fd=new FormData(form); const upd={ title:fd.get('title'), category:fd.get('category')||null, body:fd.get('body')||null, cover_url:fd.get('cover_url')||null, is_featured:!!fd.get('is_featured'), published_at:fd.get('published_at')?new Date(fd.get('published_at')).toISOString():null, updated_at:new Date().toISOString() };
    const { error }=await supabase.from('posts').update(upd).eq('id',p.id); if(error){ toast('บันทึกไม่สำเร็จ'); return; } toast('บันทึกแล้ว'); closeSheet(); location.hash=`#post?id=${p.id}`; }; } }