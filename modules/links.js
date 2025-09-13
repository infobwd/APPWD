
import { supabase } from '../api.js';

function el(html){
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function iconFor(x){
  return x.icon || '🔗';
}
function sanitize(str){
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

export async function render(){
  const host = document.getElementById('tab-links');
  if (!host) return;
  host.innerHTML = '<div class="p-4 text-slate-400">กำลังโหลดลิงก์…</div>';

  let rows = [];
  try{
    const q = await supabase.from('links').select('id,title,url,category,description,icon,active,ord').order('ord', { ascending:true }).order('title', { ascending:true });
    rows = (q?.data || []).filter(r => r.active !== false);
  }catch(e){
    // fallback: try settings.APPS or localStorage
    try{
      const cfg = await supabase.from('settings').select('value').eq('key','LINKS_LIST').maybeSingle();
      rows = JSON.parse(cfg?.data?.value || '[]');
    }catch{ rows = []; }
  }

  if (!rows.length){
    host.innerHTML = '<div class="p-4 text-slate-400">ยังไม่มีรายการลิงก์</div>';
    return;
  }

  // group by category
  const groups = {};
  rows.forEach(r => {
    const k = r.category || 'ทั่วไป';
    (groups[k] ||= []).push(r);
  });

  host.innerHTML = '';
  Object.keys(groups).sort().forEach(cat => {
    const sec = el(`<section class="mb-6">
      <h3 class="text-base font-semibold mb-2">${sanitize(cat)}</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" data-cat="${sanitize(cat)}"></div>
    </section>`);
    host.appendChild(sec);
    const grid = sec.querySelector('div.grid');
    groups[cat].forEach(r => {
      const item = el(`<a class="block p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow transition bg-white"
                         href="${sanitize(r.url)}" target="_blank" rel="noopener">
          <div class="text-2xl mb-1">${sanitize(iconFor(r))}</div>
          <div class="font-medium">${sanitize(r.title||'ไม่ระบุชื่อ')}</div>
          ${r.description ? `<div class="text-xs text-slate-500 mt-0.5">${sanitize(r.description)}</div>` : ''}
        </a>`);
      grid.appendChild(item);
    });
  });
}
