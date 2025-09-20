/* liff.js (safe, settings-aware) */

import { LIFF_ID as CFG_LIFF_ID, PUBLIC_URL } from './config.js';

// ---- optional: ดึง getSetting() ถ้ามี settings.js ----
let getSetting = null;
try {
  const mod = await import('./settings.js'); // อาจไม่มีในบางโปรเจกต์ → try/catch
  getSetting = typeof mod.getSetting === 'function' ? mod.getSetting : null;
} catch (_) { /* ignore */ }

// ---- DOM refs (ทนต่อการไม่มี element) ----
const badge    = document.getElementById('userBadge');
const avatar   = document.getElementById('userAvatar');
const nameEl   = document.getElementById('userName');
const pfAvatar = document.getElementById('pfAvatar');
const pfName   = document.getElementById('pfName');

const btnLogin  = document.getElementById('btnLineLogin');
const btnLogout = document.getElementById('btnLogout');
const btnLogout2= document.getElementById('btnLogout2');

// ---- helpers ----
function ensureSlash(u){ return u && u.endsWith('/') ? u : (u || '') + '/'; }
function saveProfile(p){ try{ localStorage.setItem('LINE_PROFILE', JSON.stringify(p||{})); }catch(e){} }
function loadProfile(){ try{ return JSON.parse(localStorage.getItem('LINE_PROFILE') || 'null'); }catch(e){ return null; } }
function clearProfile(){ try{ localStorage.removeItem('LINE_PROFILE'); }catch(e){} }

function renderProfile(p){
  if(!p) return;
  if (badge)  badge.classList.remove('hide');
  if (avatar) avatar.src = p?.pictureUrl || '';
  if (nameEl) nameEl.textContent = p?.displayName || 'LINE User';
  if (pfAvatar) pfAvatar.src = p?.pictureUrl || '';
  if (pfName)   pfName.textContent = p?.displayName || 'LINE User';
  if (btnLogin)  btnLogin.classList.add('hide');
  if (btnLogout) btnLogout.classList.remove('hide');
}

function guessRedirectBase(){
  // PUBLIC_URL มาก่อน, ไม่มีก็ใช้ origin + path root ปัจจุบัน
  if (PUBLIC_URL) return ensureSlash(PUBLIC_URL);
  try {
    const url = new URL(location.href);
    // เอา path จนถึงโฟลเดอร์โปรเจกต์ (มี index.html ไหมไม่สนใจ)
    const parts = url.pathname.split('/');
    parts.pop(); // ตัดไฟล์ออก
    return `${url.origin}${parts.join('/')}/`;
  } catch {
    return ensureSlash(location.origin);
  }
}

async function resolveLiffId(){
  // ลำดับความสำคัญ: window.__APPCFG → settings.getSetting → window.__APP_SETTINGS → config.js
  const fromCfgObj = (window.__APPCFG && window.__APPCFG.LIFF_ID) || null;
  if (fromCfgObj && String(fromCfgObj).trim()) return String(fromCfgObj).trim();

  if (getSetting) {
    try {
      const v = await getSetting('LIFF_ID');
      if (v && String(v).trim()) return String(v).trim();
    } catch (_) {}
  }

  const fromCache = (window.__APP_SETTINGS && window.__APP_SETTINGS.LIFF_ID) || null;
  if (fromCache && String(fromCache).trim()) return String(fromCache).trim();

  if (CFG_LIFF_ID && String(CFG_LIFF_ID).trim()) return String(CFG_LIFF_ID).trim();

  return null;
}

function hasLiff(){
  return typeof window !== 'undefined' && typeof window.liff !== 'undefined';
}

// ---- Core actions ----
async function doLogin(){
  if (!hasLiff()) return;
  try {
    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: guessRedirectBase() + 'auth-bridge.html' });
    }
  } catch(e) {
    console.warn('[LIFF] login error', e);
  }
}

function doLogout(){
  try {
    if (hasLiff() && liff.isLoggedIn()) liff.logout();
  } catch(_) {}
  clearProfile();
  location.replace(guessRedirectBase());
}

// ---- Init ----
async function init(){
  // แม้ไม่มี LIFF/ID ก็พยายาม render โปรไฟล์จาก cache
  const cached = loadProfile();
  if (cached) renderProfile(cached);

  // guard: ถ้า SDK ยังไม่โหลด ไม่ทำอะไร
  if (!hasLiff()) {
    console.warn('[LIFF] SDK not loaded, skip init');
    return;
  }

  // หา LIFF_ID จาก settings/config; ถ้าไม่มี → ข้ามการ init เพื่อกัน "Failed to fetch"
  const LID = await resolveLiffId();
  if (!LID) {
    console.warn('[LIFF] skip init: no LIFF_ID configured');
    return;
  }

  try {
    await liff.init({ liffId: LID });

    if (liff.isLoggedIn()) {
      const prof = await liff.getProfile();
      saveProfile(prof);
      renderProfile(prof);
    } else {
      // ยังไม่ล็อกอิน → แสดง cache ถ้ามี, โชว์ปุ่ม login
      if (!cached) {
        // ไม่มีแคช → โชว์ปุ่ม login ชัด ๆ
        if (btnLogin) btnLogin.classList.remove('hide');
      }
    }
  } catch(e) {
    // กันแอปพัง กรณี domain/LIFF_ID ยังไม่ถูกต้อง
    console.warn('[LIFF] init error', e);
  }
}

// ---- Wire buttons & global events ----
if (btnLogin)  btnLogin.onclick  = () => doLogin();
if (btnLogout) btnLogout.onclick = () => doLogout();
if (btnLogout2)btnLogout2.onclick= () => doLogout();

// รับอีเวนต์จากหน้าอื่น/โมดูลอื่น (ที่เราใช้ในหน้า #profile)
window.addEventListener('app:liff:login',  () => doLogin());
window.addEventListener('app:liff:logout', () => doLogout());

// ให้หน้า auth-bridge เรียกใช้ง่าย ๆ หลังได้ profile ใหม่
window.addEventListener('storage', (e) => {
  if (e.key === 'LINE_PROFILE') {
    try { renderProfile(JSON.parse(e.newValue || 'null')); } catch(_) {}
  }
});

// เริ่มทำงานเมื่อ DOM พร้อม
document.addEventListener('DOMContentLoaded', init);
