// ========== line_share.js (ปรับปรุงใหม่) ==========
import * as CFG from '../config.js';

// State Management
const ShareState = {
  isLiffReady: false,
  isInitializing: false,
  shareInProgress: false,
  liffChecked: false
};

// ตรวจสอบ environment
function detectEnvironment() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isLineApp = userAgent.includes('line');
  const isLiffBrowser = window.liff && typeof window.liff.isInClient === 'function' && window.liff.isInClient();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  
  return {
    isLineApp: isLineApp || isLiffBrowser,
    isLiffBrowser,
    isMobile,
    isDesktop: !isMobile,
    canUseShareAPI: navigator.share !== undefined,
    canUseLiff: !!(window.liff)
  };
}

// Initialize LIFF แบบ safe
async function safeLiffInit() {
  // ป้องกันการ init ซ้ำ
  if (ShareState.isLiffReady || ShareState.isInitializing) {
    // รอถ้ากำลัง init อยู่
    if (ShareState.isInitializing) {
      let attempts = 0;
      while (ShareState.isInitializing && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
    }
    return ShareState.isLiffReady;
  }
  
  ShareState.isInitializing = true;
  
  try {
    // ตรวจสอบว่า LIFF SDK โหลดแล้ว
    if (!window.liff) {
      console.warn('LIFF SDK not loaded');
      return false;
    }
    
    const liffId = CFG?.LIFF_ID || window.LIFF_ID || '';
    if (!liffId) {
      console.warn('LIFF ID not configured');
      return false;
    }
    
    // ตรวจสอบว่า init แล้วหรือยัง
    try {
      // ถ้า liff.getOS() ทำงานได้ = init แล้ว
      const os = window.liff.getOS();
      ShareState.isLiffReady = true;
      console.log('LIFF already initialized, OS:', os);
    } catch (e) {
      // ยังไม่ init - ทำการ init
      console.log('Initializing LIFF...');
      await window.liff.init({ liffId });
      ShareState.isLiffReady = true;
      console.log('LIFF initialized successfully');
    }
    
    return true;
    
  } catch (error) {
    console.error('LIFF init failed:', error);
    return false;
  } finally {
    ShareState.isInitializing = false;
    ShareState.liffChecked = true;
  }
}

// สร้าง Share Menu แบบ Universal
function createShareMenu(newsData) {
  const { title, url } = newsData;
  const env = detectEnvironment();
  
  // สร้าง modal element
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-end justify-center z-[100] animate-fadeIn';
  modal.id = 'shareModal';
  
  // Share options ที่จะแสดง
  const options = [];
  
  // LINE Share - แสดงทุก platform
  options.push({
    icon: '💚',
    label: 'แชร์ไปยัง LINE',
    action: 'line',
    primary: true,
    subtitle: env.isLineApp ? 'แชร์แบบ Flex Card' : 'เปิด LINE เพื่อแชร์'
  });
  
  // LINE QR Code สำหรับ Desktop
  if (env.isDesktop) {
    options.push({
      icon: '📱',
      label: 'แสดง QR Code สำหรับ LINE',
      action: 'line-qr'
    });
  }
  
  // Native Share API (ถ้า support)
  if (env.canUseShareAPI && !env.isLineApp) {
    options.push({
      icon: '📤',
      label: 'แชร์ด้วยแอปอื่น',
      action: 'native'
    });
  }
  
  // คัดลอกลิงก์ (ทุกกรณี)
  options.push({
    icon: '🔗',
    label: 'คัดลอกลิงก์',
    action: 'copy'
  });
  
  // Facebook Share
  options.push({
    icon: '📘',
    label: 'แชร์ไปยัง Facebook',
    action: 'facebook'
  });
  
  // Twitter/X Share
  options.push({
    icon: '🐦',
    label: 'แชร์ไปยัง X (Twitter)',
    action: 'twitter'
  });
  
  modal.innerHTML = `
    <div class="bg-white rounded-t-2xl w-full max-w-md p-4 animate-slideUp">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">แชร์ข่าว</h3>
        <button id="closeShareModal" class="p-2 hover:bg-gray-100 rounded-full">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l8 8M14 6l-8 8"/>
          </svg>
        </button>
      </div>
      
      <div class="space-y-2">
        ${options.map(opt => `
          <button class="share-option w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors ${opt.primary ? 'bg-green-50 hover:bg-green-100' : ''}" data-action="${opt.action}">
            <span class="text-2xl">${opt.icon}</span>
            <div class="flex-1 text-left">
              <div class="font-medium">${opt.label}</div>
              ${opt.subtitle ? `<div class="text-xs text-gray-500">${opt.subtitle}</div>` : ''}
            </div>
            ${opt.primary ? '<span class="text-xs text-green-600 font-semibold">แนะนำ</span>' : ''}
          </button>
        `).join('')}
      </div>
      
      <div class="mt-4 pt-3 border-t">
        <div class="text-xs text-gray-500 line-clamp-2">
          ${title || 'ข่าวสาร'}
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add styles if not exist
  if (!document.getElementById('shareModalStyles')) {
    const style = document.createElement('style');
    style.id = 'shareModalStyles';
    style.textContent = `
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
      .animate-slideUp { animation: slideUp 0.3s ease-out; }
    `;
    document.head.appendChild(style);
  }
  
  // Bind events
  document.getElementById('closeShareModal').onclick = () => modal.remove();
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  
  // Handle share options
  modal.querySelectorAll('.share-option').forEach(btn => {
    btn.onclick = async () => {
      const action = btn.dataset.action;
      await handleShareAction(action, newsData);
      modal.remove();
    };
  });
}

// จัดการ share actions
async function handleShareAction(action, newsData) {
  const { title, description, url, imageUrl } = newsData;
  
  switch(action) {
    case 'line':
      // พยายามใช้ LIFF ก่อน
      const liffSuccess = await shareLiffDirect(newsData);
      if (!liffSuccess) {
        // Fallback to LINE URL scheme
        const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(title + '\n' + url)}`;
        window.open(lineUrl, '_blank');
      }
      break;
      
    case 'native':
      // Use Web Share API
      try {
        await navigator.share({
          title: title,
          text: description || title,
          url: url
        });
        showShareSuccess();
      } catch(err) {
        if (err.name !== 'AbortError') {
          await copyToClipboard(url);
        }
      }
      break;
      
    case 'copy':
      await copyToClipboard(url);
      break;
      
    case 'facebook':
      const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
      window.open(fbUrl, '_blank', 'width=600,height=400');
      recordShareCount(newsData, 'facebook');
      break;
      
    case 'twitter':
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
      window.open(twitterUrl, '_blank', 'width=600,height=400');
      recordShareCount(newsData, 'twitter');
      break;
  }
}

