import * as News from './modules/news.js';
import * as Links from './modules/links.js';
import { enableTilt } from './ui.js';
const views={home:document.getElementById('homeView'),news:document.getElementById('newsView'),post:document.getElementById('postView'),links:document.getElementById('linksView')};
function parseHash(){ const raw=location.hash||'#home'; const [p,qs]=raw.split('?'); const params={}; if(qs){ qs.split('&').forEach(x=>{ const [k,v]=x.split('='); params[decodeURIComponent(k)]=decodeURIComponent(v||''); }); } return { path:p, params }; }
function active(h){ document.querySelectorAll('.bottom-nav .navbtn').forEach(b=>b.classList.toggle('active', b.getAttribute('data-nav')===h)); }
async function route(r){ const {path,params}=r||parseHash(); const h=path||'#home'; Object.values(views).forEach(v=>v.classList.add('hide')); active(h);
  if(h==='#home'){ views.home.classList.remove('hide'); await News.renderHero(); await News.renderHome(); await Links.renderHome(); enableTilt('.tilt'); }
  else if(h==='#news'){ views.news.classList.remove('hide'); await News.renderList(); }
  else if(h==='#post'){ views.post.classList.remove('hide'); await News.renderDetail(params.id); }
  else if(h==='#links'){ views.links.classList.remove('hide'); await Links.render(); enableTilt('.tilt'); } }
window.addEventListener('hashchange', ()=>route(parseHash()));
document.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',e=>{ e.preventDefault(); location.hash=el.getAttribute('data-nav'); }));
document.getElementById('btnBackList')?.addEventListener('click', ()=>location.hash='#news');
route(parseHash());