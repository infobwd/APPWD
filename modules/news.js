
import { supabase } from '../api.js';

let state = {
  page: 1,
  pageSize: 10,
  category: 'ทั้งหมด',
  featuredOnly: false,
  q: ''
};

function parseHash(){
  const hash = (location.hash||'#news').split('?')[1] || '';
  const params = new URLSearchParams(hash);
  state.featuredOnly = params.get('featured') === '1';
  state.category = params.get('cat') || 'ทั้งหมด';
  state.q = params.get('q') || '';
  const p = parseInt(params.get('page')||'1', 10);
  state.page = isNaN(p) || p < 1 ? 1 : p;
}

function pushHash(){
  const params = new URLSearchParams();
  if (state.featuredOnly) params.set('featured','1');
  if (state.category && state.category !== 'ทั้งหมด') params.set('cat', state.category);
  if (state.q) params.set('q', state.q);
  if (state.page > 1) params.set('page', String(state.page));
  location.hash = '#news?' + params.toString();
}

export async function renderNewsList(){
  parseHash();
  const root = document.getElementById('newsView');
  const list = document.getElementById('newsList');
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('btnPrev');
  const nextBtn = document.getElementById('btnNext');

  if (!root || !list) return;

  // Build filters UI (top of card)
  const card = root.querySelector('.card');
  ensureFilterBar(card);

  await loadAndRender();

  // bind paging
  if (prevBtn) prevBtn.onclick = () => { if (state.page > 1) { state.page--; pushHash(); } };
  if (nextBtn) nextBtn.onclick = () => { state.page++; pushHash(); };

  // watch hash change
  }
  }, { once:true }); // rebind per render
}

function buildQuery(){
  let q = supabase.from('posts').select('id,title,cover_url,body,category,published_at,is_featured', { count:'exact' });

  if (state.featuredOnly) q = q.eq('is_featured', true);
  if (state.category && state.category !== 'ทั้งหมด') q = q.eq('category', state.category);
  if (state.q) {
    // simple OR search on title/body
    const pattern = `%${state.q}%`;
    q = q.or(`title.ilike.${pattern},body.ilike.${pattern}`);
  }
  q = q.lte('published_at', new Date().toISOString())
       .order('published_at', { ascending: false });

  const from = (state.page - 1) * state.pageSize;
  const to   = from + state.pageSize - 1;
  return { q, from, to };
}

async function loadAndRender(){
  const list = document.getElementById('newsList');
  const pageInfo = document.getElementById('pageInfo');
  list.innerHTML = `<div class="text-sm text-ink3">กำลังโหลดข่าว...</div>`;

  // fetch categories for dropdown chips (once per render)
  const cats = await fetchCategories();

  // query posts
  const { q, from, to } = buildQuery();
  const { data, error, count } = await q.range(from, to);

  if (error) {
    list.innerHTML = `<div class="text-sm text-red-600">โหลดข่าวไม่สำเร็จ</div>`;
    console.error(error);
    return;
  }
  const rows = data || [];
  list.innerHTML = rows.map(itemCard).join('');

  const total = count || rows.length;
  const maxPage = Math.max(1, Math.ceil(total / state.pageSize));
  const pageText = `หน้า ${state.page} / ${maxPage} • ทั้งหมด ${total} รายการ`;
  if (pageInfo) pageInfo.textContent = pageText;

  const prevBtn = document.getElementById('btnPrev');
  const nextBtn = document.getElementById('btnNext');
  if (prevBtn) prevBtn.disabled = state.page <= 1;
  if (nextBtn) nextBtn.disabled = state.page >= maxPage;

  // update filters UI with categories
  renderFilterBar(cats);
}

function itemCard(r){
  const img = r.cover_url || './icons/icon-192.png';
  const date = r.published_at ? new Date(r.published_at).toLocaleDateString('th-TH', { dateStyle:'medium' }) : '';
  const snippet = makeSnippet(r.body || '');
  return `
  <article class="news-card grid grid-cols-[120px_1fr] gap-3 p-2">
    <img class="thumb w-[120px] h-[80px] object-cover rounded-lg border" src="${img}" alt="">
    <div class="pr-2">
      <div class="flex items-center gap-2">
        ${r.is_featured ? `<span class="badge">เด่น</span>` : ''}
        ${r.category ? `<span class="text-[12px] text-ink3">${esc(r.category)}</span>` : ''}
      </div>
      <div class="font-semibold leading-tight mt-1">${esc(r.title)}</div>
      <div class="text-xs text-ink3">${date}</div>
      <div class="text-sm text-ink2 line-clamp-2 mt-1">${esc(snippet)}</div>
      <div class="mt-2 flex gap-2">
        <a class="btn" href="#news?post=${r.id}">อ่าน</a>
        <button class="btn" onclick="window.sharePost && window.sharePost(${r.id})">แชร์</button>
      </div>
    </div>
  </article>`;
}

