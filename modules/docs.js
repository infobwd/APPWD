import { supabase } from '../api.js';
export async function render(){
  const grid = document.getElementById('docsGrid');
  const btn = document.getElementById('btnAddDoc');
  const { data: prof } = await supabase.from('profiles').select('role').eq('user_id', (await supabase.auth.getUser()).data.user?.id || '').maybeSingle();
  btn.style.display = (prof && (prof.role==='editor' || prof.role==='admin')) ? '' : 'none';
  btn.onclick = async ()=>{
    const title = prompt('ชื่อเอกสาร'); if(!title) return;
    const cat = prompt('หมวด (เช่น OIT/แบบฟอร์ม/ระเบียบ)') || null;
    const f = await pickFile(); if(!f) return;
    const path = `docs/${Date.now()}_${f.name}`;
    const up = await supabase.storage.from('docs').upload(path, f, { upsert:false, contentType:f.type });
    if(up.error){ alert('อัปโหลดไม่สำเร็จ: '+up.error.message); return; }
    const { error } = await supabase.from('documents').insert({ title, category: cat, file_path: path, visibility:'public' });
    if(error) alert('บันทึกเมตาไม่สำเร็จ: '+error.message); else await render();
  };
  grid.innerHTML = '<div class="animate-pulse h-5 bg-slate-700/20 rounded w-1/2"></div>';
  const { data, error } = await supabase.from('documents').select('id,title,category,file_path,visibility').order('id',{ascending:false}).limit(60);
  if(error){ grid.innerHTML = '<div class="text-red-300">โหลดเอกสารไม่สำเร็จ</div>'; return; }
  grid.innerHTML = (data||[]).map(d => `<a class="card p-4 hover:bg-[#1b2746]" href="${publicUrl('docs', d.file_path)}" target="_blank"><div class="font-semibold">${escapeHtml(d.title)}</div><div class="text-xs text-slate-400">${escapeHtml(d.category||'ทั่วไป')} • ${escapeHtml(d.visibility||'public')}</div></a>`).join('') || '<div class="text-slate-400">ยังไม่มีเอกสาร</div>';
}
function publicUrl(bucket, path){ return `https://YOUR-PROJECT.supabase.co/storage/v1/object/public/${bucket}/${path.replace(/^.*?docs\//,'docs/')}`; }
function pickFile(){ return new Promise(resolve=>{ const input=document.createElement('input'); input.type='file'; input.onchange=()=> resolve(input.files?.[0] || null); input.click(); }); }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
