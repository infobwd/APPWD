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
