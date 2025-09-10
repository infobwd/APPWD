import { LIFF_ID, OIDC_PROVIDER } from './config.js';
import { supabase } from './api.js';
const userInfo = document.getElementById('userInfo');
const btnLineLogin = document.getElementById('btnLineLogin');
const btnLogout = document.getElementById('btnLogout');
async function initLIFF(){
  try{
    await liff.init({ liffId: LIFF_ID });
    if(liff.isLoggedIn()){
      const prof = await liff.getProfile();
      await bindToSupabase();
      renderUser(prof);
    }
  }catch(err){ console.warn('LIFF init error', err); }
}
async function bindToSupabase(){
  try{
    const token = liff.getIDToken();
    if(token){
      try{ await supabase.auth.signInWithIdToken({ provider: OIDC_PROVIDER, token }); }catch(e){ console.warn('id_token sign-in not configured', e.message); }
    }
  }catch(e){ console.warn('bindToSupabase error', e); }
}
function renderUser(prof){
  const name = prof?.displayName || 'LINE User';
  userInfo.classList.remove('hide');
  userInfo.textContent = name + ' • LINE';
  btnLineLogin.classList.add('hide');
  btnLogout.classList.remove('hide');
}
btnLineLogin.addEventListener('click', ()=>{ if(!liff.isLoggedIn()){ liff.login({ redirectUri: window.location.href }); } });
btnLogout.addEventListener('click', async ()=>{ try{ await supabase.auth.signOut(); }catch(_){ } if(liff.isLoggedIn()){ liff.logout(); } localStorage.removeItem('liff_profile'); location.reload(); });
initLIFF();
