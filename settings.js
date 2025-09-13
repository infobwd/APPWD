import { supabase } from './api.js';

export async function loadSettings(){
  const resp = await supabase.from('settings').select('key,value');
  const rows = resp.data||[]; const obj = {}; rows.forEach(r=>{ try{obj[r.key]=JSON.parse(r.value)}catch{obj[r.key]=r.value} });
  try{ localStorage.setItem('APPWD_SETTINGS', JSON.stringify(obj||{})); }catch(e){} document.dispatchEvent(new CustomEvent('appwd:settingsLoaded',{detail:obj}));
}
document.addEventListener('DOMContentLoaded', loadSettings);
function applyLocalSettings(){
  try{
    const obj = JSON.parse(localStorage.getItem('APPWD_SETTINGS')||'{}');
    const root = document.documentElement, body = document.body;
    const fs = parseFloat(obj.FONT_SCALE || 1), ic = parseFloat(obj.ICON_SCALE || 1);
    const theme = obj.THEME || 'light';
    root.style.setProperty('--fs-base', (fs||1));
    root.style.setProperty('--ic-scale', (ic||1));
    if(theme==='system') body.removeAttribute('data-theme'); else body.setAttribute('data-theme', theme);
    if(obj.BRAND_TITLE){ const el = document.getElementById('brandTitle'); if(el) el.textContent = obj.BRAND_TITLE; }
  }catch(_){}
}
document.addEventListener('appwd:settingsLoaded', applyLocalSettings);
document.addEventListener('appwd:settingsSaved', applyLocalSettings);
window.addEventListener('DOMContentLoaded', applyLocalSettings);

export function wireProfileSettings(){
  const $ = (id)=>document.getElementById(id);
  const fs = $('fsRange')  || $('prefFont')  || document.querySelector('[data-role="font-scale"]');
  const ic = $('icRange')  || $('prefIcon')  || document.querySelector('[data-role="icon-scale"]');
  const th = $('thSel')    || $('prefTheme') || document.querySelector('[data-role="theme"]');
  let save = $('btnSaveSettings') || $('savePrefs') || document.querySelector('[data-role="save-settings"]');

  if(!save){
    const host = th?.parentElement || fs?.parentElement || document.querySelector('#profileView') || document.body;
    const btn = document.createElement('button');
    btn.id='btnSaveSettings'; btn.dataset.role='save-settings';
    btn.className='btn btn-prim'; btn.textContent='บันทึก';
    host.appendChild(btn); save=btn;
  }

  const read = ()=>JSON.parse(localStorage.getItem('APPWD_SETTINGS')||'{}');
  const write=(obj)=>{ localStorage.setItem('APPWD_SETTINGS', JSON.stringify(obj)); document.dispatchEvent(new CustomEvent('appwd:settingsSaved')); };

  const cur = read();
  if(fs) fs.value = cur.FONT_SCALE ?? 1;
  if(ic) ic.value = cur.ICON_SCALE ?? 1;
  if(th) th.value = cur.THEME ?? 'light';

  const saveNow=()=>{
    const obj = read();
    if(fs) obj.FONT_SCALE = parseFloat(fs.value||1);
    if(ic) obj.ICON_SCALE = parseFloat(ic.value||1);
    if(th) obj.THEME = th.value||'light';
    write(obj); if(window.toast) toast('บันทึกการแสดงผลแล้ว','ok');
  };
  save?.addEventListener('click', saveNow);
  fs?.addEventListener('input', saveNow);
  ic?.addEventListener('input', saveNow);
  th?.addEventListener('change', saveNow);

  document.dispatchEvent(new CustomEvent('appwd:settingsLoaded'));
}