// LIFF Share แบบ Direct
async function shareLiffDirect(newsData) {
  try {
    // Initialize LIFF ถ้ายังไม่ได้ทำ
    const liffReady = await safeLiffInit();
    if (!liffReady) {
      console.warn('LIFF not available');
      return false;
    }
    
    // ตรวจสอบว่าอยู่ใน LINE app หรือไม่
    const isInClient = window.liff.isInClient && window.liff.isInClient();
    if (!isInClient) {
      console.log('Not in LINE app, cannot use shareTargetPicker');
      return false;
    }
    
    // สร้าง Flex Message
    const flexCard = createNewsFlexCard(newsData);
    const altText = `📰 ${newsData.title || 'ข่าวสาร'}`;
    
    showShareLoading();
    
    // ใช้ shareTargetPicker
    await window.liff.shareTargetPicker([{
      type: 'flex',
      altText: altText,
      contents: flexCard
    }]);
    
    hideShareLoading();
    showShareSuccess();
    
    // บันทึก share count
    await recordShareCount(newsData, 'line');
    
    return true;
    
  } catch (error) {
    hideShareLoading();
    
    if (error.message?.includes('cancel')) {
      // User cancelled - ไม่แสดง error
      return false;
    }
    
    console.error('LIFF share failed:', error);
    return false;
  }
}

// Copy to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showShareSuccess('คัดลอกลิงก์แล้ว! 📋');
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showShareSuccess('คัดลอกลิงก์แล้ว! 📋');
  }
}

// สร้าง Flex Card สำหรับ LINE
function createNewsFlexCard(newsData) {
  const { title, description, url, imageUrl, category, publishedAt, postId } = newsData;
  
  // สร้าง LIFF URL
  const liffUrl = `https://liff.line.me/${CFG.LIFF_ID || '2006490627-nERN5a26'}`;
  const targetUrl = postId ? `${liffUrl}?post=${postId}` : url;
  
  const flexCard = {
    type: 'bubble',
    size: 'kilo'
  };
  
  // Hero image
  if (imageUrl && isValidImageUrl(imageUrl)) {
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
      text: title || 'ข่าวสาร',
      weight: 'bold',
      size: 'md',
      wrap: true
    }
  ];
  
  if (description) {
    bodyContents.push({
      type: 'text',
      text: description,
      size: 'sm',
      color: '#6b7280',
      wrap: true,
      maxLines: 2
    });
  }
  
  flexCard.body = {
    type: 'box',
    layout: 'vertical',
    contents: bodyContents,
    spacing: 'sm'
  };
  
  // Footer button
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
          uri: targetUrl
        }
      }
    ]
  };
  
  return flexCard;
}

function isValidImageUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'https:' && 
           /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(urlObj.pathname + urlObj.search);
  } catch {
    return false;
  }
}

// UI Feedback Functions
function showShareLoading() {
  hideShareLoading(); // ลบอันเก่าก่อน
  const loading = document.createElement('div');
  loading.id = 'shareLoading';
  loading.className = 'fixed top-4 left-4 right-4 z-[110] p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-sm font-medium text-center max-w-sm mx-auto';
  loading.innerHTML = `
    <div class="flex items-center justify-center gap-2">
      <span class="animate-spin">⟳</span>
      <span>กำลังแชร์...</span>
    </div>
  `;
  document.body.appendChild(loading);
}

function hideShareLoading() {
  const el = document.getElementById('shareLoading');
  if (el) el.remove();
}

function showShareSuccess(message = 'แชร์สำเร็จ! ✅') {
  hideShareLoading();
  const success = document.createElement('div');
  success.className = 'fixed top-4 left-4 right-4 z-[110] p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm font-medium text-center max-w-sm mx-auto';
  success.innerHTML = message;
  document.body.appendChild(success);
  
  setTimeout(() => success.remove(), 3000);
}

function showShareError(message) {
  hideShareLoading();
  const error = document.createElement('div');
  error.className = 'fixed top-4 left-4 right-4 z-[110] p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm text-center max-w-sm mx-auto';
  error.innerHTML = message;
  document.body.appendChild(error);
  
  setTimeout(() => error.remove(), 5000);
}

// Record share count
async function recordShareCount(newsData, platform = 'line') {
  try {
    if (!newsData.postId) return;
    
    // หา supabase
    let db = window.supabase;
    if (!db) {
      const apiModule = await import('../api.js');
      db = apiModule.supabase;
    }
    
    if (!db) return;
    
    const { data, error } = await db.rpc('increment_share', { 
      p_post_id: newsData.postId 
    });
    
    if (!error && data) {
      // Update UI
      updateShareCountInUI(newsData.postId, data);
    }
    
    console.log(`Share recorded: Post ${newsData.postId} via ${platform}`);
    
  } catch (error) {
    console.warn('Failed to record share:', error);
  }
}

function updateShareCountInUI(postId, newCount) {
  const elements = document.querySelectorAll(
    `#shareCount-${postId}, [data-post-share-count="${postId}"], span[data-share-id="${postId}"]`
  );
  
  elements.forEach(el => {
    el.textContent = `📤 ${newCount}`;
  });
}

// === Main Export Function ===
export async function shareNews(newsData) {
  if (ShareState.shareInProgress) {
    console.log('Share already in progress');
    return false;
  }
  
  ShareState.shareInProgress = true;
  
  try {
    // Validate data
    if (!newsData || !newsData.title) {
      throw new Error('ข้อมูลข่าวไม่ครบถ้วน');
    }
    
    const env = detectEnvironment();
    console.log('Share environment:', env);
    
    // ถ้าอยู่ใน LINE app และ LIFF พร้อม - ใช้ LIFF share
    if (env.isLineApp) {
      const success = await shareLiffDirect(newsData);
      if (success) {
        ShareState.shareInProgress = false;
        return true;
      }
    }
    
    // แสดง Share Menu สำหรับทุกกรณี
    createShareMenu(newsData);
    
    ShareState.shareInProgress = false;
    return true;
    
  } catch (error) {
    console.error('Share failed:', error);
    showShareError(error.message || 'ไม่สามารถแชร์ได้');
    ShareState.shareInProgress = false;
    return false;
  }
}

// Initialize LIFF on load (ไม่ block)
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // ตรวจสอบและ init LIFF แบบ background
    setTimeout(() => {
      if (window.liff && !ShareState.liffChecked) {
        safeLiffInit().then(success => {
          console.log('Background LIFF init:', success ? 'ready' : 'failed');
        });
      }
    }, 1000);
  });
}

console.log('Share module loaded - Universal version');
