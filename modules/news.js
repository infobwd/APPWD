import { supabase } from '../api.js';
import { openSheet, closeSheet, toast, skel, esc } from '../ui.js';

const PAGE_SIZE = 10;
let page = 1, total = 0;
let sliderTimer = null;

// -------- HOME --------
export async function renderHome(){
  const listEl = document.getElementById('homeNewsList');
  const cardsEl = document.getElementById('homeNewsCards');
  if(!listEl || !cardsEl) return;
  listEl.innerHTML = skel(2);
  cardsEl.innerHTML = skel(3,'180px');

  // latest for top2
  const latestResp = await supabase
    .from('posts')
    .select('id,title,category,published_at,cover_url,is_featured')
    .lte('published_at', new Date().toISOString())
    .order('published_at',{ascending:false})
    .limit(8);
  const latest = latestResp.data || [];

  // featured pool for cards
  const featuredResp = await supabase
    .from('posts')
    .select('id,title,category,published_at,cover_url,is_featured')
    .eq('is_featured', true)
    .order('published_at',{ascending:false})
    .limit(12);
  const featured = featuredResp.data || [];

  const top2 = latest.slice(0,2);
  const top2Ids = new Set(top2.map(x=>x.id));
  const pool = [...featured, ...latest.filter(p=>!top2Ids.has(p.id))];
  const picked = [];
  const seen = new Set();
  for(const p of pool){
    if(picked.length>=3) break;
    if(top2Ids.has(p.id) || seen.has(p.id)) continue;
    picked.push(p); seen.add(p.id);
  }

  listEl.innerHTML = top2.map(p => {
    const date = p.published_at ? new Date(p.published_at).toLocaleDateString('th-TH') : '';
    const thumb = p.cover_url
      ? `<img class='w-16 h-16 object-cover rounded-lg border' src='${p.cover_url}'>`
      : `<div class='w-16 h-16 rounded-lg bg-brandSoft grid place-items-center text-brand'>📰</div>`;
    return `<div class='p-3 border rounded-xl bg-[var(--card)] flex items-center gap-3' style='border-color:var(--bd)'>
      <a class='flex-shrink-0' href='#post?id=${p.id}'>${thumb}</a>
      <div class='flex-1'>
        <a href='#post?id=${p.id}' class='font-semibold leading-snug line-clamp-2' style='color:var(--ink)'>${esc(p.title)}</a>
        <div class='text-[12px] text-ink3'>${esc(p.category||'ทั่วไป')} • ${date}</div>
      </div>
    </div>`;
  }).join('') || '<div class="text-ink3">ยังไม่มีข่าว</div>';

  const ids = picked.map(p=>p.id);
  const statMap = await fetchStats(ids);

  cardsEl.innerHTML = picked.map(p => {
    const s = statMap.get(p.id) || {views:0, likes:0};
    const date = p.published_at ? new Date(p.published_at).toLocaleDateString('th-TH') : '';
    const hero = p.cover_url
      ? `<img class='thumb' src='${p.cover_url}'>`
      : `<div class='thumb grid place-items-center bg-brandSoft text-brand'>📰</div>`;
    return `<div class='news-card'>
      <a href='#post?id=${p.id}'>${hero}</a>
      <div class='badge'>เด่น</div>
      <div class='p-3'>
        <div class='text-[12px] text-ink3 mb-1'>${esc(p.category||'ทั่วไป')} • ${date}</div>
        <a class='font-semibold leading-snug line-clamp-2 block' href='#post?id=${p.id}' style='color:var(--ink)'>${esc(p.title)}</a>
        <div class='flex items-center gap-3 mt-2 text-[12px] text-ink2'>
          <span>👁️ ${s.views}</span>
          <span>❤️ ${s.likes}</span>
          <button onclick='sharePost(${p.id})' class='underline'>แชร์</button>
        </div>
      </div>
    </div>`;
  }).join('');

  // small screens: auto slide
  const isSmall = (typeof matchMedia!=='undefined') && matchMedia('(max-width: 640px)').matches;
  if(isSmall){
    cardsEl.classList.add('slider');
    const ms = 4000;
    clearInterval(sliderTimer);
    sliderTimer = setInterval(()=>{
      try{
        const w = cardsEl.clientWidth;
        const next = Math.round((cardsEl.scrollLeft + w)/w);
        const max = cardsEl.children.length - 1;
        const to = (next>max?0:next)*w;
        cardsEl.scrollTo({left:to, behavior:'smooth'});
      }catch(_){}
    }, ms);
  }else{
    if(sliderTimer) clearInterval(sliderTimer);
  }
}

