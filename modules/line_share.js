/**
 * Enhanced LINE Share Module
 * ระบบแชร์ข้อมูลผ่าน LINE LIFF ที่ปรับปรุงแล้ว
 */

import * as CFG from '../config.js';

// === Enhanced State Management ===
const ShareState = {
  isLiffReady: false,
  isInitializing: false,
  liffInstance: null,
  shareInProgress: false,
  retryCount: 0,
  maxRetries: 3,
  
  // Cache for performance
  contextCache: null,
  userCache: null,
  
  // Reset method
  reset() {
    this.shareInProgress = false;
    this.retryCount = 0;
  }
};

// === Enhanced Utility Functions ===
function safeJsonStringify(obj, maxLength = 1500) {
  try {
    const jsonStr = JSON.stringify(obj || {});
    if (jsonStr.length > maxLength) {
      console.warn(`JSON payload too long: ${jsonStr.length} characters`);
      // Try to compress by removing optional fields
      const compressed = compressFlexMessage(obj);
      return JSON.stringify(compressed);
    }
    return jsonStr;
  } catch (error) {
    console.error('JSON stringify failed:', error);
    return '{}';
  }
}

function safeUrlEncode(str) {
  try {
    // Use base64 encoding for Thai characters to avoid URL length issues
    if (/[\u0E00-\u0E7F]/.test(str)) {
      return btoa(encodeURIComponent(str));
    }
    return encodeURIComponent(str);
  } catch (error) {
    console.error('URL encode failed:', error);
    return '';
  }
}

function compressFlexMessage(flexObj) {
  if (!flexObj || typeof flexObj !== 'object') return flexObj;
  
  const compressed = { ...flexObj };
  
  // Remove optional empty fields
  if (compressed.hero && !compressed.hero.url) {
    delete compressed.hero;
  }
  
  // Truncate long text
  if (compressed.body && compressed.body.contents) {
    compressed.body.contents.forEach(content => {
      if (content.type === 'text' && content.text && content.text.length > 100) {
        content.text = content.text.substring(0, 97) + '...';
      }
    });
  }
  
  return compressed;
}

// === Enhanced LIFF Management ===
async function initializeLiff(options = {}) {
  const { timeout = 10000, forceReinit = false } = options;
  
  if (ShareState.isLiffReady && !forceReinit) {
    return ShareState.liffInstance;
  }
  
  if (ShareState.isInitializing) {
    // Wait for existing initialization
    let attempts = 0;
    while (ShareState.isInitializing && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    if (ShareState.isLiffReady) {
      return ShareState.liffInstance;
    }
  }
  
  ShareState.isInitializing = true;
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      ShareState.isInitializing = false;
      reject(new Error('LIFF initialization timeout'));
    }, timeout);
    
    try {
      // Check if LIFF SDK is loaded
      if (!window.liff) {
        clearTimeout(timeoutId);
        ShareState.isInitializing = false;
        reject(new Error('LIFF SDK not loaded'));
        return;
      }
      
      const liffId = CFG?.LIFF_ID || window.LIFF_ID || '';
      if (!liffId) {
        clearTimeout(timeoutId);
        ShareState.isInitializing = false;
        reject(new Error('LIFF ID not configured'));
        return;
      }
      
      if (window.liff.isInitialized()) {
        clearTimeout(timeoutId);
        ShareState.isLiffReady = true;
        ShareState.isInitializing = false;
        ShareState.liffInstance = window.liff;
        resolve(window.liff);
        return;
      }
      
      window.liff.init({
        liffId: liffId,
        withLoginOnExternalBrowser: true
      }).then(() => {
        clearTimeout(timeoutId);
        ShareState.isLiffReady = true;
        ShareState.isInitializing = false;
        ShareState.liffInstance = window.liff;
        
        // Cache user info and context
        cacheUserAndContext();
        
        resolve(window.liff);
      }).catch((error) => {
        clearTimeout(timeoutId);
        ShareState.isInitializing = false;
        console.error('LIFF init failed:', error);
        reject(error);
      });
      
    } catch (error) {
      clearTimeout(timeoutId);
      ShareState.isInitializing = false;
      reject(error);
    }
  });
}

