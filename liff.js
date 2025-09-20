/* liff.js (v565) — safe init, no LIFF errors */

import { LIFF_ID as CFG_LIFF_ID, PUBLIC_URL } from './config.js';

// ---------- optional: settings.getSetting ----------
async function tryGetSetting(key) {
  try {
    const mod = await import('./settings.js'); // อาจไม่มีในโปรเจกต์
    if (typeof mod.getSetting === 'function') {
      return await mod.getSetting(key);
    }
  } catch (_) {}
  // เผื่อค่าค้างในแคช global
  if (window.__APP_SETTINGS && key in window.__APP_SETTINGS) {
    return window.__APP_SETTINGS[key];
  }
  return null;
}

// ---------- DOM refs ----------
const badge    = document.getElementById('userBadge');
const avatar   = document.getElementById('userAvatar');
const nameEl   = document.getElementById('userName');
const pfAvatar = document.getElementById('pfAvatar');
const pfName   = document.getElementById('pfName');

const btnLogin   = document.getElementById('btnLineLogin');
const btnLogout  = document.getElementById('btnLogout');
const btnLogout2 = document.getElementById('btnLogout2');

// ---------- helpers ----------
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
  if (PUBLIC_URL) return ensureSlash(PUBLIC_URL);
  try {
    const url = new URL(location.href);
    const parts = url.pathname.split('/');
    if (parts[parts.length-1].includes('.')) parts.pop(); // ตัดไฟล์ท้าย path ถ้ามี
    return `${url.origin}${parts.join('/')}/`;
  } catch { return ensureSlash(location.origin); }
}

function hasLiff(){ return typeof window !== 'undefined' && typeof window.liff !== 'undefined'; }

async function resolveLiffId(){
  // ลำดับ: window.__APPCFG → settings.getSetting → window.__APP_SETTINGS → config.js
  const cfgObj = (window.__APPCFG && window.__APPCFG.LIFF_ID) ? String(window.__APPCFG.LIFF_ID).trim() : '';
  if (cfgObj) return cfgObj;

  const s = await tryGetSetting('LIFF_ID');
  if (s && String(s).trim()) return String(s).trim();

  const cached = (window.__APP_SETTINGS && window.__APP_SETTINGS.LIFF_ID) ? String(window.__APP_SETTINGS.LIFF_ID).trim() : '';
  if (cached) return cached;

  if (CFG_LIFF_ID && String(CFG_LIFF_ID).trim()) return String(CFG_LIFF_ID).trim();

  return null;
}

// ---------- LIFF init gate ----------
let liffInitPromise = null;
let liffReady = false;
let resolvedLiffId = null;

async function ensureLiffReady() {
  if (!hasLiff()) {
    console.warn('[LIFF] SDK not loaded, skip');
    return false;
  }
  if (liffReady) return true;

  if (!liffInitPromise) {
    resolvedLiffId = await resolveLiffId();
    if (!resolvedLiffId) {
      console.warn('[LIFF] no LIFF_ID configured. Set it in settings first.');
      return false;
    }
    liffInitPromise = (async () => {
      try {
        await liff.init({ liffId: resolvedLiffId });
        liffReady = true;
        return true;
      } catch (e) {
        console.warn('[LIFF] init error', e);
        liffReady = false;
        liffInitPromise = null; // allow retry
        return false;
      }
    })();
  }
  return await liffInitPromise;
}

// ---------- Actions ----------
async function doLogin(){
  const ok = await ensureLiffReady();
  if (!ok) {
    alert('ยังไม่ได้ตั้งค่า LIFF_ID กรุณาเปิดหน้าโปรไฟล์แล้วกรอกค่าที่ "ค่าระบบ (ปลอดภัย)".');
    if (!location.hash.includes('profile')) location.hash = '#profile';
    return;
  }
  try {
    if (liff.isLoggedIn()) return; // ไม่ต้องทำอะไร
    liff.login({ redirectUri: guessRedirectBase() + 'auth-bridge.html' });
  } catch(e) {
    console.warn('[LIFF] login error', e);
  }
}

async function maybeGetProfile(){
  try {
    const ok = await ensureLiffReady();
    if (!ok) return;
    if (liff.isLoggedIn()) {
      const prof = await liff.getProfile();
      saveProfile(prof);
      renderProfile(prof);
    }
  } catch(e) {
    console.warn('[LIFF] getProfile error', e);
  }
}

function doLogout(){
  try { if (hasLiff() && liffReady && liff.isLoggedIn()) liff.logout(); } catch(_){}
  clearProfile();
  location.replace(guessRedirectBase());
}

// ---------- Init ----------
async function init(){
  // เรนเดอร์จาก cache ก่อน เพื่อไม่ให้หน้าโล่ง
  const cached = loadProfile();
  if (cached) renderProfile(cached);

  // พยายามเตรียม LIFF แต่ถ้าไม่มี LIFF_ID จะข้ามอย่างนุ่มนวล
  await maybeGetProfile();

  // โชว์ปุ่มล็อกอินถ้ายังไม่ล็อกอินและไม่มี cache
  if (!cached && btnLogin) btnLogin.classList.remove('hide');
}

// ---------- Wire buttons & events ----------
if (btnLogin)   btnLogin.onclick  = () => doLogin();
if (btnLogout)  btnLogout.onclick = () => doLogout();
if (btnLogout2) btnLogout2.onclick= () => doLogout();

window.addEventListener('app:liff:login',  () => doLogin());
window.addEventListener('app:liff:logout', () => doLogout());

// auth-bridge อัปเดตโปรไฟล์ผ่าน localStorage
window.addEventListener('storage', (e) => {
  if (e.key === 'LINE_PROFILE') {
    try { renderProfile(JSON.parse(e.newValue || 'null')); } catch(_) {}
  }
});

document.addEventListener('DOMContentLoaded', init);
