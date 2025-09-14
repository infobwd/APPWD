
import { supabase } from '../api.js';
function mk(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
function safe(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function favicon(url){ try{ const u=new URL(url); return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`; }catch{ return ''; } }
async function loadFeaturedApps(limit=8){
  try{
    const q = await supabase.from('app_links').select('id,title,url,image_url,category,sort_order,is_active').eq('is_active',true).order('sort_order',{ascending:true}).order('title',{ascending:true}).limit(limit);
    return q?.data||[];
  }catch{ return []; }
}
export async function renderAppsCard(containerId='homeLinks'){
  const host = document.getElementById(containerId); if(!host) return;
  if (host.getAttribute('data-rendered')==='1') return; host.setAttribute('data-rendered','1');
  host.innerHTML = `<div class="p-4 text-slate-400">กำลังโหลดรายการ…</div>`;
  const apps = await loadFeaturedApps(8);
  if(!apps.length){ host.innerHTML = `<div class="p-4 text-slate-400">ยังไม่มีรายการแอป/ระบบ</div>`; return; }
  host.innerHTML = `<div class="flex items-center justify-between mb-2"><h3 class="text-base font-semibold">แอป/ระบบในโรงเรียน</h3></div><div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" id="appsGrid"></div>`;
  const grid = host.querySelector('#appsGrid');
  apps.forEach(a=>{
    const img = a.image_url || favicon(a.url);
    const el = mk(`<a class="block p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow transition bg-white" href="${safe(a.url)}" target="_blank" rel="noopener">
      <div class="flex items-center gap-3">
        ${img?`<img src="${safe(img)}" class="w-10 h-10 rounded-lg object-cover" alt="">`:`<div class="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500">🟦</div>`}
        <div class="min-w-0"><div class="font-medium truncate">${safe(a.title||'ไม่ระบุชื่อ')}</div>${a.category?`<div class="text-xs text-slate-500 truncate">${safe(a.category)}</div>`:''}</div>
      </div>
    </a>`);
    grid.appendChild(el);
  });
}
window.addEventListener('APP_LINKS_CHANGED', () => {
  const host = document.getElementById('homeLinks');
  if (host) { host.removeAttribute('data-rendered'); import('./home.js').then(m=>m.renderAppsCard('homeLinks')); }
});
