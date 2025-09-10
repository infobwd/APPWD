import { supabase } from '../api.js';

const listEl = () => document.getElementById('postList');

export async function renderList(){
  const el = listEl();
  if(!el) return;
  el.innerHTML = skeleton();
  const { data, error } = await supabase
    .from('posts')
    .select('id,title,body,category,published_at')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending:false })
    .limit(30);
  if(error){ el.innerHTML = `<div class="text-red-300">โหลดข่าวไม่สำเร็จ: ${error.message}</div>`; return; }
  el.innerHTML = data.map(renderCard).join('');
}

function renderCard(p){
  const d = new Date(p.published_at);
  const dth = d.toLocaleString('th-TH', { dateStyle:'medium' });
  return `<article class="card p-4">
    <div class="font-semibold mb-1">${escapeHtml(p.title)}</div>
    <div class="text-xs text-slate-400 mb-3">หมวด: ${escapeHtml(p.category||'—')} • เผยแพร่ ${dth}</div>
    <div class="text-sm text-slate-200/90 line-clamp-3">${escapeHtml((p.body||'').slice(0,160))}...</div>
  </article>`;
}

function skeleton(){
  return Array.from({length:6}).map(()=>`
    <div class="card p-4">
      <div class="animate-pulse h-5 bg-slate-700/30 rounded w-3/4 mb-2"></div>
      <div class="animate-pulse h-4 bg-slate-700/20 rounded w-2/3 mb-3"></div>
      <div class="animate-pulse h-16 bg-slate-700/10 rounded"></div>
    </div>
  `).join('');
}

function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