async function cacheUserAndContext() {
  try {
    if (ShareState.liffInstance) {
      const liff = ShareState.liffInstance;
      
      if (liff.isInClient()) {
        ShareState.contextCache = await liff.getContext();
      }
      
      if (liff.isLoggedIn()) {
        ShareState.userCache = await liff.getProfile();
      }
    }
  } catch (error) {
    console.warn('Failed to cache user/context:', error);
  }
}

// === Enhanced Flex Message Creation ===
export function createFlexNewsCard({ title, description, url, imageUrl, author, publishedAt }) {
  // Validate and sanitize inputs
  const safeTitle = (title || 'ข่าวสาร').substring(0, 40);
  const safeDesc = description ? description.substring(0, 80) : null;
  const safeUrl = url || CFG.PUBLIC_URL || location.href;
  const safeImageUrl = imageUrl && isValidImageUrl(imageUrl) ? imageUrl : null;
  
  const flexCard = {
    type: 'bubble',
    size: 'kilo'
  };
  
  // Add hero image if valid
  if (safeImageUrl) {
    flexCard.hero = {
      type: 'image',
      url: safeImageUrl,
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
  
  // Add metadata if available
  if (author || publishedAt) {
    bodyContents.push({ type: 'spacer', size: 'sm' });
    
    const metaText = [];
    if (author) metaText.push(`โดย ${author}`);
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
  
  // Footer with action button
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

export function createFlexCheckinCard({ displayName, purpose, time, location, status }) {
  const statusConfig = {
    'on_time': { text: 'ตรงเวลา', color: '#10b981' },
    'late': { text: 'สาย', color: '#f59e0b' },
    'offsite': { text: 'นอกพื้นที่', color: '#6366f1' }
  };
  
  const statusInfo = statusConfig[status] || { text: 'ไม่ระบุ', color: '#6b7280' };
  
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '✅ เช็คอินสำเร็จ',
          weight: 'bold',
          color: '#10b981',
          size: 'lg'
        },
        { type: 'spacer', size: 'md' },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'baseline',
              spacing: 'sm',
              contents: [
                { type: 'text', text: 'ชื่อ:', size: 'sm', color: '#6b7280', flex: 2 },
                { type: 'text', text: displayName || 'ไม่ระบุ', size: 'sm', flex: 5, wrap: true }
              ]
            },
            {
              type: 'box',
              layout: 'baseline',
              spacing: 'sm',
              contents: [
                { type: 'text', text: 'เวลา:', size: 'sm', color: '#6b7280', flex: 2 },
                { type: 'text', text: time || 'ไม่ระบุ', size: 'sm', flex: 5 }
              ]
            },
            {
              type: 'box',
              layout: 'baseline',
              spacing: 'sm',
              contents: [
                { type: 'text', text: 'ประเภท:', size: 'sm', color: '#6b7280', flex: 2 },
                { type: 'text', text: purpose || 'ไม่ระบุ', size: 'sm', flex: 5 }
              ]
            },
            {
              type: 'box',
              layout: 'baseline',
              spacing: 'sm',
              contents: [
                { type: 'text', text: 'สถานะ:', size: 'sm', color: '#6b7280', flex: 2 },
                { type: 'text', text: statusInfo.text, size: 'sm', color: statusInfo.color, flex: 5, weight: 'bold' }
              ]
            }
          ]
        }
      ]
    }
  };
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

