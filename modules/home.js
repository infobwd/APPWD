import { supabase } from '../api.js';

function h(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
function esc(s){ s=(s==null?'':String(s)); return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function favicon(u){
  try{ const x = new URL(u); return `https://www.google.com/s2/favicons?domain=${x.hostname}&sz=64`; }
  catch(_){ return ''; }
}

async function loadFeaturedApps(limit=8){
  try{
    const q = await supabase
      .from('app_links')
      .select('id,title,url,category,image_url,is_active,sort_order')
      .eq('is_active', true)
      .order('sort_order', {ascending:true})
      .order('title', {ascending:true})
      .limit(limit);
    return q?.data || [];
  }catch(_){ return []; }
}

export async function renderAppsCard(containerId='homeLinks'){
  const host = document.getElementById(containerId);
  if(!host) return;
  if (host.getAttribute('data-rendered')==='1') return; host.setAttribute('data-rendered','1');

  host.innerHTML = `<div class="appwd-skel appwd-skel-row"></div>`;

  const apps = await loadFeaturedApps(16);
  if(!apps.length){
    host.innerHTML = `<div class="text-ink3 px-4 py-2">ยังไม่มีรายการ</div>`;
    return;
  }

  // Wrapper: mobile = horizontal slider, md+ = grid
  const wrap = h(`
    <div class="apps-wrap">
      <div class="apps-slider md:hidden" id="appsSlider" role="list">
      </div>
      <div class="apps-grid hidden md:grid" id="appsGrid" role="list">
      </div>
    </div>
  `);
  host.innerHTML='';
  host.appendChild(wrap);

  const slider = wrap.querySelector('#appsSlider');
  const grid   = wrap.querySelector('#appsGrid');

  apps.forEach(a=>{
    const img = a.image_url || favicon(a.url);
    const card = h(`
      <a role="listitem" class="app-card" href="${esc(a.url)}" target="_blank" rel="noopener">
        <div class="app-card-body">
          ${img?`<img src="${esc(img)}" alt="" class="app-icon">`:`<div class="app-icon app-icon--ph">🟦</div>`}
          <div class="app-meta">
            <div class="app-title" title="${esc(a.title)}">${esc(a.title)}</div>
            ${a.category?`<div class="app-cat">${esc(a.category)}</div>`:''}
          </div>
        </div>
      </a>
    `);
    // mobile slider item
    const slideItem = card.cloneNode(true);
    slideItem.classList.add('app-card--slide');
    slider.appendChild(slideItem);
    // desktop grid item
    grid.appendChild(card);
  });
}
