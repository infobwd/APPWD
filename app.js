import * as News from './modules/news.js';
import * as Links from './modules/links.js';
import * as Scan from './modules/scan.js';
import * as Notify from './modules/notify.js';
import * as Push from './push.js';
import { goto, openSheet } from './ui.js';
import { currentUser } from './api.js';

const navBtns=document.querySelectorAll('.navbtn');
function setActive(hash){ navBtns.forEach(b=>b.classList.toggle('active', b.getAttribute('data-nav')===hash)); }
function parseHash(){ const raw=location.hash||'#home'; const [path,qs]=raw.split('?'); const params={}; if(qs){ qs.split('&').forEach(p=>{ const [k,v]=p.split('='); params[decodeURIComponent(k)]=decodeURIComponent(v||''); }); } return { path, params }; }
async function route(){ const {path,params}=parseHash(); const h=path||'#home'; setActive(h);
  if(h==='#home'){ goto('#home'); await News.renderHome(); await Links.renderHome(); }
  else if(h==='#news'){ goto('#news'); await News.renderList(); }
  else if(h==='#post'){ goto('#post'); await News.renderDetail(params.id); }
  else if(h==='#links'){ goto('#links'); await Links.render(); }
  else if(h==='#profile'){ goto('#profile'); }
  else if(h==='#scan'){ goto('#scan'); await Scan.render(); } }
window.addEventListener('hashchange', route);
navBtns.forEach(el=>el.addEventListener('click',e=>{ e.preventDefault(); location.hash=el.getAttribute('data-nav'); }));
document.getElementById('btnBackList').addEventListener('click', ()=>location.hash='#news');

document.getElementById('fabMain').addEventListener('click', ()=>{
  openSheet(`<div class="grid grid-cols-2 gap-2 grid-actions">
    <button id="actScan" class="btn btn-prim">สแกนเช็คอิน</button>
    <button id="actGPS" class="btn">เช็คอินตำแหน่ง</button>
    <button id="actQuickNews" class="btn">โพสต์ข่าวด่วน</button>
    <button id="actQuickLink" class="btn">เพิ่มลิงก์</button>
  </div>`);
  import('./modules/checkin.js').then(m=>{
    document.getElementById('actScan').onclick = m.scanCheckin;
    document.getElementById('actGPS').onclick = m.gpsCheckin;
  });
  import('./modules/news.js').then(m=>{
    document.getElementById('actQuickNews').onclick = ()=>m.openComposeSheet();
  });
  import('./modules/links.js').then(m=>{
    document.getElementById('actQuickLink').onclick = ()=>m.openComposeSheet();
  });
});

document.getElementById('btnBell').addEventListener('click', ()=>Notify.openInbox());
document.getElementById('btnEnablePush').addEventListener('click', ()=>Push.enablePush());

let deferredPrompt=null; window.addEventListener('beforeinstallprompt',(e)=>{ e.preventDefault(); deferredPrompt=e; const btn=document.getElementById('btnInstall'); btn.classList.remove('hide'); btn.onclick=async()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; btn.classList.add('hide'); };});

(async ()=>{
  const user = await currentUser();
  await Notify.initRealtime(user);
  route();
})();