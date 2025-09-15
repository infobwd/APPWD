
import { supabase } from '../api.js';
const isMobile=()=>matchMedia('(max-width: 640px)').matches;
export async function render(){
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
    if (isMobile()) grid.innerHTML = `<div class="app-tiles">` + rows.map(tile).join('') + `</div>`;
    else {
      const groups = groupBy(rows, r=>r.category||'อื่น ๆ');
      grid.innerHTML = Object.keys(groups).map(cat => {
        const inner = groups[cat].map(itemRow).join('');
        return `<section class="apps-section"><div class="sect-title">${escapeHtml(cat)}</div>
          <div class="links-grid">${inner}</div></section>`;
      }).join('');
    }
  }catch(e){ grid.innerHTML='<div class="text-sm text-red-600">โหลดไม่สำเร็จ</div>'; }
}
function groupBy(arr, keyFn){ const m={}; for(const it of arr){ const k=keyFn(it); (m[k]||(m[k]=[])).push(it); } return m; }
function tile(r){const img=r.image_url||'./icons/icon-192.png';const title=escapeHtml(r.title||'รายการ');return `<a class="tile" href="${r.url}" target="_blank" rel="noopener"><img class="icon" src="${img}" alt="icon"><div class="label">${title}</div></a>`;}
function itemRow(r){const img=r.image_url||'./icons/icon-192.png';const cat=r.category?`<div class="cat">${escapeHtml(r.category)}</div>`:'';return `<a class="link-item" href="${r.url}" target="_blank" rel="noopener"><img src="${img}" alt="icon"><div class="meta"><div class="title">${escapeHtml(r.title||'รายการ')}</div>${cat}</div></a>`;}
function escapeHtml(s=''){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c));}
