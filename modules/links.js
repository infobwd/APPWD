
import { supabase } from '../api.js';

function el(html){
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function esc(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }

export async function render(){
  const host = document.getElementById('tab-links');
  if (!host) return;
  host.innerHTML = '<div class="p-4 text-slate-400">กำลังโหลดลิงก์…</div>';

  let rows = [];
  try{
    const q = await supabase
      .from('app_links')
      .select('id,title,url,image_url,category,sort_order,is_active')
      .eq('is_active', true)
      .order('category', { ascending:true })
      .order('sort_order', { ascending:true })
      .order('title', { ascending:true });
    rows = q?.data || [];
  }catch(e){ rows = []; }

  if (!rows.length){
    host.innerHTML = '<div class="p-4 text-slate-400">ยังไม่มีรายการลิงก์</div>';
    return;
  }

  // group by category
  const groups = {};
  rows.forEach(r => (groups[r.category || 'ทั่วไป'] ||= []).push(r));

  host.innerHTML = '';
  Object.keys(groups).sort().forEach(cat => {
    const sec = el(`<section class="mb-6">
      <h3 class="text-base font-semibold mb-2">${esc(cat)}</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" data-cat="${esc(cat)}"></div>
    </section>`);
    host.appendChild(sec);
    const grid = sec.querySelector('div.grid');
    groups[cat].forEach(r => {
      const media = r.image_url
        ? `<img src="${esc(r.image_url)}" alt="" class="w-10 h-10 object-cover rounded-lg mb-1">`
        : `<div class="w-10 h-10 rounded-lg bg-slate-200 mb-1"></div>`;
      const item = el(`<a class="block p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow transition bg-white"
                         href="${esc(r.url)}" target="_blank" rel="noopener">
          ${media}
          <div class="font-medium">${esc(r.title||'ไม่ระบุชื่อ')}</div>
        </a>`);
      grid.appendChild(item);
    });
  });
}
