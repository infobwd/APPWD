
// LINE share helper — tries LIFF shareTargetPicker, falls back to URI scheme
import { LIFF_ID } from '../config.js';

function loadScript(src){
  return new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = ()=> resolve();
    s.onerror = ()=> reject(new Error('Failed to load '+src));
    document.head.appendChild(s);
  });
}

async function ensureLIFF(){
  if (!window.liff) {
    await loadScript('https://static.line-scdn.net/liff/edge/2/sdk.js');
  }
  try{
    if (!window.__APPWD_LIFF_INIT__) {
      await liff.init({ liffId: LIFF_ID });
      window.__APPWD_LIFF_INIT__ = true;
    }
  }catch(e){
    // If init fails, we'll rely on fallback sharing
  }
  return window.liff;
}

export async function shareToLINE({ text, url, title } = {}){
  const msgText = text || (title ? `${title}\n${url||location.href}` : (url||location.href));
  try {
    const l = await ensureLIFF();
    if (l && l.isApiAvailable && l.isApiAvailable('shareTargetPicker')) {
      await l.shareTargetPicker([{ type:'text', text: msgText }]);
      return true;
    }
  } catch(e) {}
  // Fallback to URL intents
  const payload = encodeURIComponent(msgText);
  const intents = [
    `line://msg/text/${payload}`,
    `https://line.me/R/msg/text/?${payload}`
  ];
  for (const i of intents) {
    try { window.open(i, '_blank'); return true; } catch(e) {}
  }
  return false;
}

// Auto-bind any element with [data-share-line]
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('[data-share-line]');
  if (!btn) return;
  const text = btn.getAttribute('data-share-text') || document.title;
  const url  = btn.getAttribute('data-share-url')  || location.href;
  shareToLINE({ text, url });
  e.preventDefault();
});

// Expose global for manual calls
window.APPWD = window.APPWD || {};
window.APPWD.shareLine = shareToLINE;
