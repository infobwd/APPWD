import { LIFF_ID } from './config.js';

const userInfo = document.getElementById('userInfo');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');

async function init(){
  try{
    await liff.init({ liffId: LIFF_ID });
    if(liff.isLoggedIn()){
      const prof = await liff.getProfile();
      const name = prof.displayName || 'LINE User';
      const pic = prof.pictureUrl || null;
      localStorage.setItem('liff_profile', JSON.stringify({ name, pic, userId: prof.userId }));
      renderUser({ name, pic, source: 'LINE' });
      btnLogin.classList.add('hide');
      btnLogout.classList.remove('hide');
    }
  }catch(err){
    console.warn('LIFF init error', err);
  }
}
function renderUser({ name, pic, source }){
  userInfo.classList.remove('hide');
  userInfo.textContent = `${name} • ${source}`;
}
btnLogin.addEventListener('contextmenu', (e)=>{
  e.preventDefault();
  if(!liff.isLoggedIn()){ liff.login({ redirectUri: window.location.href }); }
});
btnLogout.addEventListener('dblclick', ()=>{
  if(liff.isLoggedIn()){ liff.logout(); localStorage.removeItem('liff_profile'); location.reload(); }
});
init();
