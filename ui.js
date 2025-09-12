
import { DEFAULT_FONT_SCALE,DEFAULT_ICON_SCALE,DEFAULT_THEME,BRAND_LOGO_URL,BRAND_TITLE } from './config.js';
export function toast(m){const b=document.getElementById('toast');if(!b)return;b.classList.remove('hide');b.innerHTML=`<div class="rounded-xl px-3 py-2 shadow-soft bg-white border border-[#E6EAF0]">${m}</div>`;clearTimeout(window.__t);window.__t=setTimeout(()=>b.classList.add('hide'),2200);}
const sheet=document.getElementById('sheet'); export const body=document.getElementById('sheet-body');
export function openSheet(h){if(!sheet||!body)return;body.innerHTML=h;sheet.classList.add('show');}
export function closeSheet(){if(!sheet)return;sheet.classList.remove('show');}
export function goto(hash){const o=document.querySelector('.view:not(.hide)');const t=document.querySelector(hash+'View');if(!t)return;if(o)o.classList.add('hide');t.classList.remove('hide');t.classList.add('slide-in');requestAnimationFrame(()=>t.classList.add('show'));}
export function skel(n=3,h='56px'){return Array.from({length:n}).map(()=>`<div class="skeleton" style="height:${h}"></div>`).join('');}
export function esc(s){return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
export function initBrand(){const box=document.getElementById('brandBox');const title=document.getElementById('brandTitle');if(title)title.textContent=BRAND_TITLE||'APPWD';if(box&&BRAND_LOGO_URL){box.innerHTML=`<img src="${BRAND_LOGO_URL}" class="w-10 h-10 object-cover rounded-xl">`;box.classList.remove('bg-brand','text-white','font-bold','grid','place-items-center');}}
function load(k,d){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v;}catch(e){return d;}}
export function applyPrefs(){const fs=load('fs',DEFAULT_FONT_SCALE),ic=load('ic',DEFAULT_ICON_SCALE),th=load('th',DEFAULT_THEME);const html=document.documentElement;html.style.setProperty('--fs',fs);html.style.setProperty('--icon',ic);let theme=th;if(th==='system'){theme=(matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}html.setAttribute('data-theme',theme);}
