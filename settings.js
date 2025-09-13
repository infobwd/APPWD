import { supabase } from './api.js';

export async function loadSettings(){
  const resp = await supabase.from('settings').select('key,value');
  const rows = resp.data||[]; const obj = {}; rows.forEach(r=>{ try{obj[r.key]=JSON.parse(r.value)}catch{obj[r.key]=r.value} });
  try{ localStorage.setItem('APPWD_SETTINGS', JSON.stringify(obj||{})); }catch(e){} document.dispatchEvent(new CustomEvent('appwd:settingsLoaded',{detail:obj}));
}
document.addEventListener('DOMContentLoaded', loadSettings);