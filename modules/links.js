
import { supabase } from '../api.js';

const isMobile=()=>matchMedia('(max-width: 640px)').matches;

export async function render(){
  const root=document.getElementById('linksView');
  const grid=document.getElementById('linkGrid'); if(!grid) return;
  grid.innerHTML='<div class="text-sm text-ink3">กำลังโหลดรายการทั้งหมด...</div>';
  try{
    const {data,error}=await supabase.from('app_links')
      .select('id,title,url,image_url,category,sort_order,is_active')
      .eq('is_active', true)
      .order('category',{ascending:true})
      .order('sort_order',{ascending:true})
      .order('id',{ascending:true});
    if(error) throw error; const rows=data||[];
    if(!rows.length){ grid.innerHTML='<div class="text-sm text-ink3">ยังไม่มีรายการ</div>'; return; }

    if (isMobile()) {
      // Mobile: Tiles 4x2 slider + "ดูทั้งหมด" (self link)
      const pages = chunk(rows, 8);
      const slides = pages.map(p => `<div class="tiles-slide"><div class="app-tiles">${p.map(tile).join('')}</div></div>`).join('');
      const dots = pages.map((_,i)=>`<span class="dot ${i===0?'active':''}"></span>`).join('');
      grid.innerHTML = `<div class="apps-head">
        <a class="text-brand text-sm cursor-pointer btn-inline" href="https://infobwd.github.io/APPWD/#links">ดูทั้งหมด</a>
      </div>
      <div class="tiles-slider">${slides}</div><div class="dots">${dots}</div>`;
      const slider=grid.querySelector('.tiles-slider'); const dotEls=Array.from(grid.querySelectorAll('.dot'));
      slider?.addEventListener('scroll',()=>{ const idx=Math.round(slider.scrollLeft/slider.clientWidth); dotEls.forEach((d,i)=>d.classList.toggle('active',i===idx)); },{passive:true});
    } else {
      // Desktop: Big tabs per category; default = 'ทั้งหมด'
      const cats = ['ทั้งหมด', ...Array.from(new Set(rows.map(r=>r.category||'อื่น ๆ')))];
      // Render tabs
      const tabs = `<div class="cat-tabs card"><div class="row">` + cats.map((c,i)=>`<button class="cat-tab ${i===0?'active':''}" data-cat="${escAttr(c)}">${escHtml(c)}</button>`).join('') + `</div></div>`;
      const container = document.createElement('div');
      container.innerHTML = tabs + `<div id="linksContainer"></div>`;
      grid.replaceWith(container);
      container.id = 'linkGrid';

      const listContainer = container.querySelector('#linksContainer');
      function renderList(cat){
        const filtered = (cat==='ทั้งหมด') ? rows : rows.filter(r => (r.category||'อื่น ๆ') === cat);
        listContainer.innerHTML = `<div class="links-grid">` + filtered.map(itemRow).join('') + `</div>`;
      }
      renderList('ทั้งหมด');

      // Tab click
      const tabEls = Array.from(container.querySelectorAll('.cat-tab'));
      tabEls.forEach(btn => btn.addEventListener('click', () => {
        tabEls.forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        renderList(btn.dataset.cat);
      }));
    }
  }catch(e){
    grid.innerHTML='<div class="text-sm text-red-600">โหลดไม่สำเร็จ</div>';
  }
}

function chunk(arr, size){ const out=[]; for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out; }
function tile(r){
  const img=r.image_url||'./icons/icon-192.png'; const title=escHtml(r.title||'รายการ');
  return `<a class="tile" href="${r.url}" target="_blank" rel="noopener">
    <img class="icon" src="${img}" alt="icon">
    <div class="label">${title}</div>
  </a>`;
}
function itemRow(r){
  const img=r.image_url||'./icons/icon-192.png';
  const cat=r.category?`<div class="cat">${escHtml(r.category)}</div>`:'';
  return `<a class="link-item" href="${r.url}" target="_blank" rel="noopener">
    <img src="${img}" alt="icon">
    <div class="meta">
      <div class="title">${escHtml(r.title||'รายการ')}</div>
      ${cat}
    </div>
  </a>`;
}
function escHtml(s=''){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c));}
function escAttr(s=''){return escHtml(s).replace(/"/g,'&quot;');}
