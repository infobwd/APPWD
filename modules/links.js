
// Links tab — grouped by category from app_links
import { supabase } from '../api.js';
function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
function esc(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function favicon(url){ try{ const u=new URL(url); return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`; }catch{ return ''; } }
export async function render(){
  const host = document.getElementById('tab-links'); if(!host) return;
  host.innerHTML = '<div class="p-4 text-slate-400">กำลังโหลดลิงก์…</div>';
  let rows=[];
  try{
    const q = await supabase.from('app_links').select('id,title,url,image_url,category,sort_order,is_active').order('category',{ascending:true}).order('sort_order',{ascending:true}).order('title',{ascending:true});
    rows = (q?.data||[]).filter(r=>r.is_active!==false);
  }catch{ rows=[]; }
  if(!rows.length){ host.innerHTML='<div class="p-4 text-slate-400">ยังไม่มีรายการลิงก์</div>'; return; }
  const groups={}; rows.forEach(r=>{ const k=r.category||'ทั่วไป'; (groups[k]??=[]).push(r); });
  host.innerHTML='';
  Object.keys(groups).sort().forEach(cat=>{
    const sec = el(`<section class="mb-6"><h3 class="text-base font-semibold mb-2">${esc(cat)}</h3><div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"></div></section>`);
    host.appendChild(sec);
    const grid = sec.querySelector('div.grid');
    groups[cat].forEach(r=>{
      const img = r.image_url || favicon(r.url);
      const card = el(`<a class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow transition bg-white" href="${esc(r.url)}" target="_blank" rel="noopener">
        ${img?`<img src="${esc(img)}" alt="" class="w-10 h-10 rounded-lg object-cover">`:`<div class="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500">🔗</div>`}
        <div class="min-w-0"><div class="font-medium truncate">${esc(r.title||'ไม่ระบุชื่อ')}</div><div class="text-xs text-slate-500 truncate">${esc(r.url)}</div></div>
      </a>`);
      grid.appendChild(card);
    });
  });
}
