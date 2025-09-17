import { sharePostData } from './line_share.js';
import { PUBLIC_URL } from '../config.js';
import { supabase } from '../api.js';

// === Utility Functions ===
function pickDesc(row) {
  const candidates = [
    row?.summary,
    row?.desc, 
    row?.description,
    row?.content,
    row?.body,
    row?.content_md
  ];
  
  const desc = (candidates.find(v => typeof v === 'string' && v.trim()) || '')
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
    
  return desc.slice(0, 140);
}

function pickCover(row) {
  return row?.cover_url || 
         row?.image_url || 
         row?.cover || 
         row?.thumb || 
         row?.featured_image ||
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

// === Enhanced Share Function ===
export async function sharePost(id) {
  let post = null;
  
  // Handle different input types
  if (typeof id === 'number' || typeof id === 'string') {
    const pid = Number(id);
    if (!isNaN(pid)) {
      post = await fetchPost(pid);
    }
  } else if (id && typeof id === 'object' && id.id) {
    post = id;
  }
  
  if (!post) {
    console.warn('Post not found or invalid ID:', id);
    // Try to share current page instead
    post = {
      title: document.title,
      id: 'current'
    };
  }
  
  // Prepare share data
  const shareData = {
    title: post?.title || post?.name || document.title || 'ข่าวสาร',
    description: pickDesc(post),
    url: `${PUBLIC_URL || (location.origin + location.pathname)}#news?post=${post?.id || id || ''}`,
    imageUrl: pickCover(post),
    author: post?.author || post?.created_by,
    publishedAt: post?.published_at || post?.created_at
  };
  
  // Validate URL
  try {
    new URL(shareData.url);
  } catch (error) {
    console.warn('Invalid URL generated, using current page');
    shareData.url = location.href;
  }
  
  // Use enhanced share function
  try {
    const result = await sharePostData(shareData);
    
    // Track analytics if successful
    if (result) {
      trackShareEvent('post', post?.id, shareData.title);
    }
    
    return result;
  } catch (error) {
    console.error('Share failed:', error);
    return false;
  }
}

// === Analytics Tracking ===
function trackShareEvent(type, itemId, title) {
  try {
    const event = {
      action: 'share',
      type: type,
      item_id: itemId,
      title: title,
      timestamp: new Date().toISOString(),
      url: location.href
    };
    
    // Store in localStorage for analytics
    const analytics = JSON.parse(localStorage.getItem('APPWD_SHARE_EVENTS') || '[]');
    analytics.push(event);
    
    // Keep only last 50 events
    if (analytics.length > 50) {
      analytics.splice(0, analytics.length - 50);
    }
    
    localStorage.setItem('APPWD_SHARE_EVENTS', JSON.stringify(analytics));
    
    // Send to Google Analytics if available
    if (window.gtag) {
      window.gtag('event', 'share', {
        event_category: 'social',
        event_label: type,
        custom_parameter_1: itemId,
        custom_parameter_2: title
      });
    }
    
  } catch (error) {
    console.warn('Analytics tracking failed:', error);
  }
}

// === Global Export ===
window.sharePost = sharePost;

// === Enhanced DOM Event Handling ===
document.addEventListener('DOMContentLoaded', () => {
  setupShareButtons();
});

function setupShareButtons() {
  // Handle individual share buttons
  const shareBtn = document.getElementById('btnShare');
  if (shareBtn) {
    shareBtn.addEventListener('click', handleShareClick);
  }
  
  // Handle multiple share buttons with delegation
  document.addEventListener('click', (event) => {
    const target = event.target;
    
    // Check for share buttons with various selectors
    if (target.matches('.share-btn, [data-share], .btn-share')) {
      event.preventDefault();
      handleShareClick.call(target, event);
    }
  });
}

function handleShareClick(event) {
  const button = this;
  const postId = getPostIdFromButton(button);
  
  // Show loading state
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'กำลังแชร์...';
  
  // Perform share
  window.sharePost(postId).finally(() => {
    // Restore button state
    button.disabled = false;
    button.textContent = originalText;
  });
}

function getPostIdFromButton(button) {
  // Try multiple ways to get post ID
  return button.dataset.id ||
         button.dataset.postId ||
         button.getAttribute('data-post-id') ||
         button.value ||
         getCurrentPostId() ||
         0;
}

function getCurrentPostId() {
  // Extract from URL hash
  try {
    const hash = location.hash;
    const match = hash.match(/[?&]post=(\d+)/);
    return match ? parseInt(match[1]) : null;
  } catch {
    return null;
  }
}

// === Enhanced Share Menu (Optional) ===
export function createShareMenu(postData, targetElement) {
  const menu = document.createElement('div');
  menu.className = 'share-menu fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50';
  menu.innerHTML = `
    <div class="bg-white rounded-t-lg p-4 w-full max-w-md mx-4 mb-4 transform translate-y-full transition-transform">
      <div class="text-center mb-4">
        <div class="font-medium">แชร์เนื้อหา</div>
        <div class="text-sm text-gray-500 truncate mt-1">${postData.title || 'ข่าวสาร'}</div>
      </div>
      
      <div class="grid grid-cols-3 gap-4 text-center">
        <button class="share-option p-3 rounded-lg border hover:bg-gray-50" data-type="line">
          <div class="text-green-500 text-xl mb-1">💬</div>
          <div class="text-xs">LINE</div>
        </button>
        
        <button class="share-option p-3 rounded-lg border hover:bg-gray-50" data-type="copy">
          <div class="text-blue-500 text-xl mb-1">📋</div>
          <div class="text-xs">คัดลอก</div>
        </button>
        
        <button class="share-option p-3 rounded-lg border hover:bg-gray-50" data-type="native">
          <div class="text-purple-500 text-xl mb-1">📤</div>
          <div class="text-xs">อื่นๆ</div>
        </button>
      </div>
      
      <button class="cancel-share w-full mt-4 p-3 text-gray-600 border rounded-lg">
        ยกเลิก
      </button>
    </div>
  `;
  
  document.body.appendChild(menu);
  
  // Animate in
  setTimeout(() => {
    const panel = menu.querySelector('div > div');
    panel.style.transform = 'translateY(0)';
  }, 10);
  
  // Handle clicks
  menu.addEventListener('click', async (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    
    if (target.classList.contains('cancel-share')) {
      closeMenu();
      return;
    }
    
    const option = target.closest('.share-option');
    if (!option) return;
    
    const type = option.dataset.type;
    
    try {
      switch (type) {
        case 'line':
          await sharePostData(postData);
          break;
        case 'copy':
          await navigator.clipboard.writeText(postData.url);
          alert('คัดลอกลิงก์สำเร็จ!');
          break;
        case 'native':
          if (navigator.share) {
            await navigator.share({
              title: postData.title,
              text: postData.description,
              url: postData.url
            });
          }
          break;
      }
    } catch (error) {
      console.error('Share option failed:', error);
    }
    
    closeMenu();
  });
  
  // Close on backdrop click
  menu.addEventListener('click', (e) => {
    if (e.target === menu) closeMenu();
  });
  
  function closeMenu() {
    const panel = menu.querySelector('div > div');
    panel.style.transform = 'translateY(100%)';
    setTimeout(() => {
      menu.remove();
    }, 300);
  }
  
  return menu;
}

// === Export share menu function ===
window.createShareMenu = createShareMenu;

console.log('Enhanced share_bindings loaded successfully');
