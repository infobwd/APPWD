
import { supabase } from '../api.js';

/** ===== State & helpers ===== */
const state = { page: 1, limit: 9, tab: 'all', category: 'ทั้งหมด', search: '' };
const els = { built: false };

function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }
function esc(s=''){ const map={ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }; return String(s).replace(/[&<>"']/g,ch=>map[ch]); }
function getHashParams(){ const h=(location.hash||'').split('?')[1]||''; return new URLSearchParams(h); }
function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }

/** ===== Public API ===== */
export async function initNews(){
  await ensureBuilt();
  // seed from hash (?tab=featured)
  const u=getHashParams(); const tab=(u.get('tab')||'').toLowerCase();
  if (tab==='featured') state.tab='featured';
  await loadNews();
}

/** Backward-compatible API expected by app.js */
export async function renderList(page=1, opts={}){
  await ensureBuilt();
  if (typeof page === 'number' && page >= 1) state.page = page;

  // allow overrides via opts
  if (opts.tab) state.tab = opts.tab;
  if (typeof opts.search === 'string') state.search = opts.search.trim();
  if (typeof opts.category === 'string') state.category = opts.category || 'ทั้งหมด';

  // sync UI with state
  syncControlsFromState();

  await loadNews();
}

/** ===== Build filter bar once ===== */
async function ensureBuilt(){
  if (els.built) return;
  const root = qs('#newsView'); const list = qs('#newsList');
  if (!root || !list) return;

  const bar = document.createElement('div');
  bar.id = 'newsFilterBar';
  bar.className = 'mb-3 flex flex-col sm:flex-row sm:items-center gap-2';
  bar.innerHTML = `
    <div class="flex flex-wrap gap-2">
      <button class="chip" data-tab="all">ทั้งหมด</button>
      <button class="chip" data-tab="featured">เด่น</button>
      <select id="newsCat" class="chip-select"><option value="ทั้งหมด">หมวด: ทั้งหมด</option></select>
    </div>
    <div class="sm:ml-auto"><input id="newsSearch" class="news-search" placeholder="ค้นหาชื่อข่าว…"></div>
  `;
  const hostCard = root.querySelector('.card');
  hostCard?.insertBefore(bar, hostCard.firstChild);

  // Events
  bar.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-tab]'); if(!btn) return;
    state.tab = btn.dataset.tab;
    state.page = 1;
    syncControlsFromState();
    loadNews();
  });
  const searchEl = bar.querySelector('#newsSearch');
  searchEl?.addEventListener('input', debounce(()=>{
    state.search = searchEl.value.trim();
    state.page = 1;
    loadNews();
  }, 250));

  // Load categories
  await loadCategories(bar.querySelector('#newsCat'));

  els.built = true;
  syncControlsFromState();
}

async function loadCategories(sel){
  try{
    const { data, error } = await supabase.from('posts')
      .select('category')
      .not('category','is',null)
      .order('category',{ascending:true})
      .range(0,999);
    if (error) throw error;
    const uniq = Array.from(new Set((data||[]).map(r=>r.category))).filter(Boolean);
    sel.innerHTML = `<option value="ทั้งหมด">หมวด: ทั้งหมด</option>` + uniq.map(c=>`<option value="${esc(c)}">หมวด: ${esc(c)}</option>`).join('');
    sel.addEventListener('change', ()=>{
      state.category = sel.value;
      state.tab = 'category';
      state.page = 1;
      syncControlsFromState();
      loadNews();
    });
  }catch{ /* silent */ }
}

function syncControlsFromState(){
  // tabs
  qsa('#newsFilterBar .chip').forEach(b=>{
    b.classList.toggle('active', b.dataset.tab === state.tab);
  });
  // category
  const sel = qs('#newsFilterBar #newsCat');
  if (sel && state.tab==='category') sel.value = state.category;
  // search
  const s = qs('#newsFilterBar #newsSearch');
  if (s) s.value = state.search || '';
}