function makeSnippet(html){
  const txt = String(html).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  return txt.slice(0, 140) + (txt.length > 140 ? '…' : '');
}

function esc(s=''){ return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[ch])); }

function ensureFilterBar(card){
  if (!card) return;
  if (card.querySelector('#newsFilters')) return;

  const bar = document.createElement('div');
  bar.id = 'newsFilters';
  bar.className = 'mb-3 flex flex-wrap items-center gap-2';
  bar.innerHTML = `
    <label class="inline-flex items-center gap-1 text-sm">
      <input id="fltFeatured" type="checkbox" class="scale-110">
      <span>เฉพาะข่าวเด่น</span>
    </label>
    <select id="fltCategory" class="border rounded px-2 py-1 text-sm"></select>
    <input id="fltQ" class="border rounded px-2 py-1 text-sm" placeholder="ค้นหา...">
    <button id="fltApply" class="btn">กรอง</button>
  `;
  card.insertBefore(bar, card.firstChild);

  document.getElementById('fltFeatured').checked = !!state.featuredOnly;
  document.getElementById('fltQ').value = state.q;
  // category options will be filled later
  document.getElementById('fltApply').onclick = () => {
    const f = document.getElementById('fltFeatured').checked;
    const c = document.getElementById('fltCategory').value;
    const q = document.getElementById('fltQ').value.trim();
    state.featuredOnly = f;
    state.category = c;
    state.q = q;
    state.page = 1;
    pushHash();
  };
}

function renderFilterBar(cats){
  const sel = document.getElementById('fltCategory');
  if (!sel) return;
  const opts = ['ทั้งหมด', ...cats];
  sel.innerHTML = opts.map(c => `<option ${c===state.category?'selected':''}>${esc(c)}</option>`).join('');
}

async function fetchCategories(){
  try{
    const { data, error } = await supabase.from('posts').select('category').not('category','is', null);
    if (error) return [];
    const set = new Set(data.map(r => r.category || 'อื่น ๆ'));
    return Array.from(set).sort();
  }catch{ return []; }
}

// Expose for manual refresh if needed
window.renderNewsList = renderNewsList;


import { renderFeaturedNews } from './home_news.js';

async function renderHomeLatestList(limit=6){
  const listEl = document.getElementById('homeNewsList');
  if (!listEl) return;
  listEl.innerHTML = `<div class="text-sm text-ink3">กำลังโหลดข่าวล่าสุด...</div>`;
  try{
    const { data, error } = await supabase
      .from('posts')
      .select('id,title,cover_url,body,category,published_at,is_featured')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    const rows = data || [];
    if (!rows.length){ listEl.innerHTML = `<div class="text-sm text-ink3">ยังไม่มีข่าว</div>`; return; }
    listEl.innerHTML = rows.map(r=>{
      const img = r.cover_url || './icons/icon-192.png';
      const date = r.published_at ? new Date(r.published_at).toLocaleDateString('th-TH', { dateStyle:'medium' }) : '';
      const snippet = (r.body || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,120) + (((r.body||'').length>120)?'…':'');
      return `
      <article class="card p-2 grid grid-cols-[80px_1fr] gap-3">
        <img class="w-[80px] h-[56px] object-cover rounded-lg border" src="${img}" alt="">
        <div class="pr-1">
          <div class="flex items-center gap-2">${r.is_featured?`<span class='badge'>เด่น</span>`:''}${r.category?`<span class='text-[12px] text-ink3'>${esc(r.category)}</span>`:''}</div>
          <div class="font-semibold leading-tight mt-0.5">${esc(r.title)}</div>
          <div class="text-xs text-ink3">${date}</div>
          <div class="text-sm text-ink2 line-clamp-2 mt-0.5">${esc(snippet)}</div>
          <div class="mt-1 flex gap-2">
            <a class="btn" href="#news?post=${r.id}">อ่าน</a>
            <button class="btn" onclick="window.sharePost && window.sharePost(${r.id})">แชร์</button>
          </div>
        </div>
      </article>`;
    }).join('');
  }catch(e){
    listEl.innerHTML = `<div class="text-sm text-red-600">โหลดข่าวล่าสุดไม่สำเร็จ</div>`;
    console.error(e);
  }
}

export async function renderHome(){
  await renderHomeLatestList();
  await renderFeaturedNews(6);
}

export async function render(){ return renderNewsList(); }
