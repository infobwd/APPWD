
import { sharePostData } from './line_share.js';
import { PUBLIC_URL } from '../config.js';
import { supabase } from '../api.js';

async function fetchPost(id){
  try{
    const { data, error } = await supabase.from('posts').select('id,title,cover_url,content').eq('id', id).maybeSingle();
    if (error) throw error;
    return data || null;
  }catch{ return null; }
}
export async function sharePost(id){
  let post = null;
  if (typeof id === 'number' || typeof id === 'string') {
    const pid = Number(id);
    if (!isNaN(pid)) post = await fetchPost(pid);
  } else if (id && id.id) {
    post = id;
  }
  const title = post?.title || document.title;
  const img   = post?.cover_url || '';
  const desc  = (post?.content || '').replace(/<[^>]+>/g,'').slice(0,120);
  const url   = (PUBLIC_URL || location.origin + location.pathname) + '#news?post=' + (post?.id || id || '');
  await sharePostData({ title, url, img, desc });
}
window.sharePost = sharePost;

function bindBtn(){
  const btn = document.getElementById('btnShare');
  if (btn){
    btn.addEventListener('click', ()=>{
      const id = Number(btn.dataset.id || btn.getAttribute('data-post-id') || btn.value || 0);
      window.sharePost(id || undefined);
    });
  }
}
document.addEventListener('DOMContentLoaded', bindBtn);
