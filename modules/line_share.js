// ========== line_share.js (Simplified & Fixed Version) ==========
import * as CFG from '../config.js';

// State Management
const ShareState = {
  isLiffReady: false,
  isInitializing: false
};

// Initialize LIFF อย่างถูกต้อง
async function ensureLiffReady() {
  // ถ้า ready แล้วก็ return ได้เลย
  if (ShareState.isLiffReady) return true;
  
  // ถ้ากำลัง init อยู่ให้รอ
  if (ShareState.isInitializing) {
    let attempts = 0;
    while (ShareState.isInitializing && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    return ShareState.isLiffReady;
  }
  
  ShareState.isInitializing = true;
  
  try {
    // ตรวจสอบ LIFF SDK
    if (!window.liff) {
      console.warn('LIFF SDK not loaded');
      return false;
    }
    
    const liffId = CFG?.LIFF_ID || window.LIFF_ID || localStorage.getItem('LIFF_ID') || '';
    if (!liffId) {
      console.warn('LIFF ID not configured');
      return false;
    }
    
    // ตรวจสอบว่า init แล้วหรือยัง
    try {
      // ถ้าเรียก getOS() ได้ = init แล้ว
      window.liff.getOS();
      ShareState.isLiffReady = true;
      console.log('LIFF already initialized');
    } catch (e) {
      // ยังไม่ได้ init - ทำการ init
      console.log('Initializing LIFF for sharing...');
      await window.liff.init({ liffId });
      ShareState.isLiffReady = true;
      console.log('LIFF initialized successfully');
    }
    
    return true;
    
  } catch (error) {
    console.error('LIFF init error:', error);
    return false;
  } finally {
    ShareState.isInitializing = false;
  }
}

// สร้าง Flex Message
function createFlexMessage(newsData) {
  const { title, description, url, imageUrl, category, publishedAt, postId } = newsData;
  
  // Clean data
  const safeTitle = (title || 'ข่าวสาร').substring(0, 100);
  const safeDesc = description ? description.substring(0, 200) : '';
  const safeCategory = (category || 'ทั่วไป').substring(0, 30);
  
  // สร้าง URL สำหรับเปิดข่าว
  const baseUrl = CFG.PUBLIC_URL || location.origin + location.pathname;
  const newsUrl = postId ? `${baseUrl}#post?id=${postId}` : (url || location.href);
  
  // Flex Card structure
  const flexCard = {
    type: 'bubble',
    size: 'kilo'
  };
  
  // Hero image (ถ้ามี)
  if (imageUrl && imageUrl.startsWith('https://')) {
    flexCard.hero = {
      type: 'image',
      url: imageUrl,
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover'
    };
  }
  
  // Body content
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
  
  // Add description if exists
  if (safeDesc) {
    bodyContents.push({
      type: 'text',
      text: safeDesc,
      size: 'sm',
      color: '#6b7280',
      wrap: true,
      maxLines: 3,
      margin: 'sm'
    });
  }
  
  // Add metadata
  const metaInfo = [];
  if (safeCategory !== 'ทั่วไป') metaInfo.push(safeCategory);
  if (publishedAt) {
    try {
      const date = new Date(publishedAt);
      if (!isNaN(date.getTime())) {
        metaInfo.push(date.toLocaleDateString('th-TH', { 
          day: 'numeric', 
          month: 'short' 
        }));
      }
    } catch (e) {}
  }
  
  if (metaInfo.length > 0) {
    bodyContents.push({
      type: 'text',
      text: metaInfo.join(' • '),
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
  
  // Footer with action button
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

// ฟังก์ชันแชร์หลัก
export async function shareNews(newsData) {
  try {
    // Validate input
    if (!newsData || !newsData.title) {
      console.error('Missing news data');
      showMessage('ข้อมูลข่าวไม่ครบถ้วน', 'error');
      return false;
    }
    
    console.log('Sharing news:', newsData.title);
    
    // แสดง loading
    showMessage('กำลังเตรียมแชร์...', 'loading');
    
    // ตรวจสอบและ init LIFF
    const liffReady = await ensureLiffReady();
    
    if (!liffReady) {
      // ถ้า LIFF ไม่พร้อม ให้ใช้วิธี fallback
      hideMessage();
      return await fallbackShare(newsData);
    }
    
    // ตรวจสอบว่า shareTargetPicker ใช้ได้ไหม
    if (!window.liff.isApiAvailable || !window.liff.isApiAvailable('shareTargetPicker')) {
      console.log('shareTargetPicker not available, using fallback');
      hideMessage();
      return await fallbackShare(newsData);
    }
    
    // สร้าง Flex Message
    const flexCard = createFlexMessage(newsData);
    const altText = `📰 ${newsData.title}`;
    
    console.log('Sending flex message via shareTargetPicker...');
    
    // แชร์ด้วย shareTargetPicker
    try {
      await window.liff.shareTargetPicker([{
        type: 'flex',
        altText: altText,
        contents: flexCard
      }]);
      
      hideMessage();
      showMessage('แชร์สำเร็จ! ✅', 'success');
      
      // บันทึก share count
      recordShareCount(newsData.postId);
      
      return true;
      
    } catch (shareError) {
      hideMessage();
      
      // ถ้าผู้ใช้ยกเลิก
      if (shareError.code === 'CANCEL' || shareError.message?.includes('cancel')) {
        console.log('User cancelled share');
        return false;
      }
      
      console.error('shareTargetPicker failed:', shareError);
      
      // ลอง fallback
      return await fallbackShare(newsData);
    }
    
  } catch (error) {
    hideMessage();
    console.error('Share error:', error);
    showMessage('ไม่สามารถแชร์ได้', 'error');
    return false;
  }
}

// Fallback sharing methods
async function fallbackShare(newsData) {
  const { title, url } = newsData;
  const shareUrl = url || location.href;
  const shareText = `${title}\n${shareUrl}`;
  
  // ตรวจสอบว่าอยู่บนมือถือไหม
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  if (isMobile) {
    // ลองใช้ Web Share API
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: title,
          url: shareUrl
        });
        showMessage('แชร์สำเร็จ! ✅', 'success');
        recordShareCount(newsData.postId);
        return true;
      } catch (err) {
        if (err.name === 'AbortError') {
          return false; // User cancelled
        }
      }
    }
    
    // ใช้ LINE URL scheme สำหรับมือถือ
    const lineUrl = `line://msg/text/${encodeURIComponent(shareText)}`;
    window.location.href = lineUrl;
    
    setTimeout(() => {
      showMessage('กำลังเปิด LINE...', 'success');
      recordShareCount(newsData.postId);
    }, 500);
    
    return true;
    
  } else {
    // Desktop - คัดลอกลิงก์
    try {
      await navigator.clipboard.writeText(shareText);
      showMessage('คัดลอกลิงก์แล้ว! 📋 วางใน LINE หรือแอปอื่นได้เลย', 'success');
      recordShareCount(newsData.postId);
      return true;
    } catch (error) {
      // Fallback clipboard
      const textArea = document.createElement('textarea');
      textArea.value = shareText;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      showMessage('คัดลอกลิงก์แล้ว! 📋', 'success');
      recordShareCount(newsData.postId);
      return true;
    }
  }
}

// บันทึก share count
async function recordShareCount(postId) {
  if (!postId) return;
  
  try {
    // หา supabase
    let db = window.supabase;
    if (!db) {
      try {
        const apiModule = await import('../api.js');
        db = apiModule.supabase;
      } catch (e) {
        console.warn('Cannot import supabase');
        return;
      }
    }
    
    if (!db) return;
    
    // เรียก RPC function
    const { data, error } = await db.rpc('increment_share', { 
      p_post_id: postId 
    });
    
    if (!error && data) {
      // อัพเดท UI
      updateShareCountUI(postId, data);
    }
    
    console.log(`Share count updated: Post ${postId} = ${data}`);
    
  } catch (error) {
    console.warn('Failed to record share:', error);
  }
}

// อัพเดท UI
function updateShareCountUI(postId, newCount) {
  // อัพเดททุก element ที่แสดง share count
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

// UI Messages
let messageTimer = null;

function showMessage(text, type = 'info') {
  hideMessage(); // ลบอันเก่า
  
  const colors = {
    loading: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-gray-50 border-gray-200 text-gray-800'
  };
  
  const icons = {
    loading: '⟳',
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };
  
  const message = document.createElement('div');
  message.id = 'shareMessage';
  message.className = `fixed top-4 left-4 right-4 z-[100] p-3 border rounded-lg text-sm font-medium text-center max-w-sm mx-auto ${colors[type]}`;
  
  if (type === 'loading') {
    message.innerHTML = `
      <div class="flex items-center justify-center gap-2">
        <span class="animate-spin">${icons[type]}</span>
        <span>${text}</span>
      </div>
    `;
  } else {
    message.innerHTML = `${icons[type]} ${text}`;
  }
  
  document.body.appendChild(message);
  
  // Auto hide สำหรับ success และ error
  if (type !== 'loading') {
    messageTimer = setTimeout(() => {
      hideMessage();
    }, type === 'success' ? 3000 : 5000);
  }
}

function hideMessage() {
  if (messageTimer) {
    clearTimeout(messageTimer);
    messageTimer = null;
  }
  
  const message = document.getElementById('shareMessage');
  if (message) {
    message.remove();
  }
}

// Initialize LIFF เมื่อโหลดหน้า (background)
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // ไม่ block การโหลดหน้า
    setTimeout(() => {
      ensureLiffReady().then(ready => {
        console.log('LIFF pre-initialized:', ready ? 'success' : 'failed');
      });
    }, 1000);
  });
}

// Export สำหรับ compatibility
export { shareNews as sharePostData };

console.log('LINE Share module loaded (Universal version)');
