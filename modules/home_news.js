
import { supabase } from '../api.js';
import { PUBLIC_URL } from '../config.js';

const isMobile = () => matchMedia('(max-width: 640px)').matches;

export async function renderFeaturedNews(){
  const wrap = document.getElementById('homeNewsCards');
  if (!wrap) return;

  // Toggle slider class based on viewport
  if (isMobile()) wrap.classList.add('slider');
  else wrap.classList.remove('slider');

  // Try featured first
  let rows = [];
  try{
    const { data, error } = await supabase
      .from('posts')
      .select('id,title,cover_url,body,category,published_at,is_featured')
      .eq('is_featured', true)
      // .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(6);
    if (error) throw error;
    rows = data || [];
  }catch(e){
    console.warn('featured fetch error:', e);
  }

  // Fallback to latest
  if (!rows || rows.length === 0){
    try{
      const { data } = await supabase
        .from('posts')
        .select('id,title,cover_url,body,category,published_at,is_featured')
        // .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false })
        .limit(6);
      rows = data || [];
    }catch(e){ rows = []; }
  }

  // Render
  if (!rows.length){
    wrap.innerHTML = `<div class="text-sm text-ink3">ยังไม่มีข่าวให้แสดง</div>`;
    return;
  }

  wrap.innerHTML = rows.map(toCard).join('');

  // Delegate share buttons
  wrap.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-share]');
    if (btn){
      const id = Number(btn.dataset.share || 0);
      if (window.sharePost) window.sharePost(id);
      else openNews(id);
    }
  }, { passive: true });
}

function openNews(id){
  const url = newsUrl(id);
  if ('navigate' in window) {
    location.hash = '#news?post=' + id;
  } else {
    location.href = url;
  }
}

function newsUrl(id){
  const base = (typeof PUBLIC_URL === 'string' && PUBLIC_URL) ? PUBLIC_URL : (location.origin + location.pathname);
  return base + '#news?post=' + id;
}

function toCard(r){
  const img = r.cover_url || './icons/icon-192.png';
  const title = esc(r.title || 'ข่าว');
  const date = r.published_at ? new Date(r.published_at).toLocaleDateString('th-TH', { day:'2-digit', month:'short' }) : '';
  return `
  <article class="news-card">
    <img class="thumb" src="${img}" alt="">
    ${r.is_featured ? `<span class="badge">เด่น</span>` : ''}
    <div class="p-3">
      <div class="font-semibold line-clamp-2">${title}</div>
      <div class="text-xs text-ink3">${date}</div>
      <div class="mt-2 flex gap-2">
        <a class="btn" href="#news?post=${r.id}">อ่าน</a>
        <button class="btn" data-share="${r.id}">แชร์</button>
      </div>
    </div>
  </article>`;
}

function esc(s=''){
  const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
  return String(s).replace(/[&<>"']/g, ch => map[ch]);
}

// Auto render on DOM ready if element exists
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('homeNewsCards');
  if (el) renderFeaturedNews().catch(()=>{});
});

// expose for manual refresh
window.renderFeaturedNews = renderFeaturedNews;