// === Enhanced Share Functions ===
function showShareLoading(message = 'กำลังแชร์...') {
  const loadingEl = document.getElementById('shareLoading');
  if (loadingEl) {
    loadingEl.textContent = message;
    loadingEl.style.display = 'block';
    return;
  }
  
  const loading = document.createElement('div');
  loading.id = 'shareLoading';
  loading.className = 'fixed top-4 left-4 right-4 z-50 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-sm font-medium text-center';
  loading.innerHTML = `
    <div class="flex items-center justify-center gap-2">
      <span class="animate-spin">⟳</span>
      <span>${message}</span>
    </div>
  `;
  document.body.appendChild(loading);
}

function hideShareLoading() {
  const loadingEl = document.getElementById('shareLoading');
  if (loadingEl) {
    loadingEl.remove();
  }
}

function showShareError(message, canRetry = false) {
  hideShareLoading();
  
  const errorEl = document.createElement('div');
  errorEl.className = 'fixed top-4 left-4 right-4 z-50 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm';
  errorEl.innerHTML = `
    <div class="flex items-start gap-2">
      <span>⚠️</span>
      <div class="flex-1">
        <div class="font-medium">${message}</div>
        ${canRetry ? '<button onclick="window.retryShare()" class="mt-2 px-3 py-1 bg-red-600 text-white rounded text-xs">ลองใหม่</button>' : ''}
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

function showShareSuccess(message = 'แชร์สำเร็จ!') {
  hideShareLoading();
  
  const successEl = document.createElement('div');
  successEl.className = 'fixed top-4 left-4 right-4 z-50 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm font-medium text-center';
  successEl.innerHTML = `
    <div class="flex items-center justify-center gap-2">
      <span>✅</span>
      <span>${message}</span>
    </div>
  `;
  
  document.body.appendChild(successEl);
  
  setTimeout(() => {
    if (successEl && successEl.parentElement) {
      successEl.remove();
    }
  }, 3000);
}

export async function shareFlexMessage(altText, flexContent, options = {}) {
  const { 
    showFeedback = true, 
    retryOnFail = true,
    fallbackUrl = null 
  } = options;
  
  if (ShareState.shareInProgress) {
    if (showFeedback) {
      showShareError('กำลังดำเนินการแชร์อยู่ กรุณารอสักครู่');
    }
    return false;
  }
  
  ShareState.shareInProgress = true;
  
  try {
    if (showFeedback) {
      showShareLoading('กำลังเตรียมการแชร์...');
    }
    
    // Validate flex message
    if (!flexContent || !flexContent.type) {
      throw new Error('ข้อมูล Flex Message ไม่ถูกต้อง');
    }
    
    // Initialize LIFF
    const liff = await initializeLiff();
    
    if (showFeedback) {
      showShareLoading('กำลังตรวจสอบสภาพแวดล้อม...');
    }
    
    // Check if in LINE client and API is available
    const isInClient = liff.isInClient();
    const canShare = isInClient && await liff.isApiAvailable('shareTargetPicker');
    
    if (canShare) {
      if (showFeedback) {
        showShareLoading('กำลังเปิดหน้าต่างแชร์...');
      }
      
      await liff.shareTargetPicker([{
        type: 'flex',
        altText: altText || 'แชร์จาก APPWD',
        contents: flexContent
      }]);
      
      if (showFeedback) {
        showShareSuccess('แชร์สำเร็จ!');
      }
      
      ShareState.reset();
      return true;
      
    } else {
      // Fallback to deep link
      return await fallbackToDeepLink(altText, flexContent, fallbackUrl, showFeedback);
    }
    
  } catch (error) {
    console.error('Share failed:', error);
    ShareState.reset();
    
    let errorMessage = 'ไม่สามารถแชร์ได้';
    
    if (error.message?.includes('User cancel')) {
      if (showFeedback) {
        hideShareLoading();
      }
      return false;
    } else if (error.message?.includes('network')) {
      errorMessage = 'ปัญหาการเชื่อมต่อ กรุณาตรวจสอบอินเทอร์เน็ต';
    } else if (error.message?.includes('LIFF')) {
      errorMessage = 'ไม่สามารถเชื่อมต่อ LINE ได้ กรุณาเปิดใน LINE app';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'การแชร์ใช้เวลานานเกินไป กรุณาลองใหม่';
    }
    
    if (showFeedback) {
      showShareError(errorMessage, retryOnFail && ShareState.retryCount < ShareState.maxRetries);
    }
    
    // Auto retry logic
    if (retryOnFail && ShareState.retryCount < ShareState.maxRetries) {
      ShareState.retryCount++;
      setTimeout(() => {
        shareFlexMessage(altText, flexContent, options);
      }, 2000);
    }
    
    return false;
  }
}

async function fallbackToDeepLink(altText, flexContent, customUrl, showFeedback) {
  try {
    if (showFeedback) {
      showShareLoading('กำลังสร้างลิงก์แชร์...');
    }
    
    const payload = { altText, bubble: flexContent };
    const encodedPayload = safeUrlEncode(safeJsonStringify(payload));
    
    if (encodedPayload.length > 1800) {
      throw new Error('ข้อมูลมีขนาดใหญ่เกินไป');
    }
    
    const liffId = CFG?.LIFF_ID || window.LIFF_ID || '';
    const deepLink = customUrl || `https://liff.line.me/${liffId}?flexShare=${encodedPayload}`;
    
    if (showFeedback) {
      showShareLoading('กำลังเปิด LINE...');
    }
    
    // Try to open in LINE app
    window.location.href = deepLink;
    
    // Fallback notification
    setTimeout(() => {
      if (showFeedback) {
        showShareError('หาก LINE ไม่เปิดขึ้น กรุณาคัดลอกลิงก์และแชร์ด้วยตนเอง', false);
      }
    }, 3000);
    
    return true;
    
  } catch (error) {
    console.error('Deep link fallback failed:', error);
    
    if (showFeedback) {
      showShareError('ไม่สามารถสร้างลิงก์แชร์ได้ กรุณาลองใหม่', false);
    }
    
    return false;
  }
}
// === Convenience Share Functions ===
export async function sharePost(postData, options = {}) {
  const { 
    title, 
    description, 
    url, 
    imageUrl, 
    author, 
    publishedAt,
    customAltText 
  } = postData;
  
  try {
    const flexCard = createFlexNewsCard({
      title,
      description, 
      url,
      imageUrl,
      author,
      publishedAt
    });
    
    const altText = customAltText || `📰 ${title || 'ข่าวสาร'}`;
    
    return await shareFlexMessage(altText, flexCard, options);
    
  } catch (error) {
    console.error('Share post failed:', error);
    if (options.showFeedback !== false) {
      showShareError('ไม่สามารถแชร์ข่าวได้ กรุณาลองใหม่');
    }
    return false;
  }
}

