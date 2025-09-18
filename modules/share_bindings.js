/**
 * line_share.js
 Updated Share Bindings for News-only sharing
 * การเชื่อมต่อการแชร์แบบเฉพาะข่าว
 */

import { shareNews } from './line_share.js';  // เปลี่ยนจาก line_share.js
import { PUBLIC_URL } from '../config.js';
import { supabase } from '../api.js';

// === Helper Functions ===
function pickDesc(row) {
  const candidates = [
    row?.summary,
    row?.desc,
    row?.description,
    row?.content,
    row?.body,
    row?.content_md
  ];
  
  const description = (candidates.find(v => typeof v === 'string' && v.trim()) || '')
    .replace(/<[^>]+>/g, '')  // ลบ HTML tags
    .replace(/[#*\[\]()]/g, '')  // ลบ Markdown syntax
    .replace(/\s+/g, ' ')  // ลดช่องว่างซ้อน
    .trim();
  
  return description.slice(0, 140);
}

function pickCover(row) {
  return row?.cover_url || 
         row?.image_url || 
         row?.cover || 
         row?.thumb || 
         '';
}

async function fetchPost(id) {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Failed to fetch post:', error);
    return null;
  }
}

// === Main Share Function ===
export async function sharePost(id) {
  let post = null;
  
  // Handle different input types
  if (typeof id === 'number' || typeof id === 'string') {
    const postId = Number(id);
    if (!isNaN(postId)) {
      post = await fetchPost(postId);
    }
  } else if (id && id.id) {
    post = id;  // Already a post object
  }
  
  if (!post) {
    console.error('Post not found or invalid ID:', id);
    // Show error message
    if (window.showShareError) {
      window.showShareError('ไม่พบข่าวที่ต้องการแชร์');
    }
    return false;
  }
  
  console.log('Sharing post:', post); // Debug log
  
  // Prepare news data for sharing
  const title = post?.title || post?.name || document.title;
  const imageUrl = pickCover(post);
  const description = pickDesc(post);
  const category = post?.category || 'ทั่วไป';
  const publishedAt = post?.published_at;
  
  // Create news URL
  const baseUrl = PUBLIC_URL || location.origin + location.pathname;
  const newsUrl = `${baseUrl}#post?id=${post.id}`;
  
  const newsData = {
    title,
    description,
    url: newsUrl,
    imageUrl,
    category,
    publishedAt,
    postId: post.id  // เพิ่ม postId สำหรับ LIFF URL และ tracking
  };
  
  console.log('News data prepared:', newsData); // Debug log
  
  return await shareNews(newsData);
}

// === Global Window Function ===
window.sharePost = sharePost;

// === DOM Event Bindings ===
document.addEventListener('DOMContentLoaded', () => {
  // Share button binding
  const shareBtn = document.getElementById('btnShare');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const postId = Number(
        shareBtn.dataset.id || 
        shareBtn.getAttribute('data-post-id') || 
        shareBtn.value || 
        0
      );
      
      if (postId) {
        await window.sharePost(postId);
      } else {
        console.warn('No post ID found for share button');
      }
    });
  }
  
  // Dynamic share buttons (for posts loaded via JS)
  document.addEventListener('click', async (e) => {
    if (e.target && e.target.matches('[data-share-post]')) {
      e.preventDefault();
      const postId = Number(e.target.getAttribute('data-share-post'));
      if (postId) {
        await window.sharePost(postId);
      }
    }
  });
});

// === Legacy Support ===
// สำหรับโค้ดเก่าที่อาจเรียกใช้
window.sharePostData = async function(data) {
  console.warn('sharePostData is deprecated, use shareNews instead');
  return await shareNews({
    title: data.title,
    description: data.desc,
    url: data.url,
    imageUrl: data.img
  });
};

console.log('Share bindings module loaded successfully');
