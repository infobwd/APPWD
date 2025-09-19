/**
 * line_share.js - Fixed Version
 * แก้ไขปัญหาแสดงว่าแชร์สำเร็จโดยที่ยังไม่ได้เลือกผู้รับ
 */

import * as CFG from '../config.js';

// === State Management ===
const ShareState = {
  isLiffReady: false,
  isInitializing: false,
  shareInProgress: false
};

// === LIFF Management ===
async function initializeLiff() {
  if (ShareState.isLiffReady) {
    return window.liff;
  }
  
  if (ShareState.isInitializing) {
    // รอถ้ากำลัง initialize อยู่
    let attempts = 0;
    while (ShareState.isInitializing && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    return ShareState.isLiffReady ? window.liff : null;
  }
  
  ShareState.isInitializing = true;
  
  try {
    if (!window.liff) {
      throw new Error('LIFF SDK not loaded');
    }
    
    const liffId = CFG?.LIFF_ID || window.LIFF_ID || '';
    if (!liffId) {
      throw new Error('LIFF ID not configured');
    }
    
    // ตรวจสอบว่า LIFF ถูก initialize แล้วหรือยัง
    try {
      // ถ้าเรียก getOS() ได้ = init แล้ว
      window.liff.getOS();
      ShareState.isLiffReady = true;
      console.log('LIFF already initialized');
    } catch (e) {
      // ยังไม่ได้ init
      console.log('Initializing LIFF...');
      await window.liff.init({ liffId });
      ShareState.isLiffReady = true;
      console.log('LIFF initialized successfully');
    }
    
    ShareState.isInitializing = false;
    return window.liff;
    
  } catch (error) {
    ShareState.isInitializing = false;
    console.error('LIFF init failed:', error);
    throw error;
  }
}

// === News Flex Message Creator ===
function createNewsFlexCard({ title, description, url, imageUrl, category, publishedAt, postId }) {
  // Clean data
  const safeTitle = (title || 'ข่าวสาร').substring(0, 100);
  const safeDesc = description ? description.substring(0, 150) : null;
  const safeCategory = (category || 'ทั่วไป').substring(0, 30);
  
  // สร้าง URL สำหรับเปิดข่าว
  const baseUrl = CFG.PUBLIC_URL || location.origin + location.pathname;
  const newsUrl = postId ? `${baseUrl}#post?id=${postId}` : (url || location.href);
  
  // สร้าง Flex Card
  const flexCard = {
    type: 'bubble',
    size: 'kilo'
  };
  
  // เพิ่มรูปภาพถ้ามี
  if (imageUrl && imageUrl.startsWith('https://')) {
    flexCard.hero = {
      type: 'image',
      url: imageUrl,
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover'
    };
  }
  
  // เนื้อหาหลัก
  const bodyContents = [
    {
      type: 'text',
      text: safeTitle,
      weight: 'bold',
      size: 'md',
      wrap: true,
      maxLines: 2
    }
  ];
  
  // เพิ่ม description ถ้ามี
  if (safeDesc && safeDesc.trim()) {
    bodyContents.push({
      type: 'text',
      text: safeDesc,
      size: 'sm',
      color: '#6b7280',
      wrap: true,
      maxLines: 2,
      margin: 'sm'
    });
  }
  
  // เพิ่ม metadata
  const metaParts = [];
  if (safeCategory !== 'ทั่วไป') metaParts.push(safeCategory);
  if (publishedAt) {
    try {
      const date = new Date(publishedAt);
      if (!isNaN(date.getTime())) {
        metaParts.push(date.toLocaleDateString('th-TH', { 
          day: 'numeric', 
          month: 'short' 
        }));
      }
    } catch (e) {}
  }
  
  if (metaParts.length > 0) {
    bodyContents.push({
      type: 'text',
      text: metaParts.join(' • '),
      size: 'xs',
      color: '#9ca3af',
      margin: 'sm'
    });
  }
  
  flexCard.body = {
    type: 'box',
    layout: 'vertical',
    contents: bodyContents,
    spacing: 'sm'
  };
  
  // ปุ่มอ่านข่าว
  flexCard.footer = {
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'button',
        style: 'primary',
        height: 'sm',
        action: {
          type: 'uri',
          label: 'อ่านข่าว',
          uri: newsUrl.startsWith('http') ? newsUrl : `https://${newsUrl.replace(/^\/+/, '')}`
        }
      }
    ]
  };
  
  return flexCard;
}

// === UI Feedback Functions ===
let currentMessage = null;

function showShareLoading() {
  hideAllMessages();
  const loading = document.createElement('div');
  loading.id = 'shareLoading';
  loading.className = 'fixed top-4 left-4 right-4 z-50 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-sm font-medium text-center max-w-sm mx-auto';
  loading.innerHTML = `
    <div class="flex items-center justify-center gap-2">
      <span class="animate-spin">⟳</span>
      <span>กำลังเตรียมแชร์...</span>
    </div>
  `;
  document.body.appendChild(loading);
  currentMessage = loading;
}