// -------- LIST --------
export async function renderList(){
  const box=document.getElementById('newsList');
  if(!box) return;
  const btn=document.getElementById('btnComposePost');
  const can = await canManageContent();
  if(btn){
    btn.classList.toggle('hide', !can);
    btn.onclick=()=>openComposeSheet();
  }
  await loadPage(1);

  const prev=document.getElementById('btnPrev');
  const next=document.getElementById('btnNext');
  if(prev) prev.onclick=()=>{ if(page>1) loadPage(page-1); };
  if(next) next.onclick=()=>{
    const max=Math.ceil(total/PAGE_SIZE)||1;
    if(page<max) loadPage(page+1);
  };
}

async function loadPage(p){
  page=p;
  const box=document.getElementById('newsList');
  if(!box) return;
  box.innerHTML = skel(PAGE_SIZE,'72px');

  const from=(page-1)*PAGE_SIZE, to=from+PAGE_SIZE-1;
  const resp = await supabase
    .from('posts')
    .select('id,title,category,published_at,cover_url,created_by', {count:'exact'})
    .order('published_at',{ascending:false})
    .range(from,to);

  const data = resp.data||[];
  total = resp.count||0;
  const ids = data.map(x=>x.id);
  const statMap = await fetchStats(ids);
  const can = await canManageContent();

  box.innerHTML = data.map(p => {
    const s = statMap.get(p.id)||{views:0,likes:0};
    const date = p.published_at ? new Date(p.published_at).toLocaleDateString('th-TH') : '';
    const tools = can
      ? `<div class='flex gap-2 mt-1'>
          <button class='btn text-xs' onclick='editPost(${p.id})'>แก้ไข</button>
          <button class='btn text-xs' onclick='deletePost(${p.id})'>ลบ</button>
        </div>`
      : '';
    const thumb = p.cover_url
      ? `<img class='w-16 h-16 object-cover rounded-lg border' src='${p.cover_url}'>`
      : `<div class='w-16 h-16 rounded-lg bg-brandSoft grid place-items-center text-brand'>📰</div>`;
    return `<article class='p-3 border rounded-xl bg-[var(--card)] flex items-center gap-3' style='border-color:var(--bd)'>
      <a class='flex-shrink-0' href='#post?id=${p.id}'>${thumb}</a>
      <div class='flex-1'>
        <a href='#post?id=${p.id}' class='font-semibold leading-snug line-clamp-2' style='color:var(--ink)'>${esc(p.title)}</a>
        <div class='text-[12px] text-ink3'>${esc(p.category||'ทั่วไป')} • ${date}</div>
        <div class='flex items-center gap-3 mt-1 text-[12px] text-ink2'>
          <span>👁️ ${s.views}</span><span>❤️ ${s.likes}</span>
          <button onclick='sharePost(${p.id})' class='underline'>แชร์</button>
        </div>
        ${tools}
      </div>
    </article>`;
  }).join('') || '<div class="text-ink3">ยังไม่มีข่าว</div>';

  const info=document.getElementById('pageInfo');
  if(info){
    const max=Math.ceil(total/PAGE_SIZE)||1;
    info.textContent = `หน้า ${page} / ${max} • ทั้งหมด ${total} ข่าว`;
  }
}

