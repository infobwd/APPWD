import * as News from './modules/news.js';
import * as AppLinks from './modules/applinks.js';
import * as Leave from './modules/leave.js';
import * as Checkin from './modules/checkin.js';
import * as Scan from './modules/scan.js';

const views = {
  home: document.getElementById('homeView'),
  news: document.getElementById('newsView'),
  post: document.getElementById('postView'),
  links: document.getElementById('linkView'),
  leave: document.getElementById('leaveView'),
  check: document.getElementById('checkView'),
  scan: document.getElementById('scanView'),
};

function parseHash(){
  const raw = location.hash || '#home';
  const [path, qs] = raw.split('?');
  const params = {}; if(qs){ qs.split('&').forEach(p=>{ const [k,v]=p.split('='); params[decodeURIComponent(k)] = decodeURIComponent(v||''); }); }
  return { path, params };
}
function setActive(hash){ document.querySelectorAll('.bottom-nav .navbtn').forEach(b=>b.classList.toggle('active', b.getAttribute('data-nav')===hash)); }

async function showRoute(route){
  const { path, params } = route || parseHash();
  const h = path || '#home';
  Object.values(views).forEach(v=>v.classList.add('hide'));
  setActive(h);
  if(h==='#home'){ views.home.classList.remove('hide'); await News.renderHome(); }
  else if(h==='#news'){ views.news.classList.remove('hide'); await News.renderList(); }
  else if(h==='#post'){ views.post.classList.remove('hide'); await News.renderDetail(params.id); }
  else if(h==='#applinks'){ views.links.classList.remove('hide'); await AppLinks.render(); }
  else if(h==='#leave'){ views.leave.classList.remove('hide'); await Leave.render(); }
  else if(h==='#checkin'){ views.check.classList.remove('hide'); await Checkin.render(); }
  else if(h==='#scan'){ views.scan.classList.remove('hide'); await Scan.render(); }
}

window.addEventListener('hashchange', ()=>showRoute(parseHash()));
document.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',e=>{ e.preventDefault(); const hash = el.getAttribute('data-nav'); if(hash.startsWith('#')) location.hash = hash; }));
document.getElementById('btnBackList').addEventListener('click', ()=>location.hash='#news');
document.querySelector('.fab').addEventListener('click', (e)=>{ e.preventDefault(); location.hash='#scan'; });

showRoute(parseHash());
