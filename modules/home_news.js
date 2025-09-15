
import { supabase } from '../api.js';

const isMobile = () => matchMedia('(max-width: 640px)').matches;

export async function renderFeaturedNews(limit = 6){
  const wrap = document.getElementById('homeNewsCards');
  if (!wrap) return;

  if (isMobile()) wrap.classList.add('slider');
  else wrap.classList.remove('slider');

  // Featured only
  const { data: rows, error } = await supabase
    .from('posts')
    .select('id,title,cover_url,body,category,published_at,is_featured')
    .eq('is_featured', true)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[featured] error:', error);
    wrap.innerHTML = `<div class="text-sm text-red-600">โหลดข่าวเด่นไม่สำเร็จ</div>`;
    return;
  }
  if (!rows || rows.length === 0) {
    wrap.innerHTML = `<div class="text-sm text-ink3">ยังไม่มีข่าวเด่น</div>`;
    return;
  }

  wrap.innerHTML = rows.map(toCard).join('');
}

function toCard(r){
  const img = r.cover_url || './icons/icon-192.png';
  const title = esc(r.title);
  const date = r.published_at ? new Date(r.published_at).toLocaleDateString('th-TH', { day:'2-digit', month:'short' }) : '';
  const openHref = `#news?post=${r.id}`;
  return `
  <article class="news-card">
    <img class="thumb" src="${img}" alt="">
    <span class="badge">เด่น</span>
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

function esc(s=''){ return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[ch])); }

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('homeNewsCards');
  if (el) renderFeaturedNews().catch(()=>{});
});
