
import { supabase } from '../api.js';

const PAGE_SIZE = 24;
let state = { page: 0, total: 0, rows: [] };

const esc = (s)=>{ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; };
const tpl = (html)=>{ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; };
const favicon=(url)=>{ try{ const u=new URL(url); return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`; }catch{ return ''; } };

async function fetchPage(page=0){
  const from = page*PAGE_SIZE;
  const to   = from + PAGE_SIZE - 1;
  const { data, error, count } = await supabase
    .from('app_links')
    .select('id,title,url,image_url,category,sort_order,is_active', { count: 'exact' })
    .order('category', { ascending:true })
    .order('sort_order', { ascending:true })
    .order('title', { ascending:true })
    .range(from, to);
  if (error) throw error;
  state.page = page;
  state.total = count || 0;
  state.rows = data || [];
  return state;
}

function renderList(host){
  host.innerHTML = '';
  if (!state.rows.length){
    host.innerHTML = '<div class="p-4 text-slate-400">ยังไม่มีรายการลิงก์</div>';
    return;
  }
  // group by category
  const groups = {};
  state.rows.forEach(r => { const k=r.category||'ทั่วไป'; (groups[k] ||= []).push(r); });

  Object.keys(groups).sort().forEach(cat => {
    const sec = tpl(`<section class="mb-6">
      <h3 class="text-base font-semibold mb-2">${esc(cat)}</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" data-cat="${esc(cat)}"></div>
    </section>`);
    host.appendChild(sec);
    const grid = sec.querySelector('div.grid');
    groups[cat].forEach(r => {
      if (r.is_active === false) return;
      const img = r.image_url || favicon(r.url);
      const card = tpl(`<a class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow transition bg-white"
                         href="${esc(r.url)}" target="_blank" rel="noopener">
          ${img ? `<img src="${esc(img)}" alt="" class="w-10 h-10 rounded-lg object-cover">` : `<div class="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500">🔗</div>`}
          <div class="min-w-0">
            <div class="font-medium truncate">${esc(r.title||'ไม่ระบุชื่อ')}</div>
            <div class="text-xs text-slate-500 truncate">${esc(r.url)}</div>
          </div>
        </a>`);
      grid.appendChild(card);
    });
  });

  // pager
  const pages = Math.ceil((state.total||0)/PAGE_SIZE);
  if (pages > 1){
    const pager = tpl(`<div class="pager">
      <span class="info">หน้า ${state.page+1}/${pages} • ทั้งหมด ${state.total} รายการ</span>
      <button class="btn" id="pgPrev" ${state.page<=0?'disabled':''}>ก่อนหน้า</button>
      <button class="btn" id="pgNext" ${state.page>=pages-1?'disabled':''}>ถัดไป</button>
    </div>`);
    host.appendChild(pager);
    pager.querySelector('#pgPrev').onclick = () => renderTo(host, state.page-1);
    pager.querySelector('#pgNext').onclick = () => renderTo(host, state.page+1);
  }
}

export async function render(){
  const host = document.getElementById('tab-links');
  if (!host) return;
  host.classList.remove('hidden');
  host.innerHTML = '<div class="p-4 text-slate-400">กำลังโหลดลิงก์…</div>';
  await fetchPage(0);
  renderList(host);
}

window.addEventListener('APP_LINKS_CHANGED', () => {
  const host = document.getElementById('tab-links');
  if (host && !host.classList.contains('hidden')) {
    render().catch(()=>{});
  }
});

async function renderTo(host, page){
  host.innerHTML = '<div class="p-4 text-slate-400">กำลังโหลดลิงก์…</div>';
  await fetchPage(Math.max(0,page));
  renderList(host);
}