/** ===== Data loading & rendering ===== */
async function loadNews(){
  const list = qs('#newsList');
  const pageInfo = qs('#pageInfo');
  if (!list) return;

  const from = (state.page-1)*state.limit;
  const to = from + state.limit - 1;

  let q = supabase.from('posts').select('id,title,cover_url,body,category,published_at,is_featured', { count:'exact' })
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending:false })
    .range(from, to);

  if (state.tab === 'featured') q = q.eq('is_featured', true);
  if (state.tab === 'category' && state.category && state.category !== 'ทั้งหมด') q = q.eq('category', state.category);
  if (state.search) q = q.ilike('title', `%${state.search}%`);

  const { data, error, count } = await q;
  if (error){ console.error(error); list.innerHTML = '<div class="text-sm text-red-600">โหลดข่าวไม่สำเร็จ</div>'; return; }

  list.innerHTML = renderNewsList(data||[]);

  const total = count || 0;
  const maxPage = Math.max(1, Math.ceil(total / state.limit));
  if (pageInfo) pageInfo.textContent = `หน้า ${state.page} / ${maxPage} • ทั้งหมด ${total} ข่าว`;
}

function renderNewsList(rows){
  if (!rows.length) return '<div class="text-sm text-ink3">ไม่พบข่าว</div>';
  return `<div class="news-grid">` + rows.map(card).join('') + `</div>`;
}

function card(r){
  const hasImg = !!(r.cover_url && r.cover_url.trim());
  const title = esc(r.title);
  const date = r.published_at ? new Date(r.published_at).toLocaleDateString('th-TH', { day:'2-digit', month:'short', year:'numeric' }) : '';
  const href = `#news?post=${r.id}`;
  const badge = r.is_featured ? `<span class="badge" style="right:10px; top:10px">เด่น</span>` : '';
  const media = hasImg
    ? `<img class="thumb" src="${r.cover_url}" alt="">`
    : `<div class="thumb grid place-items-center text-4xl" style="aspect-ratio:16/9; border-top-left-radius:14px; border-top-right-radius:14px; background:var(--card); border-bottom:1px solid var(--bd)">📰</div>`;
  const snippet = makeSnippet(r.body||'', 110);
  return `<article class="news-card">
    ${media}${badge}
    <div class="p-3">
      <a class="font-semibold block hover:underline" href="${href}">${title}</a>
      <div class="text-xs text-ink3 mb-1">${date}${r.category? ' • ' + esc(r.category): ''}</div>
      <div class="text-sm text-ink2 line-clamp-2">${esc(snippet)}</div>
      <div class="mt-2 flex gap-2"><a class="btn" href="${href}">อ่าน</a><button class="btn" onclick="window.sharePost && window.sharePost(${r.id})">แชร์</button></div>
    </div>
  </article>`;
}

function makeSnippet(html, maxLen=110){
  const txt = String(html).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  return txt.length > maxLen ? (txt.slice(0, maxLen-1) + '…') : txt;
}

/** Auto-init when #newsView exists and routerไม่ได้เรียกเอง */
document.addEventListener('DOMContentLoaded', ()=>{
  if (document.getElementById('newsView')) {
    // ถ้า router ภายนอกเรียก renderList อยู่แล้ว การเรียกซ้ำจะไม่ผิด
    initNews().catch(()=>{});
  }
});


/** Home list (latest few items) for #home page */
export async function renderHome(limit=6){
  const listEl = document.getElementById('homeNewsList');
  if (!listEl) return;
  try{
    const { data, error } = await supabase
      .from('posts')
      .select('id,title,cover_url,body,category,published_at,is_featured')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending:false })
      .limit(limit);
    if (error) throw error;
    const rows = data || [];
    if (!rows.length){
      listEl.innerHTML = '<div class="text-sm text-ink3">ยังไม่มีข่าว</div>';
      return;
    }
    listEl.innerHTML = rows.map(homeRow).join('');
  }catch(e){
    console.error(e);
    listEl.innerHTML = '<div class="text-sm text-red-600">โหลดข่าวไม่สำเร็จ</div>';
  }
}

function homeRow(r){
  const hasImg = !!(r.cover_url && r.cover_url.trim());
  const href = `#news?post=${r.id}`;
  const date = r.published_at ? new Date(r.published_at).toLocaleDateString('th-TH',{ day:'2-digit', month:'short' }) : '';
  const media = hasImg
    ? `<img src="${r.cover_url}" alt="" class="w-16 h-12 object-cover rounded-md border" />`
    : `<div class="w-16 h-12 grid place-items-center rounded-md border bg-white">📰</div>`;
  return `<a class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50/40" href="${href}">
    ${media}
    <div class="min-w-0">
      <div class="font-semibold text-sm truncate">${esc(r.title)}</div>
      <div class="text-[12px] text-ink3 truncate">${date}${r.category? ' • '+esc(r.category):''}</div>
    </div>
    <button class="ml-auto btn text-sm" onclick="event.preventDefault(); window.sharePost && window.sharePost(${r.id})">แชร์</button>
  </a>`;
}