export async function shareCheckin(checkinData, options = {}) {
  const {
    displayName,
    purpose,
    time,
    location,
    status,
    customAltText
  } = checkinData;
  
  try {
    const flexCard = createFlexCheckinCard({
      displayName,
      purpose,
      time,
      location,
      status
    });
    
    const altText = customAltText || `✅ ${displayName || 'ผู้ใช้'} เช็คอินแล้ว`;
    
    return await shareFlexMessage(altText, flexCard, options);
    
  } catch (error) {
    console.error('Share checkin failed:', error);
    if (options.showFeedback !== false) {
      showShareError('ไม่สามารถแชร์เช็คอินได้ กรุณาลองใหม่');
    }
    return false;
  }
}

export async function shareText(text, options = {}) {
  const { showFeedback = true } = options;
  
  if (ShareState.shareInProgress) {
    if (showFeedback) {
      showShareError('กำลังดำเนินการแชร์อยู่ กรุณารอสักครู่');
    }
    return false;
  }
  
  ShareState.shareInProgress = true;
  
  try {
    if (showFeedback) {
      showShareLoading('กำลังแชร์ข้อความ...');
    }
    
    const liff = await initializeLiff();
    
    const isInClient = liff.isInClient();
    const canSendMessages = isInClient && await liff.isApiAvailable('sendMessages');
    
    if (canSendMessages) {
      await liff.sendMessages([{
        type: 'text',
        text: text
      }]);
      
      if (showFeedback) {
        showShareSuccess('แชร์ข้อความสำเร็จ!');
      }
      
      ShareState.reset();
      return true;
      
    } else {
      // Fallback to LINE URL scheme
      const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
      window.location.href = lineUrl;
      
      ShareState.reset();
      return true;
    }
    
  } catch (error) {
    console.error('Share text failed:', error);
    ShareState.reset();
    
    if (showFeedback) {
      showShareError('ไม่สามารถแชร์ข้อความได้');
    }
    
    return false;
  }
}

