import { supabase } from '../api.js';
export async function render(){
  const qEl=document.getElementById('dirQuery'); const btn=document.getElementById('dirSearch'); const grid=document.getElementById('dirGrid');
  async function run(){ const q=(qEl.value||'').trim(); let req=supabase.from('profiles').select('display_name,department,phone,avatar_url'); if(q){ req = req.ilike('display_name', `%${q}%`); } const { data, error } = await req.order('display_name'); if(error){ grid.innerHTML='<div class="text-red-300">โหลดทำเนียบไม่สำเร็จ</div>'; return; } grid.innerHTML=(data||[]).map(p=>`<div class="p-3 border border-[#223052] rounded-lg flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-[#0F1B34] grid place-items-center">${avatar(p)}</div><div><div class="font-semibold">${e(p.display_name||'-')}</div><div class="text-xs text-slate-400">${e(p.department||'')}</div><div class="text-xs">${e(p.phone||'')}</div></div></div>`).join('')||'<div class="text-slate-400">ยังไม่มีข้อมูล</div>'; }
  btn.onclick=run; await run();
}
function avatar(p){ return p.avatar_url ? `<img src="${p.avatar_url}" class="w-10 h-10 rounded-full object-cover">` : '👤'; }
function e(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) }
