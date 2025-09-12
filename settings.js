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
    const root = document.documentElement;
    const body = document.body;
    const fs = parseFloat(obj.FONT_SCALE || 1);
    const ic = parseFloat(obj.ICON_SCALE || 1);
    const theme = (obj.THEME || 'light'); // 'light' | 'dark' | 'system'
    root.style.setProperty('--fs-base', (fs||1));
    root.style.setProperty('--ic-scale', (ic||1));
    if(theme==='system'){
      body.removeAttribute('data-theme');
    }else{
      body.setAttribute('data-theme', theme);
    }
    // brand title (optional)
    if(obj.BRAND_TITLE){
      const el = document.getElementById('brandTitle');
      if(el) el.textContent = obj.BRAND_TITLE;
    }
  }catch(e){}
}
document.addEventListener('appwd:settingsLoaded', applyLocalSettings);
document.addEventListener('appwd:settingsSaved', applyLocalSettings);
window.addEventListener('DOMContentLoaded', applyLocalSettings);
