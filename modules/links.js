
import { supabase } from '../api.js';

const PAGE_SIZE = 24;
let currentPage = 1;

function el(html){
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function esc(str){
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
function favicon(url){
  try { const u = new URL(url); return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`; }
  catch { return ''; }
}

async function fetchPage(page=1){
  const from = (page-1)*PAGE_SIZE;
  const to   = from + PAGE_SIZE - 1;
  const { data, count, error } = await supabase
    .from('app_links')
    .select('id,title,url,image_url,category,sort_order,is_active', { count: 'exact' })
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })
    .range(from, to);
  if (error) throw error;
  return { rows: data || [], total: count || 0 };
}

function paginator(total, pageSize, page){
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const wrap = el(`<div class="mt-4 flex items-center justify-between gap-2">
    <button class="btn btn-outline btn-sm" data-prev>&laquo; ก่อนหน้า</button>
    <div class="text-sm text-slate-600">หน้า ${page} / ${totalPages}</div>
    <button class="btn btn-outline btn-sm" data-next>ถัดไป &raquo;</button>
  </div>`);
  wrap.querySelector('[data-prev]').disabled = page <= 1;
  wrap.querySelector('[data-next]').disabled = page >= totalPages;
  return { el: wrap, totalPages };
}

export async function render(){
  const host = document.getElementById('tab-links');
  if (!host) return;
  host.classList.remove('hidden'); // ensure visible
  host.innerHTML = '<div class="p-4 text-slate-400">กำลังโหลดลิงก์…</div>';

  try{
    const { rows, total } = await fetchPage(currentPage);

    if (!rows.length){
      host.innerHTML = '<div class="p-4 text-slate-400">ยังไม่มีรายการลิงก์</div>';
      return;
    }

    host.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-base font-semibold">ลิงก์ทั้งหมด</h3>
        <div class="text-sm text-slate-500">ทั้งหมด ${total} รายการ</div>
      </div>
      <div id="linksGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"></div>
      <div id="linksPager"></div>`;

    const grid = host.querySelector('#linksGrid');
    rows.forEach(r => {
      const img = r.image_url || favicon(r.url);
      const card = el(`<a class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow transition bg-white"
                         href="${esc(r.url)}" target="_blank" rel="noopener">
        ${img ? `<img src="${esc(img)}" alt="" class="w-10 h-10 rounded-lg object-cover">` : `<div class="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500">🔗</div>`}
        <div class="min-w-0">
          <div class="font-medium truncate">${esc(r.title || 'ไม่ระบุชื่อ')}</div>
          <div class="text-xs text-slate-500 truncate">${esc(r.category || 'ทั่วไป')}</div>
        </div>
      </a>`);
      grid.appendChild(card);
    });

    const pagerHost = host.querySelector('#linksPager');
    const { el: pagerEl, totalPages } = paginator(total, PAGE_SIZE, currentPage);
    pagerHost.replaceChildren(pagerEl);
    pagerEl.querySelector('[data-prev]').addEventListener('click', () => {
      if (currentPage > 1){ currentPage--; render(); }
    });
    pagerEl.querySelector('[data-next]').addEventListener('click', () => {
      if (currentPage < totalPages){ currentPage++; render(); }
    });

  }catch(e){
    host.innerHTML = `<div class="p-4 text-red-600">โหลดข้อมูลไม่สำเร็จ</div>`;
  }
}
