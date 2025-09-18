/**
 * Simplified News Share Module
 * ระบบแชร์ข่าวแบบเฉพาะเจาะจง
 */

import * as CFG from '../config.js';

// === Simple State Management ===
const ShareState = {
  isLiffReady: false,
  isInitializing: false,
  shareInProgress: false
};

// === Utility Functions ===
function safeJsonStringify(obj) {
  try {
    return JSON.stringify(obj || {});
  } catch (error) {
    console.error('JSON stringify failed:', error);
    return '{}';
  }
}

function safeUrlEncode(str) {
  try {
    return encodeURIComponent(str);
  } catch (error) {
    console.error('URL encode failed:', error);
    return '';
  }
}

// === LIFF Management ===
async function initializeLiff() {
  if (ShareState.isLiffReady) {
    return window.liff;
  }
  
  if (ShareState.isInitializing) {
    // รออีกครั้งถ้ากำลัง initialize อยู่
    await new Promise(resolve => setTimeout(resolve, 1000));
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
    if (!window.liff.getOS) {
      await window.liff.init({ liffId });
    }
    
    ShareState.isLiffReady = true;
    ShareState.isInitializing = false;
    return window.liff;
    
  } catch (error) {
    ShareState.isInitializing = false;
    console.error('LIFF init failed:', error);
    throw error;
  }
}

// === News Flex Message Creator ===
function createNewsFlexCard({ title, description, url, imageUrl, category, publishedAt }) {
  // Validate และทำความสะอาดข้อมูล
  const safeTitle = (title || 'ข่าวสาร').replace(/[^\u0E00-\u0E7F\w\s\-.,!?()]/g, '').substring(0, 60);
  const safeDesc = description ? description.replace(/[^\u0E00-\u0E7F\w\s\-.,!?()]/g, '').substring(0, 100) : null;
  const safeUrl = url || location.href;
  const safeCategory = (category || 'ทั่วไป').replace(/[^\u0E00-\u0E7F\w\s\-]/g, '').substring(0, 20);
  
  // ตรวจสอบ URL รูปภาพอย่างเข้มงวด
  let validImageUrl = null;
  if (imageUrl) {
    try {
      const urlObj = new URL(imageUrl);
      if (urlObj.protocol === 'https:' && 
          /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(urlObj.pathname + urlObj.search)) {
        validImageUrl = imageUrl;
      }
    } catch (e) {
      console.warn('Invalid image URL:', imageUrl);
    }
  }
  
  // สร้าง Flex Card แบบ minimal
  const flexCard = {
    type: 'bubble',
    size: 'kilo'
  };
  
  // เพิ่มรูปภาพเฉพาะถ้า validate ผ่าน
  if (validImageUrl) {
    flexCard.hero = {
      type: 'image',
      url: validImageUrl,
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover'
    };
  }
  
  // เนื้อหาหลัก - ใช้ข้อมูลน้อยที่สุด
  const bodyContents = [
    {
      type: 'text',
      text: safeTitle,
      weight: 'bold',
      size: 'md',
      wrap: true
    }
  ];
  
  // เพิ่ม description เฉพาะถ้ามีและไม่ใช่ข้อความว่าง
  if (safeDesc && safeDesc.trim()) {
    bodyContents.push({
      type: 'text',
      text: safeDesc,
      size: 'sm',
      color: '#6b7280',
      wrap: true
    });
  }
  
  // เพิ่มข้อมูล meta อย่างง่าย
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
    } catch (e) {
      // Skip date if invalid
    }
  }
  
  if (metaParts.length > 0) {
    bodyContents.push({
      type: 'text',
      text: metaParts.join(' • '),
      size: 'xs',
      color: '#9ca3af'
    });
  }
  
  flexCard.body = {
    type: 'box',
    layout: 'vertical',
    contents: bodyContents,
    spacing: 'sm'
  };
  
  // ปุ่มแบบง่าย - ใช้ LIFF URL
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
          uri: `https://liff.line.me/2006490627-nERN5a26?post=${post.id}`
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
           /\.(jpg|jpeg|png|gif|webp)$/i.test(urlObj.pathname);
  } catch {
    return false;
  }
}

