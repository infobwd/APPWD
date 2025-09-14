
import { supabase } from '../api.js';
import { toast } from '../ui.js';
import { getEnableSW, setEnableSW } from '../config.js';
import { renderAppLinksAdmin } from './applinks_admin.js';

const $id = (id) => document.getElementById(id);
const isProfileRoute = () => { const hash=(location.hash||'#').replace('#','').split('?')[0]; return hash==='profile'||hash==='tab-profile'; };
const getLineId = () => { try{ return JSON.parse(localStorage.getItem('LINE_PROFILE')||'null')?.userId||null; }catch{ return null; } };
let _roleCache=null,_roleAt=0; const ROLE_TTL=10*60*1000;
export async function isAdmin(){ if(_roleCache&&(Date.now()-_roleAt)<ROLE_TTL) return _roleCache==='admin'; const lineId=getLineId(); if(!lineId) return false; const u=await supabase.from('users').select('role').eq('line_user_id',lineId).maybeSingle(); const role=u?.data?.role||'user'; _roleCache=role; _roleAt=Date.now(); return role==='admin'; }

function mountAdvanced(){
  if(!isProfileRoute()){ $id('profile-advanced')?.remove(); return; }
  $id('profile-font-settings')?.remove(); $id('profile-theme-settings')?.remove();
  const parent = $id('adminCard')||$id('profileContent')||$id('tab-profile')||document.querySelector('[data-tab="profile"]')||document.body;
  if(!parent) return;
  let section = $id('profile-advanced');
  if(!section){ section=document.createElement('section'); section.id='profile-advanced'; section.className='mt-6'; section.innerHTML=`
    <h3 class='text-lg font-semibold'>Advanced</h3>
    <div class='mt-3 flex items-center justify-between p-4 rounded-xl border border-slate-700 bg-slate-900/40'>
      <div><div class='font-medium'>Service Worker (PWA)</div><p class='text-sm text-slate-400' id='swStatusText'>กำลังตรวจสอบ…</p></div>
      <button id='swToggleBtn' class='btn'>…</button>
    </div>`; parent.appendChild(section); }
  const btn=$id('swToggleBtn'), txt=$id('swStatusText');
  const refresh=()=>{ const on=getEnableSW(); if(btn) btn.textContent=on?'ปิด (DEV)':'เปิด (PROD)'; if(txt) txt.textContent=on?'เปิด SW: แคชเพื่อความไว (โหมด PROD)':'ปิด SW: โหลดไฟล์สดทุกครั้ง (โหมด DEV)'; };
  refresh();
  btn?.addEventListener('click', async ()=>{ const on=getEnableSW(); if(on){ setEnableSW(false); try{ if('serviceWorker'in navigator){ const regs=await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r=>r.unregister())); } if(window.caches&&caches.keys){ const keys=await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k))); } }catch{} refresh(); alert('ปิด SW แล้ว และล้างแคชเรียบร้อย\nกรุณา Reload หน้า'); location.reload(); } else { setEnableSW(true); refresh(); try{ if('serviceWorker'in navigator){ await navigator.serviceWorker.register(window.__APPWD_SW_URL__||'./sw.js?v=561'); } }catch{} alert('เปิด SW แล้ว\nกรุณา Reload หน้า'); location.reload(); } });
}

export async function render(){
  const card=$id('adminCard'); if(!card) return;
  const lineId=getLineId(); if(!lineId){ card.classList.add('hide'); return; }
  const admin=await isAdmin(); card.classList.toggle('hide', !admin); if(!admin){ $id('profile-advanced')?.remove(); return; }
  mountAdvanced();
  if(!$id('applinksAdmin')){ const panel=document.createElement('section'); panel.id='applinksAdmin'; panel.className='mt-6'; ( $id('adminCard')||$id('profileContent')||document.body ).appendChild(panel); }
  renderAppLinksAdmin('applinksAdmin').catch(()=>{});
};
window.addEventListener('hashchange', async ()=>{ const admin=await isAdmin(); if(admin) mountAdvanced(); else $id('profile-advanced')?.remove(); });
