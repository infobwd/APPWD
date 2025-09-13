import { supabase } from './api.js';

export async function loadSettings(){
  const resp = await supabase.from('settings').select('key,value');
  const rows = resp.data||[]; const obj = {}; rows.forEach(r=>{ try{obj[r.key]=JSON.parse(r.value)}catch{obj[r.key]=r.value} });
  try{ localStorage.setItem('APPWD_SETTINGS', JSON.stringify(obj||{})); }catch(e){} document.dispatchEvent(new CustomEvent('appwd:settingsLoaded',{detail:obj}));
}
document.addEventListener('DOMContentLoaded', loadSettings);
export function applyLocalSettings(){
  try{
    const obj = JSON.parse(localStorage.getItem('APPWD_SETTINGS')||'{}');
    const root=document.documentElement, body=document.body;
    root.style.setProperty('--fs', String(obj.FONT_SCALE||1));
    root.style.setProperty('--icon', String(obj.ICON_SCALE||1));
    const th=obj.THEME||'light';
    if(th==='system') body.removeAttribute('data-theme'); else body.setAttribute('data-theme', th);
  }catch(_){}
}
export function wireProfileSettings(){
  const $=id=>document.getElementById(id);
  const fs=$('fsRange')||document.querySelector('[data-role="font-scale"]');
  const ic=$('icRange')||document.querySelector('[data-role="icon-scale"]');
  const th=$('thSel')||document.querySelector('[data-role="theme"]');
  let save=$('btnSaveSettings')||document.querySelector('[data-role="save-settings"]');
  if(!save){const host=th?.parentElement||fs?.parentElement||document.querySelector('#profileView')||document.body;
    const btn=document.createElement('button'); btn.id='btnSaveSettings'; btn.className='btn btn-prim'; btn.textContent='บันทึก'; host.appendChild(btn); save=btn;}
  const read=()=>JSON.parse(localStorage.getItem('APPWD_SETTINGS')||'{}');
  const write=o=>{localStorage.setItem('APPWD_SETTINGS', JSON.stringify(o)); document.dispatchEvent(new CustomEvent('appwd:settingsSaved'));};
  const cur=read(); if(fs) fs.value=cur.FONT_SCALE??1; if(ic) ic.value=cur.ICON_SCALE??1; if(th) th.value=cur.THEME??'light';
  const saveNow=()=>{const o=read(); if(fs) o.FONT_SCALE=parseFloat(fs.value||1); if(ic) o.ICON_SCALE=parseFloat(ic.value||1); if(th) o.THEME=th.value||'light'; write(o); applyLocalSettings(); toast?.('บันทึกการแสดงผลแล้ว','ok');};
  save?.addEventListener('click',saveNow); fs?.addEventListener('input',saveNow); ic?.addEventListener('input',saveNow); th?.addEventListener('change',saveNow);
}
document.addEventListener('DOMContentLoaded', ()=>applyLocalSettings());
