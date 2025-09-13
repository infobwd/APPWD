
export function toast(m, type='info'){
  let host = document.getElementById('toast');
  if(!host){ host=document.createElement('div'); host.id='toast'; document.body.appendChild(host); }
  Object.assign(host.style, {position:'fixed',left:'50%',bottom:'calc(16px + env(safe-area-inset-bottom,0px))',transform:'translateX(-50%)',zIndex:'70',display:'grid',gap:'8px'});
  const el=document.createElement('div'); el.className='rounded-2xl px-3 py-2 shadow text-sm'; el.style.border='1px solid var(--bd)';
  el.style.background=(type==='error')?'#fee2e2':(type==='ok'?'#dcfce7':'var(--card)'); el.style.color='var(--ink)'; el.textContent=String(m||'');
  host.appendChild(el); setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .25s'; },2000); setTimeout(()=>{ el.remove(); },2400);
}
export function openSheet(html, opts={}){
  const sheet=document.getElementById('sheet'), titleEl=document.getElementById('sheet-title'), bodyEl=document.getElementById('sheet-body'), actEl=document.getElementById('sheet-actions');
  if(!sheet||!bodyEl||!titleEl||!actEl) return;
  titleEl.textContent=opts.title||''; bodyEl.innerHTML=html||''; actEl.innerHTML=opts.actions||'';
  sheet.classList.add('show'); document.body.style.overflow='hidden';
  const closer=()=>closeSheet(); const btn=document.getElementById('sheet-close'); if(btn) btn.onclick=closer;
  sheet.addEventListener('click', e=>{ if(e.target===sheet) closer(); }, {once:true});
  window.addEventListener('keydown', e=>{ if(e.key==='Escape') closer(); }, {once:true});
}
export function closeSheet(){ const s=document.getElementById('sheet'); if(!s) return; s.classList.remove('show'); document.body.style.overflow=''; const b=document.getElementById('sheet-body'), a=document.getElementById('sheet-actions'); if(b) b.innerHTML=''; if(a) a.innerHTML=''; }
export function goto(hash){ const cur=document.querySelector('.view:not(.hide)'), tar=document.querySelector(hash+'View'); if(!tar) return; if(cur) cur.classList.add('hide'); tar.classList.remove('hide'); tar.classList.add('slide-in'); requestAnimationFrame(()=>tar.classList.add('show')); }
export function skel(n=3,h='56px'){ let out=''; for(let i=0;i<n;i++) out+=`<div class="skeleton" style="height:${h}"></div>`; return out; }
export function esc(s){ s=(s==null?'':String(s)); return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;'); }
export function openPrefs(){
  const html=[
    "<div class='space-y-3 text-sm'>",
    "  <div class='font-semibold'>การแสดงผล</div>",
    "  <label>ขนาดตัวอักษร <input id='fsRange' type='range' min='0.85' max='1.4' step='0.05' value='1' class='w-full'></label>",
    "  <label>ขนาดไอคอน <input id='icRange' type='range' min='0.9' max='1.6' step='0.05' value='1' class='w-full'></label>",
    "  <div>ธีม <select id='thSel' class='border rounded p-1 ml-2'><option value='light'>สว่าง</option><option value='dark'>มืด</option><option value='system'>ตามระบบ</option></select></div>",
    "  <div class='flex gap-2'><button id='savePrefs' class='btn btn-prim'>บันทึก</button><button id='cancelPref' class='btn'>ยกเลิก</button></div>",
    "</div>"
  ].join('');
  openSheet(html,{title:'การแสดงผล'}); const cancel=document.getElementById('cancelPref'); if(cancel) cancel.onclick=closeSheet;
}
