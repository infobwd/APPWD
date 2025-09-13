
// === Apps/Systems in school card ===
import { supabase } from '../api.js';

function mk(html){
  const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild;
}
function safe(s){ const d=document.createElement('div'); d.textContent = s||''; return d.innerHTML; }
async function loadAppsList(){
  // priority: table 'apps' → settings.APPS_LIST → []
  try{
    const q = await supabase.from('apps').select('id,title,url,icon,ord,active,category,desc').order('ord',{ascending:true});
    const rows = (q?.data||[]).filter(r => r.active !== false);
    if (rows.length) return rows.map(r => ({ title:r.title, url:r.url, icon:r.icon||'🟦', desc:r.desc||'', category:r.category||'' }));
  }catch{}
  try{
    const s = await supabase.from('settings').select('value').eq('key','APPS_LIST').maybeSingle();
    const arr = JSON.parse(s?.data?.value || '[]');
    return arr;
  }catch{}
  return [];
}

export async function renderAppsCard(containerId='homeAppsCard'){
  const host = document.getElementById(containerId);
  if (!host) return;
  host.innerHTML = `<div class="p-4 text-slate-400">กำลังโหลดรายการ…</div>`;
  const apps = await loadAppsList();
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
    const el = mk(`<a class="block p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow transition bg-white"
                     href="${safe(a.url)}" target="_blank" rel="noopener">
        <div class="text-2xl mb-1">${safe(a.icon||'🟦')}</div>
        <div class="font-medium">${safe(a.title||'ไม่ระบุชื่อ')}</div>
        ${a.desc ? `<div class="text-xs text-slate-500 mt-0.5">${safe(a.desc)}</div>` : ''}
      </a>`);
    grid.appendChild(el);
  });
}
