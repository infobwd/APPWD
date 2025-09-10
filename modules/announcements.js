import { supabase, anyRole, currentUser } from '../api.js';

const listEl = () => document.getElementById('postList');

export async function renderList(){
  const el = listEl();
  if(!el) return;
  el.innerHTML = skeleton();
  const { data, error } = await supabase
    .from('posts')
    .select('id,title,body,category,published_at')
    .lte('published_at', new Date().toISOString())
    .order('pinned', { ascending:false })
    .order('published_at', { ascending:false })
    .limit(36);
  if(error){ el.innerHTML = `<div class="text-red-300">โหลดข่าวไม่สำเร็จ: ${error.message}</div>`; return; }
  el.innerHTML = data.map(renderCard).join('');
}

export async function renderComposeButton(){
  // Show compose button if role is editor/admin
  const header = document.querySelector('[data-view="#announcements"] .card .flex.items-center.justify-between');
  if(!header) return;
  let btn = header.querySelector('#btnAddPost');
  if(btn) btn.remove();
  const can = await anyRole(['editor','admin']);
  if(can){
    btn = document.createElement('a');
    btn.id = 'btnAddPost';
    btn.className = 'btn btn-prim';
    btn.textContent = '+ เพิ่มข่าว';
    btn.href = '#compose';
    header.appendChild(btn);
  }
}

function renderCard(p){
  const d = new Date(p.published_at);
  const dth = d.toLocaleString('th-TH', { dateStyle:'medium' });
  return `<article class="card p-4">
    <a href="#post?id=${encodeURIComponent(p.id)}" class="block">
      <div class="font-semibold mb-1">${escapeHtml(p.title)}</div>
      <div class="text-xs text-slate-400 mb-3">หมวด: ${escapeHtml(p.category||'—')} • เผยแพร่ ${dth}</div>
      <div class="text-sm text-slate-200/90 line-clamp-3">${escapeHtml((p.body||'').slice(0,180))}...</div>
    </a>
  </article>`;
}

export async function renderDetail(id){
  const detail = document.getElementById('postDetail');
  const attaches = document.getElementById('postAttachments');
  if(!detail || !attaches) return;
  if(!id){ detail.innerHTML = '<div class="text-red-300">ไม่พบโพสต์</div>'; attaches.innerHTML=''; return; }

  detail.innerHTML = '<div class="animate-pulse h-6 bg-slate-700/30 rounded w-2/3 mb-3"></div>';
  attaches.innerHTML = '<div class="animate-pulse h-4 bg-slate-700/20 rounded w-1/2"></div>';

  const { data: post, error } = await supabase
    .from('posts')
    .select('id,title,body,category,published_at,author_id')
    .eq('id', id).maybeSingle();
  if(error || !post){ detail.innerHTML = '<div class="text-red-300">โหลดโพสต์ไม่สำเร็จ</div>'; attaches.innerHTML=''; return; }

  const time = new Date(post.published_at).toLocaleString('th-TH', { dateStyle:'medium', timeStyle:'short'});
  detail.innerHTML = `
    <h1 class="text-xl font-semibold">${escapeHtml(post.title)}</h1>
    <div class="text-xs text-slate-400">หมวด: ${escapeHtml(post.category||'—')} • เผยแพร่ ${time}</div>
    <hr class="my-3 border-[#223052]">
    <div class="whitespace-pre-wrap leading-relaxed">${escapeHtml(post.body||'')}</div>
  `;

  // Mark as read
  const user = await currentUser();
  if(user){
    await supabase.from('post_reads').upsert({ post_id: post.id, user_id: user.id, read_at: new Date().toISOString() }, { onConflict: 'post_id,user_id' });
  }

  const { data: files } = await supabase
    .from('post_attachments')
    .select('id,file_path,mime')
    .eq('post_id', post.id)
    .order('id',{ascending:true});

  if(!files || files.length===0){
    attaches.innerHTML = '<div class="text-slate-400">ไม่มีไฟล์แนบ</div>';
  }else{
    const rows = files.map(f => `<a class="block p-2 border border-[#223052] rounded hover:bg-[#1b2746]" href="${filePublicUrl(f.file_path)}" target="_blank">${iconFor(f.mime)} ${escapeHtml(f.file_path.split('/').pop())}</a>`);
    attaches.innerHTML = rows.join('');
  }
}

export async function renderCompose(){
  const can = await anyRole(['editor','admin']);
  const wrap = document.querySelector('[data-view="#compose"]');
  if(!wrap) return;
  if(!can){
    wrap.innerHTML = '<div class="card p-6 text-red-300">คุณไม่มีสิทธิ์เพิ่มข่าว</div>';
    return;
  }
  // Wire submit
  const form = document.getElementById('composeForm');
  const files = document.getElementById('composeFiles');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      title: fd.get('title'),
      body: fd.get('body') || null,
      category: fd.get('category') || null,
      audience: fd.get('audience') || 'public',
      pinned: fd.get('pinned') === 'on',
      published_at: fd.get('published_at') ? new Date(fd.get('published_at')).toISOString() : new Date().toISOString()
    };
    const { data: inserted, error } = await supabase.from('posts').insert(payload).select('id').maybeSingle();
    if(error || !inserted){ alert('บันทึกโพสต์ไม่สำเร็จ: ' + (error?.message||'')); return; }

    // Upload attachments if any
    const filesArr = Array.from(files.files || []);
    for(const f of filesArr){
      const path = `posts/${inserted.id}/${Date.now()}_${f.name}`;
      const up = await supabase.storage.from('attachments').upload(path, f, { upsert:false, contentType:f.type });
      if(up.error){ alert('อัปโหลดไฟล์แนบไม่สำเร็จ: ' + up.error.message); continue; }
      await supabase.from('post_attachments').insert({ post_id: inserted.id, file_path: path, mime: f.type });
    }
    location.hash = '#post?id=' + inserted.id;
  };
}

function filePublicUrl(path){
  // For public bucket, direct public URL pattern
  const url = `${location.origin}/_supabase_storage_proxy/${encodeURIComponent(path)}`;
  // Fallback: use Supabase storage public URL if configured as public
  return url;
}

function iconFor(mime){
  if(!mime) return '📎';
  if(mime.includes('pdf')) return '📕';
  if(mime.includes('image')) return '🖼️';
  if(mime.includes('spreadsheet') || mime.includes('excel')) return '📊';
  if(mime.includes('word')) return '📝';
  return '📎';
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