export async function shareUrl(url, text = '', options = {}) {
  const { showFeedback = true } = options;
  
  try {
    const shareText = text ? `${text}\n${url}` : url;
    return await shareText(shareText, { showFeedback });
    
  } catch (error) {
    console.error('Share URL failed:', error);
    if (showFeedback) {
      showShareError('ไม่สามารถแชร์ลิงก์ได้');
    }
    return false;
  }
}

// === Enhanced Environment Detection ===
export function getShareCapabilities() {
  return new Promise(async (resolve) => {
    try {
      const liff = await initializeLiff({ timeout: 5000 });
      
      const capabilities = {
        isLiffReady: true,
        isInClient: liff.isInClient(),
        isLoggedIn: liff.isLoggedIn(),
        canShareTargetPicker: false,
        canSendMessages: false,
        context: ShareState.contextCache,
        user: ShareState.userCache
      };
      
      if (capabilities.isInClient) {
        capabilities.canShareTargetPicker = await liff.isApiAvailable('shareTargetPicker');
        capabilities.canSendMessages = await liff.isApiAvailable('sendMessages');
      }
      
      resolve(capabilities);
      
    } catch (error) {
      console.warn('Failed to get share capabilities:', error);
      resolve({
        isLiffReady: false,
        isInClient: false,
        isLoggedIn: false,
        canShareTargetPicker: false,
        canSendMessages: false,
        context: null,
        user: null,
        error: error.message
      });
    }
  });
}

export function isOnline() {
  return navigator.onLine;
}

export function waitForOnline(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (navigator.onLine) {
      resolve(true);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      window.removeEventListener('online', onOnline);
      reject(new Error('Network timeout'));
    }, timeout);
    
    const onOnline = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('online', onOnline);
      resolve(true);
    };
    
    window.addEventListener('online', onOnline);
  });
}

// === Retry Mechanism ===
window.retryShare = async function() {
  const loadingEl = document.getElementById('shareLoading');
  if (loadingEl) loadingEl.remove();
  
  const errorEls = document.querySelectorAll('[class*="bg-red-50"]');
  errorEls.forEach(el => el.remove());
  
  if (window.lastShareData && window.lastShareFunction) {
    await window.lastShareFunction(window.lastShareData);
  } else {
    showShareError('ไม่พบข้อมูลการแชร์ กรุณาลองแชร์ใหม่', false);
  }
};

// Store last share attempt for retry
function storeLastShare(func, data) {
  window.lastShareFunction = func;
  window.lastShareData = data;
}

// === Share Analytics (Optional) ===
function trackShareEvent(type, success, error = null) {
  try {
    // Simple analytics - can be extended
    const event = {
      type: 'share',
      shareType: type,
      success: success,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: location.href
    };
    
    if (error) {
      event.error = error.message || 'Unknown error';
    }
    
    // Store in localStorage for basic analytics
    const analytics = JSON.parse(localStorage.getItem('APPWD_SHARE_ANALYTICS') || '[]');
    analytics.push(event);
    
    // Keep only last 100 events
    if (analytics.length > 100) {
      analytics.splice(0, analytics.length - 100);
    }
    
    localStorage.setItem('APPWD_SHARE_ANALYTICS', JSON.stringify(analytics));
    
    // Send to external analytics if configured
    if (window.gtag) {
      window.gtag('event', 'share', {
        event_category: 'social',
        event_label: type,
        value: success ? 1 : 0
      });
    }
    
  } catch (error) {
    console.warn('Analytics tracking failed:', error);
  }
}

