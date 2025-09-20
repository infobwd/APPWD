/* liff.js (hardened) */
import { LIFF_ID, PUBLIC_URL } from './config.js';

const els = {
  badge: document.getElementById('userBadge'),
  avatar: document.getElementById('userAvatar'),
  nameEl: document.getElementById('userName'),
  pfAvatar: document.getElementById('pfAvatar'),
  pfName: document.getElementById('pfName'),
  btnLogin: document.getElementById('btnLineLogin'),
  btnLogout: document.getElementById('btnLogout'),
  btnLogout2: document.getElementById('btnLogout2'),
};

function ensureSlash(u) { return u && u.endsWith('/') ? u : (u + '/'); }
function sameOrigin(u) { try { return new URL(u).origin === location.origin; } catch { return false; } }
function saveProfile(p){ try{ localStorage.setItem('LINE_PROFILE', JSON.stringify(p||{})); }catch(e){} }
function loadProfile(){ try{ return JSON.parse(localStorage.getItem('LINE_PROFILE')||'null'); }catch(e){ return null; } }

function renderProfile(p){
  if (!p) return;
  if (els.badge) els.badge.classList.remove('hide');
  if (els.avatar) els.avatar.src = p.pictureUrl || els.avatar.src;
  if (els.nameEl) els.nameEl.textContent = p.displayName || '';
  if (els.pfAvatar) els.pfAvatar.src = p.pictureUrl || els.pfAvatar.src;
  if (els.pfName) els.pfName.textContent = p.displayName || '';
  // show logout buttons if any
  if (els.btnLogout) els.btnLogout.classList.remove('hide');
}

function forceHttpsIfNeeded(){
  if (location.protocol !== 'https:' && location.hostname !== 'localhost'){
    location.replace('https://' + location.host + location.pathname + location.search + location.hash);
  }
}

// simple retry/backoff
async function withRetry(task, { retries=2, baseDelay=500 }={}){
  let lastErr;
  for (let i=0;i<=retries;i++){
    try { return await task(); } 
    catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, baseDelay * Math.pow(2,i)));
    }
  }
  throw lastErr;
}

async function doLogin(){
  const publicUrl = ensureSlash(PUBLIC_URL);
  // ถ้า PUBLIC_URL ไม่ตรง origin ปัจจุบัน ให้ใช้ที่รันจริง
  const redirect = sameOrigin(publicUrl) ? (publicUrl + 'auth-bridge.html')
                                         : (ensureSlash(location.origin + location.pathname.replace(/[^/]*$/, '')) + 'auth-bridge.html');
  console.info('[LIFF] login redirectUri =', redirect);
  liff.login({ redirectUri: redirect });
}

function doLogout(){
  try{ if (liff.isLoggedIn()) liff.logout(); }catch(e){}
  try{ localStorage.removeItem('LINE_PROFILE'); }catch(e){}
  const publicUrl = ensureSlash(PUBLIC_URL);
  const back = sameOrigin(publicUrl) ? publicUrl : (ensureSlash(location.origin + location.pathname.replace(/[^/]*$/, '')));
  location.replace(back);
}

async function init(){
  try{
    forceHttpsIfNeeded();
    if (!LIFF_ID) throw new Error('LIFF_ID is empty');

    if (!navigator.onLine){
      console.warn('[LIFF] offline mode – render cached profile only');
      const cached = loadProfile();
      if (cached) renderProfile(cached);
      return;
    }

    // init + ready
    await withRetry(() => liff.init({
      liffId: LIFF_ID,
      withLoginOnExternalBrowser: true, // สำคัญมากเมื่อเปิดผ่านเบราว์เซอร์นอก LINE
    }), { retries: 1 });

    await liff.ready;

    // กรณีไม่ล็อกอิน
    if (!liff.isLoggedIn()){
      console.info('[LIFF] not logged in → login');
      return doLogin();
    }

    // ดึงโปรไฟล์ด้วย retry เผื่อเน็ตช้าหรือโดนบล็อคชั่วคราว
    const profile = await withRetry(() => liff.getProfile(), { retries: 2 });
    saveProfile(profile);
    renderProfile(profile);
  }catch(e){
    console.warn('[LIFF] init error:', e);
    // แสดงโปรไฟล์แคชถ้ามี เพื่อ UX ที่ไม่ดับ
    const cached = loadProfile();
    if (cached) renderProfile(cached);

    // เคสพบบ่อยช่วยชี้นำ
    // - Failed to fetch: ตรวจ origin/https/endpoint URL/บล็อคโดเมน
    const hints = [
      'ตรวจว่าเปิดผ่าน HTTPS และโดเมน/พาธตรงกับ Endpoint URL ที่ลงทะเบียนใน LIFF Console',
      'ตรวจว่าไม่ได้เปิดจากพาธ/branch อื่นของ GitHub Pages',
      'ลองปิดส่วนขยายบล็อคโฆษณา/ฟิลเตอร์เน็ตชั่วคราว',
      'DevTools > Network ดูว่าเรียก https://api.line.me/* สำเร็จหรือไม่ (CORS/blocked?)'
    ];
    console.info('[LIFF] hints:', hints);
  }
}

if (els.btnLogin){
  els.btnLogin.onclick = () => {
    try{
      if (!liff.isLoggedIn()) doLogin();
    }catch(e){
      // ถ้า liff ยังไม่ init สำเร็จ ให้ลอง init อีกรอบ
      console.warn('[LIFF] login clicked before init, retry init…');
      init();
    }
  };
}

if (els.btnLogout) els.btnLogout.onclick = doLogout;
if (els.btnLogout2) els.btnLogout2.onclick = doLogout;

document.addEventListener('DOMContentLoaded', init);