// === UI Feedback Functions ===
function showShareLoading() {
  const loading = document.createElement('div');
  loading.id = 'shareLoading';
  loading.className = 'fixed top-4 left-4 right-4 z-50 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-sm font-medium text-center';
  loading.innerHTML = `
    <div class="flex items-center justify-center gap-2">
      <span class="animate-spin">⟳</span>
      <span>กำลังแชร์...</span>
    </div>
  `;
  document.body.appendChild(loading);
}

function hideShareLoading() {
  const loadingEl = document.getElementById('shareLoading');
  if (loadingEl) loadingEl.remove();
}

function showShareSuccess() {
  hideShareLoading();
  const successEl = document.createElement('div');
  successEl.className = 'fixed top-4 left-4 right-4 z-50 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm font-medium text-center';
  successEl.innerHTML = `
    <div class="flex items-center justify-center gap-2">
      <span>✅</span>
      <span>แชร์สำเร็จ!</span>
    </div>
  `;
  document.body.appendChild(successEl);
  
  setTimeout(() => {
    if (successEl && successEl.parentElement) {
      successEl.remove();
    }
  }, 3000);
}

function showShareError(message) {
  hideShareLoading();
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
  
  setTimeout(() => {
    if (errorEl && errorEl.parentElement) {
      errorEl.remove();
    }
  }, 5000);
}

// === Main Share Function ===
export async function shareNews(newsData) {
  if (ShareState.shareInProgress) {
    showShareError('กำลังดำเนินการแชร์อยู่ กรุณารอสักครู่');
    return false;
  }
  
  ShareState.shareInProgress = true;
  
  try {
    showShareLoading();
    
    // ตรวจสอบข้อมูลข่าว
    if (!newsData || !newsData.title) {
      throw new Error('ข้อมูลข่าวไม่ครบถ้วน');
    }
    
    // สร้าง Flex Message
    const flexCard = createNewsFlexCard(newsData);
    const altText = `📰 ${newsData.title}`;
    
    // Initialize LIFF
    const liff = await initializeLiff();
    
    // พยายามแชร์ด้วย shareTargetPicker ก่อน (ไม่ตรวจสอบ isInClient)
    try {
      // ตรวจสอบว่า API มีอยู่หรือไม่
      if (typeof liff.shareTargetPicker === 'function') {
        await liff.shareTargetPicker([{
          type: 'flex',
          altText: altText,
          contents: flexCard
        }]);
        
        showShareSuccess();
        ShareState.shareInProgress = false;
        return true;
      }
    } catch (shareError) {
      console.warn('shareTargetPicker failed:', shareError);
      // ถ้า shareTargetPicker ไม่ได้ ให้ลอง fallback
    }
    
    // Fallback: พยายามใช้ sendMessages
    try {
      if (typeof liff.sendMessages === 'function') {
        await liff.sendMessages([{
          type: 'flex',
          altText: altText,
          contents: flexCard
        }]);
        
        showShareSuccess();
        ShareState.shareInProgress = false;
        return true;
      }
    } catch (sendError) {
      console.warn('sendMessages failed:', sendError);
    }
    
    // Fallback สุดท้าย: คัดลอกลิงก์
    await copyNewsUrl(newsData.url || location.href);
    ShareState.shareInProgress = false;
    return true;
    
  } catch (error) {
    console.error('Share failed:', error);
    ShareState.shareInProgress = false;
    
    let errorMessage = 'ไม่สามารถแชร์ข่าวได้';
    
    if (error.message?.includes('User cancel')) {
      hideShareLoading();
      return false;
    } else if (error.message?.includes('LIFF')) {
      errorMessage = 'กรุณาเปิดใน LINE app เพื่อแชร์';
    } else if (error.message?.includes('ข้อมูล')) {
      errorMessage = error.message;
    }
    
    showShareError(errorMessage);
    return false;
  }
}

