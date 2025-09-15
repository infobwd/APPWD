import { supabase } from './api.js';
import { setLocalSettings } from './config.js';
export async function loadSettings(){
  const resp = await supabase.from('settings').select('key,value');
  const rows = resp.data||[]; const obj = {}; rows.forEach(r=>{ try{obj[r.key]=JSON.parse(r.value)}catch{obj[r.key]=r.value} });
  setLocalSettings(obj); document.dispatchEvent(new CustomEvent('appwd:settingsLoaded',{detail:obj}));
}
document.addEventListener('DOMContentLoaded', loadSettings);