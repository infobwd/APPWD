
import { supabase } from '../api.js';
const isMobile=()=>matchMedia('(max-width: 640px)').matches;
export async function render(){
  const grid=document.getElementById('linkGrid'); if(!grid) return;
  grid.innerHTML='<div class="text-sm text-ink3">กำลังโหลดรายการทั้งหมด...</div>';
  try{
    const {data,error}=await supabase.from('app_links').select('id,title,url,image_url,category,sort_order,is_active').order('is_active',{ascending:false}).order('sort_order',{ascending:true}).order('id',{ascending:true});
    if(error) throw error; const rows=data||[];
    if(!rows.length){ grid.innerHTML='<div class="text-sm text-ink3">ยังไม่มีรายการ</div>'; return; }
    grid.innerHTML = isMobile()
      ? `<div class="app-tiles">` + rows.map(tile).join('') + `</div>`
      : `<div class="links-grid">` + rows.map(itemRow).join('') + `</div>`;
  }catch(e){ grid.innerHTML='<div class="text-sm text-red-600">โหลดไม่สำเร็จ</div>'; }
}
function tile(r){const img=r.image_url||'./icons/icon-192.png';const title=escapeHtml(r.title||'รายการ');return `<a class="tile" href="${r.url}" target="_blank" rel="noopener"><img class="icon" src="${img}" alt="icon"><div class="label">${title}</div></a>`;}
function itemRow(r){const img=r.image_url||'./icons/icon-192.png';const cat=r.category?`<div class="cat">${escapeHtml(r.category)}</div>`:'';const badge=(r.is_active!==true)?`<span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">ปิด</span>`:'';return `<a class="link-item" href="${r.url}" target="_blank" rel="noopener"><img src="${img}" alt="icon"><div class="meta"><div class="title">${escapeHtml(r.title||'รายการ')}${badge}</div>${cat}</div></a>`;}
function escapeHtml(s=''){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c));}
