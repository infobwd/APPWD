
import { supabase } from '../api.js';
const isMobile=()=>matchMedia('(max-width: 640px)').matches;
export async function render(){
  const grid=document.getElementById('linkGrid'); if(!grid) return;
  grid.innerHTML='<div class="text-sm text-ink3">กำลังโหลดรายการทั้งหมด...</div>';
  try{
    const {data,error}=await supabase.from('app_links').select('id,title,url,image_url,category,sort_order,is_active')
      .eq('is_active',true).order('category',{ascending:true}).order('sort_order',{ascending:true}).order('id',{ascending:true});
    if(error) throw error; const rows=data||[]; if(!rows.length){ grid.innerHTML='<div class="text-sm text-ink3">ยังไม่มีรายการ</div>'; return; }
    if(isMobile()){ grid.innerHTML=`<div class="links-list">`+rows.map(itemRow).join('')+`</div>`; }
    else{ const cats=['ทั้งหมด',...Array.from(new Set(rows.map(r=>r.category||'อื่น ๆ')))]; const tabs=`<div class="cat-tabs card"><div class="row">`+cats.map((c,i)=>`<button class="cat-tab ${i===0?'active':''}" data-cat="${escAttr(c)}">${escHtml(c)}</button>`).join('')+`</div></div>`; const container=document.createElement('div'); container.innerHTML=tabs+`<div id="linksContainer"></div>`; grid.replaceWith(container); container.id='linkGrid'; const list=container.querySelector('#linksContainer'); function renderList(cat){ const filtered=(cat==='ทั้งหมด')?rows:rows.filter(r=>(r.category||'อื่น ๆ')===cat); list.innerHTML=`<div class="links-grid">`+filtered.map(itemRow).join('')+`</div>`; } renderList('ทั้งหมด'); const tabEls=Array.from(container.querySelectorAll('.cat-tab')); tabEls.forEach(btn=>btn.addEventListener('click',()=>{ tabEls.forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderList(btn.dataset.cat);})); }
  }catch(e){ grid.innerHTML='<div class="text-sm text-red-600">โหลดไม่สำเร็จ</div>'; }
}
function itemRow(r){const img=r.image_url||'./icons/icon-192.png'; const cat=r.category?`<div class="cat">${escHtml(r.category)}</div>`:''; return `<a class="link-item" href="${r.url}" target="_blank" rel="noopener"><img src="${img}" alt="icon"><div class="meta"><div class="title">${escHtml(r.title||'รายการ')}</div>${cat}</div></a>`;}
function escHtml(s=''){ const map={ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }; return String(s).replace(/[&<>\"']/g,ch=>map[ch]); }
function escAttr(s=''){ return escHtml(s).replace(/\"/g,'&quot;'); }