function showShareSuccess(message = 'แชร์สำเร็จ!') {
  hideAllMessages();
  const successEl = document.createElement('div');
  successEl.className = 'fixed top-4 left-4 right-4 z-50 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm font-medium text-center max-w-sm mx-auto';
  successEl.innerHTML = `
    <div class="flex items-center justify-center gap-2">
      <span>✅</span>
      <span>${message}</span>
    </div>
  `;
  document.body.appendChild(successEl);
  currentMessage = successEl;
  
  setTimeout(() => {
    if (successEl.parentElement) {
      successEl.remove();
    }
  }, 3000);
}

function showShareError(message) {
  hideAllMessages();
  const errorEl = document.createElement('div');
  errorEl.className = 'fixed top-4 left-4 right-4 z-50 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm';
  errorEl.innerHTML = `
    <div class="flex items-start gap-2">
      <span>⚠️</span>
      <div class="flex-1">
        <div class="font-medium">${message}</div>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" class="text-red-600 hover:text-red-800">×</button>
    </div>
  `;
  
  document.body.appendChild(errorEl);
  currentMessage = errorEl;
  
  setTimeout(() => {
    if (errorEl.parentElement) {
      errorEl.remove();
    }
  }, 5000);
}

function hideAllMessages() {
  // ลบข้อความเก่าทั้งหมด
  ['shareLoading', 'shareSuccess', 'shareError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  
  // ลบ current message
  if (currentMessage && currentMessage.parentElement) {
    currentMessage.remove();
    currentMessage = null;
  }
}

// === Main Share Function (แก้ไขแล้ว) ===
export async function shareNews(newsData) {
  // ป้องกันการแชร์ซ้ำซ้อน
  if (ShareState.shareInProgress) {
    console.log('Share already in progress');
    return false;
  }
  
  ShareState.shareInProgress = true;
  
  try {
    // ตรวจสอบข้อมูลข่าว
    if (!newsData || !newsData.title) {
      throw new Error('ข้อมูลข่าวไม่ครบถ้วน');
    }
    
    console.log('Starting share process for:', newsData.title);
    showShareLoading();
    
    // Initialize LIFF
    let liff;
    try {
      liff = await initializeLiff();
    } catch (error) {
      console.error('LIFF init error:', error);
      throw new Error('ไม่สามารถเริ่มต้นระบบแชร์ได้');
    }
    
    // ตรวจสอบว่า shareTargetPicker พร้อมใช้งาน
    const canShare = liff && 
                     typeof liff.shareTargetPicker === 'function' && 
                     liff.isApiAvailable && 
                     liff.isApiAvailable('shareTargetPicker');
    
    if (!canShare) {
      console.log('shareTargetPicker not available, using fallback');
      hideAllMessages();
      return await fallbackShare(newsData);
    }
    
    // สร้าง Flex Message
    const flexCard = createNewsFlexCard(newsData);
    const altText = `📰 ${newsData.title}`;
    
    console.log('Opening shareTargetPicker...');
    
    // เปิด shareTargetPicker และรอผลลัพธ์
    try {
      const shareResult = await liff.shareTargetPicker([{
        type: 'flex',
        altText: altText,
        contents: flexCard
      }]);
      
      // ตรวจสอบผลลัพธ์
      console.log('Share result:', shareResult);
      
      // shareTargetPicker จะ return undefined ถ้าสำเร็จ
      // หรือ throw error ถ้าผู้ใช้ยกเลิก
      
      hideAllMessages();
      showShareSuccess();
      
      // บันทึก share count
      if (newsData.postId) {
        await recordShareCount(newsData);
      }
      
      ShareState.shareInProgress = false;
      return true;
      
    } catch (shareError) {
      console.log('shareTargetPicker error:', shareError);
      
      // ตรวจสอบว่าผู้ใช้ยกเลิกหรือไม่
      if (shareError.code === 'CANCEL' || 
          shareError.message?.toLowerCase().includes('cancel') ||
          shareError.message?.toLowerCase().includes('user cancel')) {
        console.log('User cancelled share');
        hideAllMessages();
        ShareState.shareInProgress = false;
        return false;
      }
      
      // Error อื่นๆ ให้ลอง fallback
      console.error('Share error:', shareError);
      hideAllMessages();
      return await fallbackShare(newsData);
    }
    
  } catch (error) {
    console.error('Share process failed:', error);
    hideAllMessages();
    
    let errorMessage = 'ไม่สามารถแชร์ข่าวได้';
    
    if (error.message?.includes('LIFF')) {
      errorMessage = 'กรุณาเปิดใน LINE app เพื่อแชร์';
    } else if (error.message?.includes('ข้อมูล')) {
      errorMessage = error.message;
    }
    
    showShareError(errorMessage);
    ShareState.shareInProgress = false;
    return false;
    
  } finally {
    // Ensure flag is reset
    ShareState.shareInProgress = false;
  }
}

// === Fallback Share Function ===
async function fallbackShare(newsData) {
  const { title, url } = newsData;
  const shareUrl = url || location.href;
  const shareText = `${title}\n${shareUrl}`;
  
  try {
    // ตรวจสอบว่าเป็นมือถือหรือไม่
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    if (isMobile) {
      // ลองใช้ Web Share API ก่อน
      if (navigator.share) {
        try {
          await navigator.share({
            title: title,
            text: title,
            url: shareUrl
          });
          showShareSuccess();
          if (newsData.postId) {
            await recordShareCount(newsData);
          }
          return true;
        } catch (err) {
          if (err.name === 'AbortError') {
            // User cancelled
            return false;
          }
        }
      }
      
      // ใช้ LINE URL scheme
      const lineUrl = `line://msg/text/${encodeURIComponent(shareText)}`;
      window.location.href = lineUrl;
      
      // รอสักครู่แล้วแสดงผล
      setTimeout(() => {
        showShareSuccess('กำลังเปิด LINE...');
        if (newsData.postId) {
          recordShareCount(newsData);
        }
      }, 500);
      
      return true;
    }
    
    // Desktop - คัดลอกลิงก์
    await copyToClipboard(shareText);
    return true;
    
  } catch (error) {
    console.error('Fallback share failed:', error);
    showShareError('ไม่สามารถแชร์ได้ กรุณาลองใหม่');
    return false;
  }
}

// === Copy to Clipboard ===
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showShareSuccess('คัดลอกลิงก์แล้ว! 📋 วางได้ทุกที่');
  } catch (error) {
    // Fallback for old browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showShareSuccess('คัดลอกลิงก์แล้ว! 📋');
  }
}

