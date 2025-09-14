
// ui.js — safe, no stray HTML outside strings


export function toast(m, type='info'){
  let host = document.getElementById('toast');
  if(!host){
    host = document.createElement('div');
    host.id = 'toast';
    document.body.appendChild(host);
  }
  // create item
  const item = document.createElement('div');
  item.className = `toast-item ${type}`;
  const msg = document.createElement('div');
  msg.className = 'toast-msg';
  msg.textContent = (m==null?'':String(m));
  const close = document.createElement('button');
  close.className = 'toast-close';
  close.textContent = '✕';
  close.onclick = ()=> item.remove();
  item.appendChild(msg); item.appendChild(close);
  host.appendChild(item);
  setTimeout(()=>{ try{ item.remove(); }catch(_){} }, 3200);
}
        
  host.style.position='fixed';
  host.style.left='50%';
  host.style.bottom='calc(16px + env(safe-area-inset-bottom, 0px))';
  host.style.transform='translateX(-50%)';
  host.style.zIndex='70';
  host.style.display='grid';
  host.style.gap='8px';
  const el = document.createElement('div');
  el.className='rounded-2xl px-3 py-2 shadow text-sm';
  el.style.border='1px solid var(--bd)';
  el.style.background = (type==='error') ? '#fee2e2' : (type==='ok' ? '#dcfce7' : 'var(--card)');
  el.style.color = 'var(--ink)';
  el.textContent = String(m||'');
  host.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .25s'; }, 2000);
  setTimeout(()=>{ if(el && el.parentNode) el.parentNode.removeChild(el); }, 2400);
}

export function openSheet(html, opts={}){
  const sheet = document.getElementById('sheet');
  const titleEl = document.getElementById('sheet-title');
  const bodyEl  = document.getElementById('sheet-body');
  const actEl   = document.getElementById('sheet-actions');
  if(!sheet||!bodyEl||!titleEl||!actEl) return;
  titleEl.textContent = opts.title || '';
  bodyEl.innerHTML = html || '';
  actEl.innerHTML  = opts.actions || '';
  sheet.classList.add('show');
  document.body.style.overflow='hidden';
  const closer = ()=> closeSheet();
  const closeBtn = document.getElementById('sheet-close');
  if(closeBtn) closeBtn.onclick = closer;
  sheet.addEventListener('click', (e)=>{ if(e.target===sheet) closer(); }, {once:true});
  window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closer(); }, {once:true});
}

export function closeSheet(){
  const sheet = document.getElementById('sheet');
  if(!sheet) return;
  sheet.classList.remove('show');
  document.body.style.overflow='';
  const bodyEl = document.getElementById('sheet-body');
  const actEl  = document.getElementById('sheet-actions');
  if(bodyEl) bodyEl.innerHTML = '';
  if(actEl) actEl.innerHTML   = '';
}

export function goto(hash){
  const current = document.querySelector('.view:not(.hide)');
  const target = document.querySelector(hash+'View');
  if(!target) return;
  if(current) current.classList.add('hide');
  target.classList.remove('hide');
  target.classList.add('slide-in');
  requestAnimationFrame(()=> target.classList.add('show'));
}

export function skel(n=3, h='56px'){
  let out = '';
  for(let i=0;i<n;i++) out += '<div class=\"skeleton\" style=\"height:'+h+'\"></div>';
  return out;
}

export function esc(s){
  s = (s==null ? '' : String(s));
  return s.replace(/&/g,'&amp;')
          .replace(/</g,'&lt;')
          .replace(/>/g,'&gt;')
          .replace(/\"/g,'&quot;')
          .replace(/'/g,'&#39;');
}

export function openPrefs(){
  const html = [
    "<div class='space-y-3 text-sm'>",
    "  <div class='font-semibold'>การแสดงผล</div>",
    "  <label>ขนาดตัวอักษร",
    "    <input id='fsRange' type='range' min='0.85' max='1.4' step='0.05' value='1' class='w-full'>",
    "  </label>",
    "  <label>ขนาดไอคอน",
    "    <input id='icRange' type='range' min='0.9' max='1.6' step='0.05' value='1' class='w-full'>",
    "  </label>",
    "  <div>ธีม",
    "    <select id='thSel' class='border rounded p-1 ml-2'>",
    "      <option value='light'>สว่าง</option>",
    "      <option value='dark'>มืด</option>",
    "      <option value='system'>ตามระบบ</option>",
    "    </select>",
    "  </div>",
    "  <div class='flex gap-2'>",
    "    <button id='okPref' class='btn btn-prim'>บันทึก</button>",
    "    <button id='cancelPref' class='btn'>ยกเลิก</button>",
    "  </div>",
    "</div>"
  ].join('');
  openSheet(html, { title:'การแสดงผล' });
  const ok = document.getElementById('okPref');
  const cancel = document.getElementById('cancelPref');
  if(ok) ok.onclick = ()=> closeSheet();
  if(cancel) cancel.onclick = closeSheet;
}


// Mobile-like confirm dialog
export async function confirmDialog({title='ยืนยันการทำรายการ', message='โปรดยืนยัน', okText='ตกลง', cancelText='ยกเลิก'}={}){
  return new Promise((resolve)=>{
    const wrap = document.createElement('div');
    wrap.className = 'app-modal';
    wrap.innerHTML = `
      <div class="sheet">
        <div class="hd">${title}</div>
        <div class="bd">${message}</div>
        <div class="ft">
          <button class="btn" id="dlgCancel">${cancelText}</button>
          <button class="btn btn-prim" id="dlgOk">${okText}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const ok = wrap.querySelector('#dlgOk');
    const cancel = wrap.querySelector('#dlgCancel');
    const done = (v)=>{ try{ wrap.remove(); }catch(_){} resolve(v); };
    ok?.addEventListener('click', ()=>done(true));
    cancel?.addEventListener('click', ()=>done(false));
    wrap.addEventListener('click', (e)=>{ if(e.target===wrap) done(false); });
  });
}

export async function alertDialog({title='แจ้งเตือน', message=''}={}){
  await confirmDialog({ title, message, okText:'รับทราบ', cancelText:'ปิด' });
}