// -------- DETAIL --------
export async function renderDetail(id){
  const box=document.getElementById('postDetail');
  if(!box) return;
  box.innerHTML = skel(4,'80px');

  const resp = await supabase
    .from('posts')
    .select('id,title,category,body,cover_url,published_at,created_by,is_featured')
    .eq('id', id).maybeSingle();
  const p = resp.data;
  if(!p){ box.innerHTML = '<div class="text-ink3">ไม่พบข่าว</div>'; return; }

  try{ await supabase.rpc('increment_view',{p_post_id:p.id}); }catch(_){}

  const statResp = await supabase
    .from('post_stats')
    .select('view_count,like_count').eq('post_id',p.id).maybeSingle();
  const views = (statResp.data && statResp.data.view_count) || 0;
  const likes = (statResp.data && statResp.data.like_count) || 0;

  const prof = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  const lineId = prof?.userId || null;
  let liked = false;
  if(lineId){
    const lk = await supabase.from('post_likes').select('post_id')
      .eq('post_id',p.id).eq('line_user_id',lineId).maybeSingle();
    liked = !!lk.data;
  }

  const cover = p.cover_url ? `<img class='cover mb-3' src='${p.cover_url}'>` : '';
  const md = window.marked ? window.marked.parse(p.body||'') : (p.body||'');
  const safe = window.DOMPurify ? window.DOMPurify.sanitize(md) : md;
  const d = p.published_at
    ? new Date(p.published_at).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})
    : '';
  const can = await canManageContent(p.created_by);

  box.innerHTML = `${cover}
    <h1 class='text-xl font-semibold mb-1'>${esc(p.title)}</h1>
    <div class='text-xs text-ink3 mb-3'>${esc(p.category||'ทั่วไป')} • ${d}</div>
    <div class='prose prose-sm max-w-none mb-4' style='color:var(--ink)'>${safe}</div>
    <div class='flex items-center gap-2'>
      <button id='btnLike' class='btn' aria-pressed='${liked}'>${liked?'❤️':'🤍'} <span id='likeCount' class='ml-1'>${likes}</span></button>
      <button id='btnShare' class='btn'>แชร์ LINE</button>
      <div class='ml-auto text-sm text-ink3'>เปิดอ่าน <span id='viewCount'>${views}</span> ครั้ง</div>
    </div>
    ${can?`<div class='mt-3 flex gap-2'><button class='btn btn-prim' id='editP'>แก้ไข</button><button class='btn' id='delP'>ลบ</button></div>`:''}`;

  const editBtn=document.getElementById('editP');
  const delBtn=document.getElementById('delP');
  if(editBtn) editBtn.onclick=()=>openEditSheet(p);
  if(delBtn) delBtn.onclick=async()=>{
    if(!confirm('ลบข่าวนี้?')) return;
    const del=await supabase.from('posts').delete().eq('id',p.id);
    if(del.error){ toast('ลบไม่สำเร็จ'); return; }
    location.hash='#news';
  };

  const likeBtn=document.getElementById('btnLike');
  if(likeBtn){
    likeBtn.onclick=async()=>{
      if(!lineId){ toast('กรุณาเข้าสู่ระบบด้วย LINE ก่อน'); return; }
      const pressed = (likeBtn.getAttribute('aria-pressed')==='true');
      try{
        if(pressed){
          const res=await supabase.rpc('unlike_post',{p_post_id:p.id,p_line_user_id:lineId});
          likeBtn.setAttribute('aria-pressed','false');
          likeBtn.firstChild.nodeValue='🤍';
          document.getElementById('likeCount').textContent=(res.data||0);
        }else{
          const res=await supabase.rpc('like_post',{p_post_id:p.id,p_line_user_id:lineId});
          likeBtn.setAttribute('aria-pressed','true');
          likeBtn.firstChild.nodeValue='❤️';
          document.getElementById('likeCount').textContent=(res.data||0);
        }
      }catch(_){ toast('ดำเนินการไม่สำเร็จ'); }
    };
  }
  const btnShare=document.getElementById('btnShare');
  if(btnShare) btnShare.onclick=()=>sharePost(p.id);

  setTimeout(async()=>{
    const s2=await supabase.from('post_stats').select('view_count').eq('post_id',p.id).maybeSingle();
    if(s2.data && document.getElementById('viewCount')) document.getElementById('viewCount').textContent=s2.data.view_count;
  },1200);
}

