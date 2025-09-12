import { DEFAULT_FONT_SCALE, DEFAULT_ICON_SCALE, DEFAULT_THEME, BRAND_LOGO_URL, BRAND_TITLE } from './config.js';

// Toast
export function toast(msg){ const box=document.getElementById('toast'); if(!box) return; box.classList.remove('hide'); box.innerHTML=`<div class="rounded-xl px-3 py-2 shadow-soft bg-white border border-[#E6EAF0]">${msg}</div>`; clearTimeout(window.__toast); window.__toast=setTimeout(()=>box.classList.add('hide'), 2200); }

// Bottom Sheet
const sheet=document.getElementById('sheet'); export const body=document.getElementById('sheet-body');
export function openSheet(html){ if(!sheet||!body) return; body.innerHTML=html; sheet.classList.add('show'); }
export function closeSheet(){ if(!sheet) return; sheet.classList.remove('show'); }

// Router helpers
export function goto(hash){ const old=document.querySelector('.view:not(.hide)'); const t=document.querySelector(hash+'View'); if(!t) return; if(old){ old.classList.add('hide'); } t.classList.remove('hide'); t.classList.add('slide-in'); requestAnimationFrame(()=>t.classList.add('show')); }

// Utilities
export async function copy(text){ try{ await navigator.clipboard.writeText(text||''); toast('คัดลอกแล้ว'); }catch(e){ toast('คัดลอกไม่สำเร็จ'); } }
export function skel(n=3,h='56px'){ return Array.from({length:n}).map(()=>`<div class="skeleton" style="height:${h}"></div>`).join(''); }
export function esc(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// Branding
export function initBrand(){
  const box = document.getElementById('brandBox');
  const title = document.getElementById('brandTitle');
  if(title) title.textContent = BRAND_TITLE || 'APPWD';
  if(box && BRAND_LOGO_URL){
    box.innerHTML = `<img src="${BRAND_LOGO_URL}" alt="logo" class="w-10 h-10 object-cover rounded-xl">`;
    box.classList.remove('bg-brand','text-white','font-bold','grid','place-items-center');
  }
}

// Theme & Font
function savePref(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function loadPref(k, def){ try{ const v = JSON.parse(localStorage.getItem(k)||'null'); return v==null? def : v; }catch(e){ return def; } }
export function applyPrefs(){
  const fs = loadPref('fs', DEFAULT_FONT_SCALE);
  const ic = loadPref('ic', DEFAULT_ICON_SCALE);
  const th = loadPref('th', DEFAULT_THEME);
  const html = document.documentElement;
  html.style.setProperty('--fs', fs);
  html.style.setProperty('--icon', ic);
  let theme = th;
  if(th==='system'){ theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)? 'dark':'light'; }
  html.setAttribute('data-theme', theme);
}
export function openThemeSheet(){
  const fs = 1, ic = 1, th = 'light';
  openSheet(`<div class="space-y-3 text-sm">
    <div class="font-semibold">การแสดงผล</div>
    <div>ขนาดตัวอักษร</div>
    <div class="flex gap-2">
      <button class="btn" data-fs="0.9">เล็ก</button>
      <button class="btn" data-fs="1">ปกติ</button>
      <button class="btn" data-fs="1.1">ใหญ่</button>
    </div>
    <div class="mt-2">ขนาดไอคอน</div>
    <div class="flex gap-2">
      <button class="btn" data-ic="0.9">เล็ก</button>
      <button class="btn" data-ic="1">ปกติ</button>
      <button class="btn" data-ic="1.1">ใหญ่</button>
    </div>
    <div class="mt-2">ธีมสี</div>
    <div class="flex gap-2">
      <button class="btn" data-th="light">สว่าง</button>
      <button class="btn" data-th="dark">มืด</button>
      <button class="btn" data-th="system">ตามระบบ</button>
    </div>
    <div class="mt-3"><button id="closeSheet" class="btn">ปิด</button></div>
  </div>`);
  body.querySelectorAll('[data-fs]').forEach(b=>b.addEventListener('click',()=>{ savePref('fs', parseFloat(b.dataset.fs)); applyPrefs(); }));
  body.querySelectorAll('[data-ic]').forEach(b=>b.addEventListener('click',()=>{ savePref('ic', parseFloat(b.dataset.ic)); applyPrefs(); }));
  body.querySelectorAll('[data-th]').forEach(b=>b.addEventListener('click',()=>{ savePref('th', b.dataset.th); applyPrefs(); }));
  const c=document.getElementById('closeSheet'); if(c) c.onclick = closeSheet;
}
