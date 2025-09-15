
import { sharePostData } from './line_share.js';
import { PUBLIC_URL } from '../config.js';
import { supabase } from '../api.js';

function pickDesc(row){
  const cand=[row?.summary,row?.desc,row?.description,row?.content,row?.body,row?.content_md];
  const s=(cand.find(v=>typeof v==='string'&&v.trim())||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
  return s.slice(0,140);
}
function pickCover(row){ return row?.cover_url || row?.image_url || row?.cover || row?.thumb || ''; }

async function fetchPost(id){
  try{
    const { data, error } = await supabase.from('posts').select('*').eq('id', id).maybeSingle();
    if (error) throw error; return data||null;
  }catch{ return null; }
}
export async function sharePost(id){
  let post=null;
  if (typeof id==='number'||typeof id==='string'){ const pid=Number(id); if(!isNaN(pid)) post=await fetchPost(pid); }
  else if (id&&id.id){ post=id; }
  const title = post?.title || post?.name || document.title;
  const img = pickCover(post);
  const desc = pickDesc(post);
  const url = (PUBLIC_URL || location.origin + location.pathname) + '#news?post=' + (post?.id || id || '');
  await sharePostData({ title, url, img, desc });
}
window.sharePost = sharePost;
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnShare');
  if (btn){ btn.addEventListener('click', () => {
    const id = Number(btn.dataset.id || btn.getAttribute('data-post-id') || btn.value || 0);
    window.sharePost(id || undefined);
  }); }
});