// -------- UTIL --------
async function fetchStats(ids){
  const map=new Map();
  if(!ids || ids.length===0) return map;
  const resp = await supabase.from('post_stats').select('post_id,view_count,like_count').in('post_id',ids);
  (resp.data||[]).forEach(r=>map.set(r.post_id, {views:r.view_count||0, likes:r.like_count||0}));
  return map;
}

window.sharePost = async function(id){
  const base=(localStorage.getItem('APPWD_PUBLIC_URL')||'./');
  const row = await supabase.from('posts').select('id,title,category,cover_url').eq('id',id).maybeSingle();
  const p = row.data;
  if(!p){ toast('ไม่พบบทความ'); return; }
  const url = base + `index.html#post?id=${p.id}`;
  const bubble = {
    type:'bubble',
    hero: p.cover_url ? {type:'image', url:p.cover_url, size:'full', aspectRatio:'16:9', aspectMode:'cover'} : undefined,
    body:{type:'box', layout:'vertical', contents:[
      {type:'text', text:p.title||'ข่าว', weight:'bold', size:'md', wrap:true},
      {type:'text', text:(p.category||'ทั่วไป'), size:'xs', color:'#6B7280', wrap:true, margin:'sm'}
    ]},
    footer:{type:'box', layout:'vertical', spacing:'sm', contents:[
      {type:'button', style:'primary', height:'sm', action:{type:'uri', label:'อ่านข่าว', uri:url}}
    ]}
  };
  try{
    if(window.liff && window.liff.isApiAvailable && window.liff.isApiAvailable('shareTargetPicker')){
      await window.liff.shareTargetPicker([{type:'flex', altText:`แชร์ข่าว: ${p.title}`, contents:bubble}]);
    }else{
      await navigator.clipboard.writeText(url);
      toast('คัดลอกลิงก์แล้ว');
    }
  }catch(_){ toast('แชร์ไม่สำเร็จ'); }
};

async function canManageContent(created_by){
  const auth = await supabase.auth.getUser();
  const user = auth.data && auth.data.user;
  if(user && created_by && user.id === created_by) return true;

  if(user){
    const ed = await supabase.from('editors').select('user_id').eq('user_id',user.id).maybeSingle();
    if(ed.data) return true;
  }
  const prof = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  const lineId = prof?.userId || null;
  if(lineId){
    const u = await supabase.from('users').select('role').eq('line_user_id',lineId).maybeSingle();
    if(u.data && (u.data.role==='admin'||u.data.role==='editor')) return true;
  }
  return false;
}

// -------- SHEETS --------
function openComposeSheet(){
  const form = `<form id='composePostForm' class='form-grid'>
    <div><label>หัวข้อข่าว</label><input name='title' required></div>
    <div class='grid grid-cols-2 gap-2'>
      <div><label>หมวด</label><input name='category' placeholder='ทั่วไป'></div>
      <div><label>เผยแพร่</label><input type='datetime-local' name='published_at'></div>
    </div>
    <div><label>ภาพปก (cover_url)</label><input name='cover_url' placeholder='https://...'></div>
    <div><label class='flex items-center gap-2'><input type='checkbox' name='is_featured'> ปักหมุด/สติกเกอร์</label></div>
    <div><label>เนื้อหา (Markdown)</label><textarea name='body' rows='10' placeholder='# หัวข้อ...'></textarea></div>
  </form>`;
  openSheet(form, { title:'เพิ่มข่าว', actions:`<div class='flex gap-2 justify-end'>
    <button class='btn' id='cancelSheet'>ยกเลิก</button>
    <button class='btn btn-prim' id='okCompose'>บันทึก</button>
  </div>` });
  const cancel = document.getElementById('cancelSheet');
  if(cancel) cancel.onclick = closeSheet;
  const ok = document.getElementById('okCompose');
  if(ok) ok.onclick = async ()=>{
    const formEl = document.getElementById('composePostForm');
    const fd = new FormData(formEl);
    const payload = {
      title: fd.get('title'),
      category: fd.get('category') || null,
      body: fd.get('body') || null,
      cover_url: fd.get('cover_url') || null,
      is_featured: !!fd.get('is_featured'),
      published_at: fd.get('published_at') ? new Date(fd.get('published_at')).toISOString() : new Date().toISOString()
    };
    const ins = await supabase.from('posts').insert(payload).select('id').single();
    if(ins.error){ toast('บันทึกข่าวไม่สำเร็จ'); return; }
    closeSheet();
    location.hash = `#post?id=${ins.data.id}`;
    const homeList=document.getElementById('homeNewsList'); if(homeList){ try{ await import('./news.js').then(m=>m.renderHome()); }catch(_){}}
  };
}

