import { supabase } from '../api.js';

export async function render(){
  const grid = document.getElementById('appLinks');
  grid.innerHTML = skeleton();
  const { data, error } = await supabase
    .from('app_links')
    .select('id,title,url,icon,category')
    .order('title');
  if(error){ grid.innerHTML = '<div class="text-red-300">โหลดลิงก์ไม่สำเร็จ</div>'; return; }
  grid.innerHTML = (data||[]).map(link => `
    <a href="${encodeURI(link.url)}" target="_blank" rel="noopener" class="card p-4 text-center hover:bg-[#1b2746]">
      <div class="text-3xl mb-2">${escapeHtml(link.icon||'🔗')}</div>
      <div class="font-semibold">${escapeHtml(link.title)}</div>
      <div class="text-xs text-slate-400">${escapeHtml(link.category||'ทั่วไป')}</div>
    </a>
  `).join('') || '<div class="text-slate-400">ยังไม่มีลิงก์</div>';
}

function skeleton(){
  return Array.from({length:8}).map(()=>`
    <div class="card p-4">
      <div class="animate-pulse h-8 bg-slate-700/20 rounded w-12 mb-3"></div>
      <div class="animate-pulse h-4 bg-slate-700/20 rounded w-3/4"></div>
    </div>
  `).join('');
}
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
