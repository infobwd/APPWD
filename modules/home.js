
import { supabase } from '../api.js';

/**
 * Render app links into a pure grid (no heading), acceptable targetId 'homeLinks'.
 * Schema per app_links(id, title, url, image_url, category, sort_order, is_active).
 */
export async function renderAppsCard(targetId='homeLinks'){
  const el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = '<div class="text-sm text-ink3">กำลังโหลด...</div>';
  try{
    const { data, error } = await supabase
      .from('app_links')
      .select('id,title,url,image_url,category,sort_order,is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending:true })
      .order('id', { ascending:true });
    if (error) throw error;
    const rows = data || [];
    if (!rows.length){
      el.innerHTML = '<div class="text-sm text-ink3">ยังไม่มีรายการ</div>';
      return;
    }
    el.innerHTML = rows.map(r => {
      const img = r.image_url || './icons/icon-192.png';
      const cat = r.category ? `<div class="cat">${escapeHtml(r.category)}</div>` : '';
      return `<a class="link-item" href="${r.url}" target="_blank" rel="noopener">
        <img src="${img}" alt="icon">
        <div class="meta">
          <div class="title">${escapeHtml(r.title||'รายการ')}</div>
          ${cat}
        </div>
      </a>`;
    }).join('');
  }catch(e){
    el.innerHTML = '<div class="text-sm text-red-600">โหลดลิงก์ไม่สำเร็จ</div>';
  }
}
function escapeHtml(s=''){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c));
}

// auto render on load for homeLinks if exists
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('homeLinks')) renderAppsCard('homeLinks');
});