// === Fallback Copy Function ===
async function copyNewsUrl(url) {
  try {
    await navigator.clipboard.writeText(url);
    showShareSuccess('คัดลอกลิงก์สำเร็จ! สามารถแชร์ได้แล้ว');
  } catch (error) {
    // Fallback สำหรับเบราว์เซอร์เก่า
    const textArea = document.createElement('textarea');
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showShareSuccess('คัดลอกลิงก์สำเร็จ! สามารถแชร์ได้แล้ว');
  }
}

// === Global Interface ===
window.shareNewsPost = async function(postId) {
  try {
    // ดึงข้อมูลข่าวจากฐานข้อมูล (ต้องมี supabase)
    if (!window.supabase) {
      throw new Error('ไม่พบระบบฐานข้อมูล');
    }
    
    const { data: post, error } = await window.supabase
      .from('posts')
      .select('id,title,body,category,cover_url,published_at')
      .eq('id', postId)
      .maybeSingle();
    
    if (error || !post) {
      throw new Error('ไม่พบข่าวที่ต้องการแชร์');
    }
    
    // สร้าง URL สำหรับข่าว
    const baseUrl = localStorage.getItem('APPWD_PUBLIC_URL') || './';
    const newsUrl = `${baseUrl}index.html#post?id=${post.id}`;
    
    // สร้างคำอธิบายสั้น ๆ จาก body
    let description = '';
    if (post.body) {
      // ลบ Markdown syntax และตัด text สั้น ๆ
      const plainText = post.body.replace(/[#*\[\]()]/g, '').trim();
      description = plainText.substring(0, 80);
      if (plainText.length > 80) description += '...';
    }
    
    // เตรียมข้อมูลสำหรับแชร์
    const newsData = {
      title: post.title,
      description: description,
      url: newsUrl,
      imageUrl: post.cover_url,
      category: post.category,
      publishedAt: post.published_at
    };
    
    return await shareNews(newsData);
    
  } catch (error) {
    console.error('Share news post failed:', error);
    showShareError(error.message || 'ไม่สามารถแชร์ข่าวได้');
    return false;
  }
};

// === Alternative Simple Function ===
window.shareNewsSimple = async function(title, url) {
  const newsData = {
    title: title || 'ข่าวสาร',
    url: url || location.href
  };
  
  return await shareNews(newsData);
};

// === Export for compatibility ===
export { shareNews as sharePostData };

// === Alternative LIFF-based Share ===
export async function shareLiffDirect(newsData) {
  try {
    // ตรวจสอบ LIFF SDK
    if (!window.liff) {
      throw new Error('LIFF SDK not available');
    }
    
    // Initialize ถ้ายังไม่ได้
    if (!window.liff.getOS) {
      const liffId = window.LIFF_ID || '';
      if (!liffId) {
        throw new Error('LIFF ID not configured');
      }
      await window.liff.init({ liffId });
    }
    
    // สร้าง Flex Message
    const flexCard = createNewsFlexCard(newsData);
    const altText = `📰 ${newsData.title || 'ข่าวสาร'}`;
    
    showShareLoading();
    
    // แชร์ด้วย LIFF API โดยตรง
    await window.liff.shareTargetPicker([{
      type: 'flex',
      altText: altText,
      contents: flexCard
    }]);
    
    showShareSuccess();
    return true;
    
  } catch (error) {
    console.error('LIFF share failed:', error);
    hideShareLoading();
    
    // Fallback: คัดลอกลิงก์
    if (newsData.url) {
      try {
        await copyNewsUrl(newsData.url);
        return true;
      } catch (copyError) {
        showShareError('ไม่สามารถแชร์ได้ กรุณาลองใหม่');
        return false;
      }
    } else {
      showShareError('ไม่สามารถแชร์ได้ กรุณาเปิดใน LINE app');
      return false;
    }
  }
}

console.log('LINE Share module loaded successfully');
