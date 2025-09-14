
import { supabase } from '../api.js';
import { SLIDER_AUTO_MS } from '../config.js';

function initFeaturedAutoSlide(scroller){
  try{
    if (!scroller) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSmall = window.matchMedia('(max-width: 520px)').matches;
    if (!isSmall || prefersReduced) return;
    const cards = scroller.querySelectorAll('.feat-card');
    if (!cards.length) return;
    let i = 0;
    const step = () => {
      i = (i + 1) % cards.length;
      const x = cards[i].offsetLeft - scroller.offsetLeft;
      scroller.scrollTo({ left: x, behavior: 'smooth' });
    };
    let ms = Number(SLIDER_AUTO_MS || 4000);
    if (!ms || ms < 1200) ms = 1200;
    let timer = setInterval(step, ms);
    const stop = () => { if (timer){ clearInterval(timer); timer = null; } };
    scroller.addEventListener('pointerdown', stop, { once:true });
    scroller.addEventListener('touchstart', stop, { once:true });
    scroller.addEventListener('wheel', stop, { once:true });
  }catch(e){}
}

export async function renderHome(){
  const listWrap = document.getElementById('homeNewsList');
  const featuredWrap = document.getElementById('homeNewsCards');
  if (featuredWrap) featuredWrap.innerHTML = `<div class="p-4 text-slate-400">กำลังโหลด…</div>`;
  if (listWrap) listWrap.innerHTML = '';

  // Featured posts
  let featured = [];
  try{
    const q = await supabase.from('posts')
      .select('id,title,category,cover_url,published_at,is_featured')
      .eq('is_featured', true)
      .order('published_at', { ascending: false })
      .limit(6);
    featured = q?.data || [];
  }catch{ featured = []; }

  if (featuredWrap){
    if (!featured.length){
      featuredWrap.innerHTML = '';
    } else {
      featuredWrap.innerHTML = `<div class="featured-cards slider-x"></div>`;
      const scroller = featuredWrap.querySelector('.featured-cards');
      featured.forEach(p => {
        const card = document.createElement('div');
        card.className = 'news-card-featured feat-card';
        card.innerHTML = `
          ${p.cover_url ? `<img src="${p.cover_url}" class="w-full h-40 object-cover" alt="">` : ''}
          <div class="p-3">
            <div class="text-xs text-slate-500 mb-1">${p.category||''}</div>
            <div class="font-semibold line-clamp-2">${p.title||''}</div>
            <div class="text-xs text-slate-400 mt-1">${new Date(p.published_at).toLocaleDateString('th-TH')}</div>
          </div>`;
        scroller.appendChild(card);
      });
      initFeaturedAutoSlide(scroller);
    }
  }

  // Latest list
  let latest = [];
  try{
    const q = await supabase.from('posts')
      .select('id,title,category,cover_url,published_at,is_featured')
      .order('published_at', { ascending:false })
      .limit(10);
    latest = q?.data || [];
  }catch{ latest = []; }

  if (listWrap){
    listWrap.innerHTML = latest.map(p => `
      <a href="#news/${p.id}" class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-400 transition bg-white">
        ${p.cover_url ? `<img src="${p.cover_url}" class="w-12 h-12 rounded-lg object-cover" alt="">` : `<div class="w-12 h-12 rounded-lg bg-slate-200"></div>`}
        <div class="min-w-0">
          <div class="font-medium truncate">${p.title||''}</div>
          <div class="text-xs text-slate-500 truncate">${new Date(p.published_at).toLocaleDateString('th-TH')}</div>
        </div>
      </a>
    `).join('');
  }
}
