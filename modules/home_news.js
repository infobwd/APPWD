
import { supabase } from '../api.js';

const isMobile = () => matchMedia('(max-width: 640px)').matches;

export async function renderFeaturedNews(limit = 3){
  const wrap = document.getElementById('homeNewsCards');
  if (!wrap) return;

  if (isMobile()) wrap.classList.add('slider');
  else wrap.classList.remove('slider');

  let { data: rows, error } = await supabase
    .from('posts')
    .select('id,title,cover_url,body,category,published_at,is_featured')
    .eq('is_featured', true)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[featured] error:', error);
  }

  if (!rows || rows.length === 0) {
    const res2 = await supabase
      .from('posts')
      .select('id,title,cover_url,body,category,published_at,is_featured')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(limit);
    rows = res2.data || [];
  }

  if (!rows || rows.length === 0) {
    wrap.innerHTML = `<div class="text-sm text-ink3">ยังไม่มีข่าว</div>`;
    return;
  }

  wrap.innerHTML = rows.map(toCard).join('');
  setupResizeHandler();
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

function toCard(r){
  const img = r.cover_url || './icons/icon-192.png';
  const title = escHtml(r.title);
  const date = r.published_at ? new Date(r.published_at).toLocaleDateString('th-TH', { day:'2-digit', month:'short' }) : '';
  const openHref = `#news?post=${r.id}`;
  const badge = r.is_featured ? `<span class="badge">เด่น</span>` : '';
  return `
  <article class="news-card">
    <img class="thumb" src="${img}" alt="">
    ${badge}
    <div class="p-3">
      <div class="font-semibold">${title}</div>
      <div class="text-xs text-ink3">${date}</div>
      <div class="mt-2 flex gap-2">
        <a class="btn" href="${openHref}">อ่าน</a>
        <button class="btn" onclick="window.sharePost && window.sharePost(${r.id})">แชร์</button>
      </div>
    </div>
  </article>`;
}

function escHtml(s=''){ const map={ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }; return String(s).replace(/[&<>\"']/g,ch=>map[ch]); }

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('homeNewsCards');
  if (el) renderFeaturedNews().catch(()=>{});
});
