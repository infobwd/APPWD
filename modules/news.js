import { supabase } from '../api.js';

const homeBox = () => document.getElementById('homeNews');
const listBox = () => document.getElementById('newsList');
const composeBox = () => document.getElementById('composeBox');
const btnCompose = () => document.getElementById('btnCompose');
const postDetail = () => document.getElementById('postDetail');
const editorTools = () => document.getElementById('editorTools');
const editForm = () => document.getElementById('editForm');

export async function renderHome(){
  const { data } = await supabase.from('posts').select('id,title,category,published_at,cover_url').lte('published_at', new Date().toISOString()).order('published_at',{ascending:false}).limit(6);
  homeBox().innerHTML = (data||[]).map(item => card(item, true)).join('') || empty('ยังไม่มีข่าว');
}

export async function renderList(){
  const editor = await isEditor();
  btnCompose().classList.toggle('hide', !editor);
  composeBox().classList.add('hide');
  btnCompose().onclick = () => composeBox().classList.toggle('hide');

  const { data } = await supabase.from('posts').select('id,title,category,published_at,cover_url').order('published_at',{ascending:false}).limit(50);
  listBox().innerHTML = (data||[]).map(item => card(item, false, editor)).join('') || empty('ยังไม่มีข่าว');

  // cover upload
  const coverInput = document.getElementById('composeCover');
  if(coverInput){
    coverInput.onchange = async ()=>{
      const f = coverInput.files?.[0]; if(!f) return;
      const path = `news-covers/${Date.now()}_${f.name}`;
      const up = await supabase.storage.from('news-covers').upload(path, f, { upsert:false, contentType:f.type });
      if(up.error){ alert('อัปโหลดปกไม่สำเร็จ: '+up.error.message); return; }
      const url = supabase.storage.from('news-covers').getPublicUrl(path).data.publicUrl;
      document.querySelector('#composeForm [name="cover_url"]').value = url;
    };
  }
  const imgInput = document.getElementById('composeImage');
  if(imgInput){
    imgInput.onchange = async ()=>{
      const f = imgInput.files?.[0]; if(!f) return;
      const path = `news-images/${Date.now()}_${f.name}`;
      const up = await supabase.storage.from('news-images').upload(path, f, { upsert:false, contentType:f.type });
      if(up.error){ alert('อัปโหลดรูปไม่สำเร็จ: '+up.error.message); return; }
      const url = supabase.storage.from('news-images').getPublicUrl(path).data.publicUrl;
      const ta = document.querySelector('#composeForm [name="body"]');
      ta.value += `\n\n![ภาพ](${url})\n\n`;
      alert('แทรกรูปลงเนื้อหาแล้ว');
      imgInput.value = '';
    };
  }

  const form = document.getElementById('composeForm');
  if(form){
    form.onsubmit = async (e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        title: fd.get('title'),
        category: fd.get('category')||null,
        body: fd.get('body')||null,
        cover_url: fd.get('cover_url')||null,
        published_at: fd.get('published_at')? new Date(fd.get('published_at')).toISOString() : new Date().toISOString()
      };
      const { data: row, error } = await supabase.from('posts').insert(payload).select('id').single();
      if(error){ alert('บันทึกข่าวไม่สำเร็จ: '+error.message); return; }
      form.reset(); composeBox().classList.add('hide');
      location.hash = `#post?id=${row.id}`;
    };
  }
}

