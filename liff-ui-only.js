import { LIFF_ID, PUBLIC_URL } from './config.js';
const badge = document.getElementById('userBadge');
const avatar = document.getElementById('userAvatar');
const nameEl = document.getElementById('userName');
const btnLogin = document.getElementById('btnLineLogin');
const btnLogout = document.getElementById('btnLogout');
function renderProfile(p){
  badge.classList.remove('hide');
  avatar.src = p?.pictureUrl || 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><circle cx=%2220%22 cy=%2220%22 r=%2218%22 fill=%22%23E9F3FF%22 stroke=%22%23D5E5FF%22/><circle cx=%2220%22 cy=%2216%22 r=%227%22 fill=%22%23CBE0FF%22/><rect x=%229%22 y=%2224%22 width=%2222%22 height=%229%22 rx=%224%22 fill=%22%23CBE0FF%22/></svg>';
  nameEl.textContent = p?.displayName || 'LINE User';
  btnLogin.classList.add('hide');
  btnLogout.classList.remove('hide');
  localStorage.setItem('liff_profile', JSON.stringify(p||{}));
}
async function init(){
  try{
    await liff.init({ liffId: LIFF_ID });
    if(liff.isLoggedIn()){
      const prof = await liff.getProfile();
      renderProfile(prof);
    }else{
      const cache = localStorage.getItem('liff_profile');
      if(cache){ try{ renderProfile(JSON.parse(cache)); }catch(_){ } }
    }
  }catch(err){ console.warn('LIFF init error', err); }
}
btnLogin.addEventListener('click', ()=>{
  if(!liff.isLoggedIn()){ liff.login({ redirectUri: PUBLIC_URL }); }
});
btnLogout.addEventListener('click', ()=>{
  try{ if(liff.isLoggedIn()) liff.logout(); }catch(_){}
  localStorage.removeItem('liff_profile');
  location.replace(PUBLIC_URL);
});
init();
