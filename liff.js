import { LIFF_ID, PUBLIC_URL } from './config.js';
const badge=document.getElementById('userBadge'); const avatar=document.getElementById('userAvatar'); const nameEl=document.getElementById('userName');
const pfAvatar=document.getElementById('pfAvatar'); const pfName=document.getElementById('pfName');
const btnLogin=document.getElementById('btnLineLogin'); const btnLogout=document.getElementById('btnLogout'); const btnLogout2=document.getElementById('btnLogout2');
function ensureSlash(u){ return u && u.endsWith('/') ? u : (u + '/'); }
function saveProfile(p){ try{ localStorage.setItem('LINE_PROFILE', JSON.stringify(p||{})); }catch(e){} }
function loadProfile(){ try{ return JSON.parse(localStorage.getItem('LINE_PROFILE')||'null'); }catch(e){ return null; } }
function renderProfile(p){ if(!p) return; if(badge) badge.classList.remove('hide'); if(avatar) avatar.src=p?.pictureUrl||''; if(nameEl) nameEl.textContent=p?.displayName||'LINE User'; if(pfAvatar) pfAvatar.src=p?.pictureUrl||''; if(pfName) pfName.textContent=p?.displayName||'LINE User'; if(btnLogin) btnLogin.classList.add('hide'); if(btnLogout) btnLogout.classList.remove('hide'); }
async function init(){ try{ await liff.init({ liffId: LIFF_ID }); if(liff.isLoggedIn()){ const prof=await liff.getProfile(); saveProfile(prof); renderProfile(prof); } else { const p=loadProfile(); if(p) renderProfile(p); } }catch(e){ console.warn(e); } }
if(btnLogin){ btnLogin.addEventListener('click', ()=>{ if(!liff.isLoggedIn()) liff.login({ redirectUri: ensureSlash(PUBLIC_URL) + 'auth-bridge.html' }); }); }
function doLogout(){ try{ if(liff.isLoggedIn()) liff.logout(); }catch(_){} localStorage.removeItem('LINE_PROFILE'); location.replace(ensureSlash(PUBLIC_URL)); }
if(btnLogout) btnLogout.addEventListener('click', doLogout);
if(btnLogout2) btnLogout2.addEventListener('click', doLogout);
window.addEventListener('storage', (e)=>{ if(e.key==='LINE_PROFILE'){ const p=loadProfile(); if(p) renderProfile(p); } });
document.addEventListener('DOMContentLoaded', init);