export async function renderDetail(id){
  if(!id){ postDetail().innerHTML = empty('ไม่พบข่าว'); return; }
  const { data: p, error } = await supabase.from('posts').select('id,title,category,body,published_at,created_by,cover_url').eq('id', id).maybeSingle();
  if(error || !p){ postDetail().innerHTML = empty('ไม่พบข่าว'); return; }
  postDetail().innerHTML = detailView(p);

  const editor = await isEditor(p.created_by);
  editorTools().classList.toggle('hide', !editor);
  if(editor){
    // preload form
    editForm().elements['title'].value = p.title||'';
    editForm().elements['category'].value = p.category||'';
    editForm().elements['body'].value = p.body||'';
    editForm().elements['cover_url'].value = p.cover_url||'';
    editForm().elements['published_at'].value = p.published_at ? new Date(p.published_at).toISOString().slice(0,16) : '';
    // upload cover
    const editCover = document.getElementById('editCover');
    editCover.onchange = async ()=>{
      const f = editCover.files?.[0]; if(!f) return;
      const path = `news-covers/${Date.now()}_${f.name}`;
      const up = await supabase.storage.from('news-covers').upload(path, f, { upsert:false, contentType:f.type });
      if(up.error){ alert('อัปโหลดปกไม่สำเร็จ: '+up.error.message); return; }
      const url = supabase.storage.from('news-covers').getPublicUrl(path).data.publicUrl;
      editForm().elements['cover_url'].value = url;
      alert('อัปปกแล้ว');
    };
    // insert image
    const editImage = document.getElementById('editImage');
    editImage.onchange = async ()=>{
      const f = editImage.files?.[0]; if(!f) return;
      const path = `news-images/${Date.now()}_${f.name}`;
      const up = await supabase.storage.from('news-images').upload(path, f, { upsert:false, contentType:f.type });
      if(up.error){ alert('อัปโหลดรูปไม่สำเร็จ: '+up.error.message); return; }
      const url = supabase.storage.from('news-images').getPublicUrl(path).data.publicUrl;
      const ta = editForm().elements['body'];
      ta.value += `\n\n![ภาพ](${url})\n\n`;
      alert('แทรกรูปลงเนื้อหาแล้ว');
      editImage.value='';
    };

    editForm().onsubmit = async (e)=>{
      e.preventDefault();
      const fd = new FormData(editForm());
      const upd = { title: fd.get('title'), category: fd.get('category')||null, body: fd.get('body')||null,
        cover_url: fd.get('cover_url')||null,
        published_at: fd.get('published_at')? new Date(fd.get('published_at')).toISOString() : null, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('posts').update(upd).eq('id', p.id);
      if(error){ alert('บันทึกไม่สำเร็จ: '+error.message); return; }
      await renderDetail(p.id);
    };
    document.getElementById('btnDelete').onclick = async ()=>{
      if(!confirm('ลบข่าวนี้?')) return;
      const { error } = await supabase.from('posts').delete().eq('id', p.id);
      if(error){ alert('ลบไม่สำเร็จ: '+error.message); return; }
      location.hash = '#news';
    };
  }
}

function detailView(p){
  const d = p.published_at ? new Date(p.published_at).toLocaleString('th-TH',{dateStyle:'medium', timeStyle:'short'}) : '';
  const md = (window.marked ? window.marked.parse(p.body||'') : (p.body||''));  // Markdown -> HTML
  const safe = window.DOMPurify ? window.DOMPurify.sanitize(md) : md;           // Sanitize
  const cover = p.cover_url ? `<img class="cover mb-3" src="${p.cover_url}" alt="cover">` : '';
  return `${cover}<h1 class="text-xl font-semibold mb-1">${e(p.title)}</h1>
          <div class="text-xs text-gray-500 mb-3">${e(p.category||'ทั่วไป')} • ${d}</div>
          <div class="prose prose-sm max-w-none">${safe}</div>`;
}

function card(p, compact=false){
  const d = new Date(p.published_at||new Date()).toLocaleString('th-TH',{dateStyle:'medium'});
  const open = `location.hash='#post?id=${p.id}'`;
  const cover = p.cover_url ? `<img class="w-20 h-14 object-cover rounded-lg border border-[#E6EAF0]" src="${p.cover_url}" alt="cover">` : `<div class="w-20 h-14 rounded-lg bg-brandSoft grid place-items-center text-brand">ข่าว</div>`;
  return `<article class="p-3 border border-[#E6EAF0] rounded-xl bg-white flex items-center gap-3 cursor-pointer" onclick="${open}">
    ${cover}
    <div class="flex-1"><div class="font-semibold line-clamp-2">${e(p.title)}</div><div class="text-xs text-gray-500">${e(p.category||'ทั่วไป')} • ${d}</div></div>
    <div class="text-brand text-sm">อ่านต่อ ›</div>
  </article>`;
}

async function isEditor(created_by){
  const { data: session } = await supabase.auth.getUser();
  const u = session.user;
  if(!u) return false;
  if(created_by && created_by === u.id) return true;
  const { data } = await supabase.from('post_editors').select('user_id').eq('user_id', u.id).maybeSingle();
  return !!data;
}

function empty(t){ return `<div class="text-gray-500">${e(t)}</div>`; }
function e(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
