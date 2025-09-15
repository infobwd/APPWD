// Minimal, safe UI helpers (re-written clean)
export function toast(m){
  const b = document.getElementById('toast');
  if(!b) return;
  b.classList.remove('hide');
  b.innerHTML = `<div class="rounded-xl px-3 py-2 shadow bg-white border" style="border-color:var(--bd);color:var(--ink)">${m}</div>`;
  clearTimeout(window.__t);
  window.__t = setTimeout(()=> b.classList.add('hide'), 2600);
}

const sheet = document.getElementById('sheet');
export const body  = document.getElementById('sheet-body');

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
  for(let i=0;i<n;i++) out += `<div class="skeleton" style="height:${h}"></div>`;
  return out;
}

export function esc(s){
  s = (s || '');
  return s
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

export function openPrefs(){
  openSheet(`<div class='space-y-3 text-sm'>
    <div class='font-semibold'>การแสดงผล</div>
    <label>ขนาดตัวอักษร
      <input id='fsRange' type='range' min='0.85' max='1.4' step='0.05' value='1' class='w-full'>
    </label>
    <label>ขนาดไอคอน
      <input id='icRange' type='range' min='0.9' max='1.6' step='0.05' value='1' class='w-full'>
    </label>
    <div>ธีม
      <select id='thSel' class='border rounded p-1 ml-2'>
        <option value='light'>สว่าง</option>
        <option value='dark'>มืด</option>
        <option value='system'>ตามระบบ</option>
      </select>
    </div>
    <div class='flex gap-2'>
      <button id='okPref' class='btn btn-prim'>บันทึก</button>
      <button id='cancelPref' class='btn'>ยกเลิก</button>
    </div>
  </div>`);
  const ok = document.getElementById('okPref');
  const cancel = document.getElementById('cancelPref');
  if(ok) ok.onclick = ()=> closeSheet();
  if(cancel) cancel.onclick = closeSheet;
}