// === Auto Share URL Handler ===
(async function handleAutoShare() {
  try {
    const urlParams = new URLSearchParams(location.search);
    const flexSharePayload = urlParams.get('flexShare');
    
    if (!flexSharePayload) return;
    
    // Show loading immediately
    showShareLoading('กำลังเตรียมการแชร์...');
    
    let shareData;
    try {
      // Try to decode as base64 first (for Thai characters)
      if (!/[\u0E00-\u0E7F]/.test(flexSharePayload)) {
        try {
          const decoded = atob(flexSharePayload);
          shareData = JSON.parse(decodeURIComponent(decoded));
        } catch (e) {
          // Fallback to direct decode
          shareData = JSON.parse(decodeURIComponent(flexSharePayload));
        }
      } else {
        shareData = JSON.parse(decodeURIComponent(flexSharePayload));
      }
    } catch (error) {
      throw new Error('ข้อมูลการแชร์ไม่ถูกต้อง');
    }
    
    // Initialize LIFF
    const liff = await initializeLiff({ timeout: 8000 });
    
    showShareLoading('กำลังตรวจสอบสภาพแวดล้อม...');
    
    const isInClient = liff.isInClient();
    const canShare = isInClient && await liff.isApiAvailable('shareTargetPicker');
    
    if (canShare) {
      showShareLoading('กำลังเปิดหน้าต่างแชร์...');
      
      await liff.shareTargetPicker([{
        type: 'flex',
        altText: shareData.altText || 'แชร์จาก APPWD',
        contents: shareData.bubble || shareData.flexContent
      }]);
      
      showShareSuccess('แชร์สำเร็จ!');
      
      // Clean up URL
      const newUrl = new URL(location.href);
      newUrl.searchParams.delete('flexShare');
      history.replaceState({}, document.title, newUrl.toString());
      
      // Close after delay if in LIFF
      setTimeout(() => {
        if (liff.isInClient()) {
          try {
            liff.closeWindow();
          } catch (e) {
            // Fallback close
            window.close();
          }
        }
      }, 2000);
      
      trackShareEvent('flex_auto', true);
      
    } else {
      throw new Error('ไม่สามารถแชร์ได้ กรุณาเปิดใน LINE app');
    }
    
  } catch (error) {
    console.error('Auto share failed:', error);
    
    let errorMessage = 'การแชร์ไม่สำเร็จ';
    
    if (error.message?.includes('timeout')) {
      errorMessage = 'การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่';
    } else if (error.message?.includes('LINE app')) {
      errorMessage = 'กรุณาเปิดลิงก์นี้ใน LINE app เพื่อแชร์';
    } else if (error.message?.includes('ข้อมูล')) {
      errorMessage = error.message;
    }
    
    showShareError(errorMessage, false);
    
    trackShareEvent('flex_auto', false, error);
    
    // Show alternative options
    setTimeout(() => {
      showAlternativeShareOptions();
    }, 3000);
  }
})();

