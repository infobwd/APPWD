
import { supabase } from '../api.js';
const isMobile = () => matchMedia('(max-width: 640px)').matches;

export async function renderFeaturedNews(limit = 6){
  const wrap = document.getElementById('homeNewsCards');
  if (!wrap) return;

  if (isMobile()) wrap.classList.add('slider'); else wrap.classList.remove('slider');

  const { data: rows, error } = await supabase
    .from('posts')
    .select('id,title,cover_url,body,category,published_at,is_featured')
    .eq('is_featured', true)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) console.error('[featured] error:', error);

  if (!rows || rows.length === 0) {
    wrap.innerHTML = `<div class="text-sm text-ink3">ยังไม่มีข่าวเด่น</div>`;
    return;
  }

  attachSeeAllLink(wrap);
  wrap.innerHTML = rows.map(toCard).join('');
  setupResizeHandler();
}

function toCard(r){
  const hasImg = !!(r.cover_url && r.cover_url.trim());
  const title = esc(r.title);
  const date = r.published_at ? new Date(r.published_at).toLocaleDateString('th-TH', { day:'2-digit', month:'short' }) : '';
  const openHref = `#news?post=${r.id}`;
  const badge = r.is_featured ? `<span class="badge">เด่น</span>` : '';

  const media = hasImg
    ? `<img class="thumb" src="${r.cover_url}" alt="">`
    : `<div class="thumb grid place-items-center text-3xl" style="aspect-ratio:16/9; border-top-left-radius:14px; border-top-right-radius:14px; background:var(--card); border-bottom:1px solid var(--bd)">📰</div>`;

  return `
  <article class="news-card">
    ${media}
    ${badge}
    <div class="p-3">
      <div class="font-semibold line-clamp-2">${title}</div>
      <div class="text-xs text-ink3">${date}</div>
      <div class="mt-2 flex gap-2">
        <a class="btn" href="${openHref}">อ่าน</a>
        <button class="btn" onclick="window.sharePost && window.sharePost(${r.id})">แชร์</button>
      </div>
    </div>
  </article>`;
}

function setupResizeHandler(){
  let timer;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const wrap = document.getElementById('homeNewsCards');
      if (!wrap) return;
      if (matchMedia('(max-width: 640px)').matches) wrap.classList.add('slider');
      else wrap.classList.remove('slider');
    }, 120);
  });
}

function esc(s=''){
  const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
  return String(s).replace(/[&<>"']/g, ch => map[ch]);
}

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('homeNewsCards');
  if (el) renderFeaturedNews().catch(()=>{});
});


function attachSeeAllLink(wrap){
  try{
    const parent = wrap.parentElement;
    if (!parent) return;
    // find header element right above
    const heads = parent.querySelectorAll('.text-sm.font-semibold.mb-1');
    if (!heads || !heads.length) return;
    const head = heads[0];
    if (head.dataset.enhanced) return;
    head.dataset.enhanced = '1';
    const a = document.createElement('a');
    a.href = '#news?tab=featured';
    a.textContent = 'ดูทั้งหมด';
    a.className = 'text-brand text-sm float-right';
    head.appendChild(a);
    // make header a flex container visually
    head.style.display='flex'; head.style.justifyContent='space-between'; head.style.alignItems='center';
  }catch(e){}
}