// === Share Count Recording ===
async function recordShareCount(newsData) {
  try {
    if (!newsData || !newsData.postId) {
      console.warn('No postId for recording share');
      return;
    }
    
    // หา supabase
    let db = window.supabase;
    if (!db) {
      try {
        const apiModule = await import('../api.js');
        db = apiModule.supabase;
      } catch (e) {
        console.warn('Cannot access supabase');
        return;
      }
    }
    
    if (!db) return;
    
    console.log('Recording share for post:', newsData.postId);
    
    const { data, error } = await db.rpc('increment_share', { 
      p_post_id: newsData.postId 
    });
    
    if (error) {
      console.error('Failed to record share count:', error);
    } else {
      console.log('Share count recorded:', data);
      updateShareCountInUI(newsData.postId, data);
    }
  } catch (error) {
    console.error('Error recording share count:', error);
  }
}

// === Update UI ===
function updateShareCountInUI(postId, newCount) {
  // Update all elements showing share count
  const selectors = [
    `#shareCount-${postId}`,
    `[data-post-share-count="${postId}"]`,
    `[data-share-id="${postId}"]`
  ];
  
  document.querySelectorAll(selectors.join(',')).forEach(el => {
    if (el) {
      el.textContent = `📤 ${newCount}`;
    }
  });
}

// === Global Functions ===
window.sharePost = async function(postId) {
  try {
    // ตรวจสอบ supabase
    let db = window.supabase;
    if (!db) {
      try {
        const apiModule = await import('../api.js');
        db = apiModule.supabase;
      } catch (e) {
        showShareError('ไม่พบระบบฐานข้อมูล');
        return false;
      }
    }
    
    // ดึงข้อมูลข่าว
    const { data: post, error } = await db
      .from('posts')
      .select('id,title,body,category,cover_url,published_at')
      .eq('id', postId)
      .maybeSingle();
    
    if (error || !post) {
      showShareError('ไม่พบข่าวที่ต้องการแชร์');
      return false;
    }
    
    // สร้าง URL
    const baseUrl = localStorage.getItem('APPWD_PUBLIC_URL') || location.origin + location.pathname;
    const newsUrl = `${baseUrl}#post?id=${post.id}`;
    
    // สร้าง description
    let description = '';
    if (post.body) {
      const plainText = post.body.replace(/[#*\[\]()]/g, '').trim();
      description = plainText.substring(0, 100);
      if (plainText.length > 100) description += '...';
    }
    
    // เตรียมข้อมูล
    const newsData = {
      postId: post.id,
      title: post.title,
      description: description,
      url: newsUrl,
      imageUrl: post.cover_url,
      category: post.category,
      publishedAt: post.published_at
    };
    
    return await shareNews(newsData);
    
  } catch (error) {
    console.error('sharePost error:', error);
    showShareError('ไม่สามารถแชร์ข่าวได้');
    return false;
  }
};

// === Pre-initialize LIFF (background) ===
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // ไม่ block การโหลดหน้า
    setTimeout(() => {
      initializeLiff().then(success => {
        console.log('LIFF pre-initialized:', success ? 'ready' : 'failed');
      }).catch(err => {
        console.log('LIFF pre-init skipped:', err.message);
      });
    }, 1000);
  });
}

// === Exports ===
export { shareNews as sharePostData };

console.log('LINE Share module loaded (Fixed version)');
