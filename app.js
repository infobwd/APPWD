import * as News from './modules/news.js';
import * as Links from './modules/links.js';
import * as Checkin from './modules/checkin.js';
import * as Admin from './modules/profile_admin.js';
import { goto, openPrefs } from './ui.js';
function setActive(hash){ document.querySelectorAll('.navbtn').forEach(b=>{ b.classList.toggle('active', b.getAttribute('data-nav')===hash); }); }
function parseHash(){ const raw=location.hash||'#home'; const parts=raw.split('?'); const path=parts[0]; const qs=parts[1]||''; const params={}; if(qs){ qs.split('&').forEach(p=>{ const kv=p.split('='); const k=decodeURIComponent(kv[0]||''); const v=decodeURIComponent(kv[1]||''); if(k) params[k]=v; }); } return {path,params}; }
async function route(){ const {path,params}=parseHash(); const h=path||'#home'; setActive(h);
  if(h==='#home'){ goto('#home'); await News.renderHome(); await Checkin.initTabs(); await Checkin.renderHomeRecent('work'); await Checkin.renderHomeSummary(); await Links.renderHome(); }
  else if(h==='#news'){ goto('#news'); await News.renderList(); }
  else if(h==='#post'){ goto('#post'); await News.renderDetail(params.id); }
  else if(h==='#links'){ goto('#links'); await Links.render(); }
  else if(h==='#profile'){ goto('#profile'); await Admin.render(); 
try{ const S = await import('./settings.js'); S.wireProfileSettings?.(); }catch(_){ }
}
  else if(h==='#checkin'){ goto('#checkin'); await Checkin.render(); } }
function bindUI(){ const back=document.getElementById('btnBackList'); if(back) back.onclick=()=>{ location.hash='#news'; };
  const fab=document.getElementById('fabScan'); if(fab) fab.onclick=()=>{ location.hash='#checkin'; };
  const btnTheme=document.getElementById('btnTheme'); if(btnTheme) btnTheme.onclick=()=>openPrefs();
  document.querySelectorAll('.navbtn,[data-nav]').forEach(el=>{ el.addEventListener('click',e=>{ e.preventDefault(); const to=el.getAttribute('data-nav'); if(to) location.hash=to; }); });
  document.querySelectorAll('[data-ci-tab]').forEach(el=>{ el.addEventListener('click',()=>{ const p=el.getAttribute('data-ci-tab'); Checkin.renderHomeRecent(p); }); }); }
window.addEventListener('hashchange', route);
document.addEventListener('DOMContentLoaded', ()=>{ bindUI(); route(); });

// Partial refresh after CRUD
document.addEventListener('appwd:postSaved', async (ev)=>{
  try{
    const News = await import('./modules/news.js');
    const {path,params} = parseHash();
    if(path==='#post' && ev?.detail?.id){ await News.renderDetail(ev.detail.id); }
    else if(path==='#news'){ await News.renderList(); }
    await News.renderHome(); // home strip
  }catch(_){}
});
document.addEventListener('appwd:linkSaved', async ()=>{
  try{
    const Links = await import('./modules/links.js');
    const {path} = parseHash();
    if(path==='#links') await Links.render();
    await Links.renderHome();
  }catch(_){}
});