function showAlternativeShareOptions() {
  const alternativeEl = document.createElement('div');
  alternativeEl.className = 'fixed top-4 left-4 right-4 z-50 p-4 bg-white border border-gray-200 rounded-lg shadow-lg';
  alternativeEl.innerHTML = `
    <div class="text-center space-y-3">
      <div class="font-medium">ตัวเลือกอื่น</div>
      <div class="grid grid-cols-2 gap-2 text-sm">
        <button onclick="window.copyCurrentUrl()" class="btn btn-sm bg-blue-500 text-white">
          คัดลอกลิงก์
        </button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()" class="btn btn-sm">
          ปิด
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(alternativeEl);
}

window.copyCurrentUrl = function() {
  try {
    navigator.clipboard.writeText(location.href).then(() => {
      showShareSuccess('คัดลอกลิงก์สำเร็จ!');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = location.href;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showShareSuccess('คัดลอกลิงก์สำเร็จ!');
    });
  } catch (error) {
    showShareError('ไม่สามารถคัดลอกลิงก์ได้');
  }
};

// === Global Share Interface ===
window.LINE_SHARE = {
  // Core functions
  shareFlexMessage,
  sharePost,
  shareCheckin,
  shareText,
  shareUrl,
  
  // Flex creators
  createFlexNewsCard,
  createFlexCheckinCard,
  
  // Utilities
  getShareCapabilities,
  isOnline,
  waitForOnline,
  
  // State
  getState: () => ({ ...ShareState }),
  reset: () => ShareState.reset(),
  
  // Enhanced wrapper functions
  async shareNewsPost(postData) {
    storeLastShare(this.sharePost, postData);
    return await this.sharePost(postData, { 
      showFeedback: true,
      retryOnFail: true
    });
  },
  
  async shareCheckinSuccess(checkinData) {
    storeLastShare(this.shareCheckin, checkinData);
    return await this.shareCheckin(checkinData, {
      showFeedback: true,
      retryOnFail: true
    });
  },
  
  async quickShare(type, data) {
    switch(type) {
      case 'post':
      case 'news':
        return await this.shareNewsPost(data);
      case 'checkin':
        return await this.shareCheckinSuccess(data);
      case 'text':
        return await this.shareText(data.text || data, { showFeedback: true });
      case 'url':
        return await this.shareUrl(data.url || data, data.text, { showFeedback: true });
      default:
        console.warn('Unknown share type:', type);
        return false;
    }
  }
};

// === CSS Injection for Share UI ===
(function injectShareStyles() {
  try {
    const style = document.createElement('style');
    style.id = 'line-share-styles';
    style.textContent = `
      /* LINE Share Enhanced Styles */
      #shareLoading,
      .share-notification {
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        animation: slideInDown 0.3s ease-out;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      }
      
      @keyframes slideInDown {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      
      .btn-sm {
        padding: 0.375rem 0.75rem;
        font-size: 0.875rem;
        border-radius: 0.375rem;
        border: 1px solid transparent;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      
      .btn-sm:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      }
      
      .btn-sm:active {
        transform: translateY(0);
      }
      
      @media (max-width: 640px) {
        .share-notification {
          left: 0.5rem;
          right: 0.5rem;
          top: 0.5rem;
        }
      }
    `;
    
    const existing = document.getElementById('line-share-styles');
    if (existing) existing.remove();
    
    document.head.appendChild(style);
  } catch (error) {
    console.warn('Share styles injection failed:', error);
  }
})();

// === Event Listeners ===
document.addEventListener('DOMContentLoaded', () => {
  // Pre-initialize LIFF in background if possible
  if (window.liff && !ShareState.isLiffReady) {
    initializeLiff({ timeout: 5000 }).catch(() => {
      // Silent fail - will retry when needed
    });
  }
});

// Handle network changes
window.addEventListener('online', () => {
  if (ShareState.shareInProgress) {
    showShareLoading('การเชื่อมต่อกลับมาแล้ว กำลังดำเนินการต่อ...');
  }
});

window.addEventListener('offline', () => {
  if (ShareState.shareInProgress) {
    showShareError('การเชื่อมต่ออินเทอร์เน็ตขาดหาย กรุณาตรวจสอบการเชื่อมต่อ', true);
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  ShareState.reset();
  hideShareLoading();
});

console.log('Enhanced LINE Share module loaded successfully');
