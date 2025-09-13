
import { supabase } from '../api.js';

function el(html){
  const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild;
}
function esc(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }

async function loadHomeApps(){
  try{
    const q1 = await supabase
      .from('app_links')
      .select('id,title,url,image_url,category,sort_order,is_active')
      .eq('is_active', true)
      .eq('category', 'แอป/ระบบในโรงเรียน')
      .order('sort_order', { ascending:true })
      .order('title', { ascending:true });
    const r1 = q1?.data || [];
    if (r1.length) return r1;
  }catch{}
  try{
    const q2 = await supabase
      .from('app_links')
      .select('id,title,url,image_url,category,sort_order,is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending:true })
      .order('title', { ascending:true })
      .limit(8);
    return q2?.data || [];
  }catch{ return []; }
}

export async function renderAppsCard(containerId='homeAppsCard'){
  const host = document.getElementById(containerId);
  if (!host) return;
  host.innerHTML = `<div class="p-4 text-slate-400">กำลังโหลดรายการ…</div>`;

  const apps = await loadHomeApps();
  if (!apps.length){
    host.innerHTML = `<div class="p-4 text-slate-400">ยังไม่มีรายการแอป/ระบบ</div>`;
    return;
  }

  host.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-base font-semibold">แอป/ระบบในโรงเรียน</h3>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" id="appsGrid"></div>`;

  const grid = host.querySelector('#appsGrid');
  apps.forEach(a => {
    const media = a.image_url
      ? `<img src="${esc(a.image_url)}" alt="" class="w-10 h-10 object-cover rounded-lg mb-1">`
      : `<div class="w-10 h-10 rounded-lg bg-slate-200 mb-1"></div>`;
    const card = el(`<a class="block p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow transition bg-white"
                        href="${esc(a.url)}" target="_blank" rel="noopener">
        ${media}
        <div class="font-medium">${esc(a.title||'ไม่ระบุชื่อ')}</div>
      </a>`);
    grid.appendChild(card);
  });
}
