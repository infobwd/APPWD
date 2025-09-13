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
  const fs=document.getElementById('fsRange'), ic=document.getElementById('icRange'), th=document.getElementById('thSel');
  const save=document.getElementById('btnSaveSettings')||document.getElementById('savePrefs');
  const obj=JSON.parse(localStorage.getItem('APPWD_SETTINGS')||'{}');
  if(fs) fs.value = obj.FONT_SCALE || 1;
  if(ic) ic.value = obj.ICON_SCALE || 1;
  if(th) th.value = obj.THEME || 'light';
  function saveNow(){
    const cur=JSON.parse(localStorage.getItem('APPWD_SETTINGS')||'{}');
    if(fs) cur.FONT_SCALE = parseFloat(fs.value||1);
    if(ic) cur.ICON_SCALE = parseFloat(ic.value||1);
    if(th) cur.THEME = th.value||'light';
    localStorage.setItem('APPWD_SETTINGS', JSON.stringify(cur));
    document.dispatchEvent(new CustomEvent('appwd:settingsSaved'));
    if(window.toast) toast('บันทึกการแสดงผลแล้ว','ok');
  }
  if(save) save.onclick = saveNow;
  if(fs) fs.addEventListener('input', saveNow);
  if(ic) ic.addEventListener('input', saveNow);
  if(th) th.addEventListener('change', saveNow);
  document.dispatchEvent(new CustomEvent('appwd:settingsLoaded'));
}
