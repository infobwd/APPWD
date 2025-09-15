
import { supabase } from '../api.js';
const isMobile = () => matchMedia('(max-width: 640px)').matches;

export async function renderAppsCard(targetId='homeLinks'){
  const el = document.getElementById(targetId); if (!el) return;
  el.innerHTML = '<div class="text-sm text-ink3">กำลังโหลด...</div>';
  try{
    const { data, error } = await supabase.from('app_links')
      .select('id,title,url,image_url,category,sort_order,is_active')
      .eq('is_active', true)
      .order('category', { ascending:true })
      .order('sort_order', { ascending:true })
      .order('id', { ascending:true });
    if (error) throw error;
    const rows = data || [];
    if (!rows.length){
      el.innerHTML = '<div class="text-sm text-ink3">ยังไม่มีรายการ</div>';
      return;
    }

    const moreBtn = `<div class="apps-head">
      <a class="text-brand text-sm cursor-pointer btn-inline" href="https://infobwd.github.io/APPWD/#links">ดูทั้งหมด</a>
    </div>`;

    
if (isMobile()) {
      el.classList.add('mobile');
      const pages = chunk(rows,8);
      const slides = pages.map(p=>`<div class="tiles-slide"><div class="app-tiles">${p.map(tile).join('')}</div></div>`).join('');
      const dots = pages.map((_,i)=>`<span class="dot ${i===0?'active':''}"></span>`).join('');
      el.innerHTML = `${moreBtn}<div class="tiles-slider">${slides}</div><div class="dots">${dots}</div>`;
      const slider=el.querySelector('.tiles-slider'); const dotEls=Array.from(el.querySelectorAll('.dot'));
      slider?.addEventListener('scroll',()=>{ const idx=Math.round(slider.scrollLeft/slider.clientWidth); dotEls.forEach((d,i)=>d.classList.toggle('active',i===idx)); },{passive:true});
    } else {
      el.classList.remove('mobile');
      // Desktop: simple 3-column grid (no filters)
      el.innerHTML = `<div class="links-grid home-3cols">` + rows.map(itemRow).join('') + `</div>`;
    }
  }catch
(e){
    el.innerHTML = '<div class="text-sm text-red-600">โหลดลิงก์ไม่สำเร็จ</div>';
  }
}

function chunk(arr, size){ const out=[]; for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out; }
function tile(r){
  const img = r.image_url || './icons/icon-192.png';
  const title = escHtml(r.title || 'รายการ');
  return `<a class="tile" href="${r.url}" target="_blank" rel="noopener">
    <img class="icon" src="${img}" alt="icon">
    <div class="label">${title}</div>
  </a>`;
}
function itemRow(r){
  const img = r.image_url || './icons/icon-192.png';
  const cat = r.category ? `<div class="cat">${escHtml(r.category)}</div>` : '';
  return `<a class="link-item" href="${r.url}" target="_blank" rel="noopener">
    <img src="${img}" alt="icon">
    <div class="meta">
      <div class="title">${escHtml(r.title || 'รายการ')}</div>
      ${cat}
    </div>
  </a>`;
}
function escHtml(s=''){ 
  const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'": '&#39;' };
  return String(s).replace(/[&<>"']/g, ch => map[ch]);
}
function escAttr(s=''){ return escHtml(s).replace(/"/g,'&quot;'); }


document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('homeLinks')) renderAppsCard('homeLinks');
});
