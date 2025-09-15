
import { supabase } from '../api.js';
const isMobile = () => matchMedia('(max-width: 640px)').matches;

export async function renderAppsCard(targetId='homeLinks'){
  const el=document.getElementById(targetId); if(!el) return;
  el.innerHTML='<div class="text-sm text-ink3">กำลังโหลด...</div>';
  try{
    const {data,error}=await supabase
      .from('app_links')
      .select('id,title,url,image_url,category,sort_order,is_active')
      .eq('is_active', true)
      .order('sort_order',{ascending:true})
      .order('id',{ascending:true});
    if(error) throw error; const rows=data||[];
    if(!rows.length){ el.innerHTML='<div class="text-sm text-ink3">ยังไม่มีรายการ</div>'; return; }
    if(isMobile()){
      el.classList.add('mobile');
      const pages = chunk(rows,8);
      const slides = pages.map(p=>`<div class="tiles-slide"><div class="app-tiles">${p.map(tile).join('')}</div></div>`).join('');
      const dots = pages.map((_,i)=>`<span class="dot ${i===0?'active':''}"></span>`).join('');
      el.innerHTML = `<div class="section-hd">
          <div class="title"></div>
          <a class="more" data-nav="#links">ดูทั้งหมด</a>
        </div>
        <div class="tiles-slider">${slides}</div>
        <div class="dots">${dots}</div>
        <div class="links-more"><a class="btn btn-prim" href="https://infobwd.github.io/APPWD/#links">ดูแอปทั้งหมด</a></div>`;
      const slider=el.querySelector('.tiles-slider'); const dotEls=Array.from(el.querySelectorAll('.dot'));
      slider?.addEventListener('scroll',()=>{ const idx=Math.round(slider.scrollLeft/slider.clientWidth); dotEls.forEach((d,i)=>d.classList.toggle('active',i===idx)); },{passive:true});
    }else{
      el.classList.remove('mobile');
      const groups=groupBy(rows,r=>r.category||'อื่น ๆ'); const order=Object.keys(groups).sort((a,b)=>a.localeCompare(b,'th'));
      const html = order.map(cat=>{
        const grid=groups[cat].map(itemRow).join('');
        return `<div class="cat-group">
          <div class="section-hd">
            <div class="title">${escapeHtml(cat)}</div>
            <a class="more" data-nav="#links">ดูทั้งหมด</a>
          </div>
          <div class="links-grid">${grid}</div>
        </div>`;
      }).join('');
      el.innerHTML = html;
    }
  }catch(e){ el.innerHTML='<div class="text-sm text-red-600">โหลดลิงก์ไม่สำเร็จ</div>'; }
}
function groupBy(arr,keyFn){const map={}; for(const it of arr){const k=keyFn(it); (map[k]||(map[k]=[])).push(it);} return map;}
function chunk(a,n){const r=[];for(let i=0;i<a.length;i+=n)r.push(a.slice(i,i+n));return r;}
function tile(r){const img=r.image_url||'./icons/icon-192.png';const title=escapeHtml(r.title||'รายการ');return `<a class="tile" href="${r.url}" target="_blank" rel="noopener"><img class="icon" src="${img}" alt="icon"><div class="label">${title}</div></a>`;}
function itemRow(r){const img=r.image_url||'./icons/icon-192.png';const cat=r.category?`<div class="cat">${escapeHtml(r.category)}</div>`:'';return `<a class="link-item" href="${r.url}" target="_blank" rel="noopener"><img src="${img}" alt="icon"><div class="meta"><div class="title">${escapeHtml(r.title||'รายการ')}</div>${cat}</div></a>`;}
function escapeHtml(s=''){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c));}
document.addEventListener('DOMContentLoaded',()=>{ if(document.getElementById('homeLinks')) renderAppsCard('homeLinks'); });