function openEditSheet(p){
  const form = `<form id='editPostForm' class='form-grid'>
    <div><label>หัวข้อข่าว</label><input name='title' value='${esc(p.title||"")}'></div>
    <div class='grid grid-cols-2 gap-2'>
      <div><label>หมวด</label><input name='category' value='${esc(p.category||"")}'></div>
      <div><label>เผยแพร่</label><input type='datetime-local' name='published_at' value='${p.published_at? new Date(p.published_at).toISOString().slice(0,16):""}'></div>
    </div>
    <div><label>ภาพปก (cover_url)</label><input name='cover_url' value='${esc(p.cover_url||"")}'></div>
    <div><label class='flex items-center gap-2'><input type='checkbox' name='is_featured' ${p.is_featured?'checked':''}> ปักหมุด/สติกเกอร์</label></div>
    <div><label>เนื้อหา (Markdown)</label><textarea name='body' rows='12'>${esc(p.body||"")}</textarea></div>
  </form>`;
  openSheet(form, { title:'แก้ไขข่าว', actions:`<div class='flex gap-2 justify-between'>
    <button class='btn' id='cancelSheet'>ยกเลิก</button>
    <div class='flex gap-2'>
      <button class='btn' id='delPost'>ลบ</button>
      <button class='btn btn-prim' id='okEdit'>บันทึก</button>
    </div>
  </div>` });
  const cancel=document.getElementById('cancelSheet'); if(cancel) cancel.onclick=closeSheet;
  const del=document.getElementById('delPost'); if(del) del.onclick=async()=>{
    if(!confirm('ลบข่าวนี้?')) return;
    await supabase.from('posts').delete().eq('id',p.id);
    closeSheet(); location.hash='#news';
  };
  const ok=document.getElementById('okEdit');
  if(ok) ok.onclick=async()=>{
    const formEl = document.getElementById('editPostForm');
    const fd = new FormData(formEl);
    const upd = {
      title: fd.get('title'),
      category: fd.get('category') || null,
      body: fd.get('body') || null,
      cover_url: fd.get('cover_url') || null,
      is_featured: !!fd.get('is_featured'),
      published_at: fd.get('published_at') ? new Date(fd.get('published_at')).toISOString() : null,
      updated_at: new Date().toISOString()
    };
    const up = await supabase.from('posts').update(upd).eq('id',p.id);
    if(up.error){ toast('บันทึกไม่สำเร็จ'); return; }
    toast('บันทึกแล้ว','ok'); closeSheet(); const detail=document.getElementById('postDetail'); if(detail){ try{ await import('./news.js').then(m=>m.renderDetail(p.id)); }catch(_){}} else { location.hash = `#post?id=${p.id}`; } const homeList=document.getElementById('homeNewsList'); if(homeList){ try{ await import('./news.js').then(m=>m.renderHome()); }catch(_){} }
  };
}

// window helpers
window.editPost = async function(id){
  const { data } = await supabase.from('posts').select('*').eq('id',id).maybeSingle();
  if(!data) return;
  openEditSheet(data);
};
window.deletePost = async function(id){
  if(!confirm('ลบข่าวนี้?')) return;
  const del = await supabase.from('posts').delete().eq('id',id);
  if(del.error){ toast('ลบไม่สำเร็จ'); return; }
  toast('ลบแล้ว'); await import('./news.js').then(m=>m.renderList());
};