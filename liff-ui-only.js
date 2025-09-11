import { LIFF_ID, PUBLIC_URL } from './config.js';
const badge=document.getElementById('userBadge'); const avatar=document.getElementById('userAvatar'); const nameEl=document.getElementById('userName');
const pfAvatar=document.getElementById('pfAvatar'); const pfName=document.getElementById('pfName');
const btnLogin=document.getElementById('btnLineLogin'); const btnLogout=document.getElementById('btnLogout'); const btnLogout2=document.getElementById('btnLogout2');
function ensureSlash(u){ return u.endsWith('/')?u:(u+'/'); }
function renderProfile(p){ badge.classList.remove('hide'); avatar.src=p?.pictureUrl||''; nameEl.textContent=p?.displayName||'LINE User'; pfAvatar.src=p?.pictureUrl||''; pfName.textContent=p?.displayName||'LINE User'; btnLogin.classList.add('hide'); btnLogout.classList.remove('hide'); }
async function init(){ try{ await liff.init({ liffId: LIFF_ID }); if(liff.isLoggedIn()){ const prof=await liff.getProfile(); renderProfile(prof); } }catch(e){ console.warn(e); } }
btnLogin.addEventListener('click', ()=>{ if(!liff.isLoggedIn()) liff.login({ redirectUri: ensureSlash(PUBLIC_URL) }); });
function doLogout(){ try{ if(liff.isLoggedIn()) liff.logout(); }catch(_){} location.replace(ensureSlash(PUBLIC_URL)); }
btnLogout.addEventListener('click', doLogout);
btnLogout2.addEventListener('click', doLogout);
init();
