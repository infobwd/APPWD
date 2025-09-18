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
    
    if (!window.liff.isInitialized()) {
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
  const safeTitle = (title || 'ข่าวสาร').substring(0, 60);
  const safeDesc = description ? description.substring(0, 100) : null;
  const safeUrl = url || location.href;
  const safeImageUrl = imageUrl && isValidImageUrl(imageUrl) ? imageUrl : null;
  
  const flexCard = {
    type: 'bubble',
    size: 'kilo'
  };
  
  // เพิ่มรูปภาพถ้ามี
  if (safeImageUrl) {
    flexCard.hero = {
      type: 'image',
      url: safeImageUrl,
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
      maxLines: 3
    }
  ];
  
  if (safeDesc) {
    bodyContents.push({
      type: 'text',
      text: safeDesc,
      size: 'sm',
      color: '#6b7280',
      wrap: true,
      maxLines: 3
    });
  }
  
  // เพิ่มข้อมูลเมตา
  if (category || publishedAt) {
    bodyContents.push({ type: 'spacer', size: 'sm' });
    
    const metaText = [];
    if (category) metaText.push(category);
    if (publishedAt) {
      const date = new Date(publishedAt).toLocaleDateString('th-TH');
      metaText.push(date);
    }
    
    bodyContents.push({
      type: 'text',
      text: metaText.join(' • '),
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
  
  // ปุ่มอ่านต่อ
  flexCard.footer = {
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'button',
        style: 'primary',
        action: {
          type: 'uri',
          label: 'อ่านข่าวเต็ม',
          uri: safeUrl
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
    
    // ตรวจสอบว่าอยู่ใน LINE App และสามารถแชร์ได้
    if (liff.isInClient() && await liff.isApiAvailable('shareTargetPicker')) {
      await liff.shareTargetPicker([{
        type: 'flex',
        altText: altText,
        contents: flexCard
      }]);
      
      showShareSuccess();
      ShareState.shareInProgress = false;
      return true;
      
    } else {
      // Fallback: คัดลอกลิงก์แทน
      await copyNewsUrl(newsData.url || location.href);
      ShareState.shareInProgress = false;
      return true;
    }
    
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

console.log('News Share module loaded successfully');
