import { supabase } from '../api.js';
export async function render(){
  const grid=document.getElementById('linkGrid');
  const { data, error } = await supabase.from('app_links').select('id,title,url,icon,category').order('title');
  if(error){ grid.innerHTML='<div class="text-red-600">โหลดลิงก์ไม่สำเร็จ</div>'; return; }
  grid.innerHTML = (data||[]).map(l => `
    <a href="${encodeURI(l.url)}" target="_blank" rel="noopener" class="flex flex-col items-center gap-1">
      <div class="w-12 h-12 rounded-2xl grid place-items-center bg-brandSoft text-brand">${e(l.icon||'🔗')}</div>
      <div class="text-[12px]">${e(l.title)}</div>
    </a>
  `).join('') || '<div class="text-gray-500">ยังไม่มีลิงก์</div>';
}
function e(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
