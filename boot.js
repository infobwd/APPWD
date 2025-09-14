import { APP_VERSION } from './config.js';
const v = (APP_VERSION||'').replace(/\D/g,'') || '561';
const imp = (p) => import(`${p}?v=${v}`);

// Dynamic import modules with versioned query to avoid cache mismatches
const UI = await imp('./ui.js');
const News = await imp('./modules/news.js');
const Links = await imp('./modules/links.js');
const Checkin = await imp('./modules/checkin.js');
const Admin = await imp('./modules/profile_admin.js');
const Home = await imp('./modules/home.js');

function setActive(hash){
  document.querySelectorAll('.navbtn').forEach(b=>{
    b.classList.toggle('active', b.getAttribute('data-nav')===hash);
  });
}
function parseHash(){
  const raw=location.hash||'#home';
  let [path,q] = raw.split('?');
  const params={};
  if(q){
    q.split('&').forEach(kv=>{
      const t=kv.split('=');
      const k = decodeURIComponent(t[0]||'');
      const v = decodeURIComponent(t[1]||'');
      if(k) params[k]=v;
    });
  }
  return { path, params };
}


async function loadLiffSdk(){
  if(typeof window.liff !== 'undefined') return;
  await new Promise((resolve)=>{
    const s = document.createElement('script');
    s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    s.onload = resolve; s.onerror = resolve;
    document.head.appendChild(s);
  });
  try{ await import(`./liff.js?v=${v}`); }catch(_){}
}

async function route(){
  const {path, params} = parseHash();
  const h = path || '#home';
  setActive(h);
  try{
    if(h==='#home'){
      UI.goto('#home');
      await Home.renderAppsCard('homeLinks');
      await News.renderHome();
      await Checkin.renderHomeRecent('work');
      await Checkin.renderHomeRecent('offsite');
      await Checkin.renderHomeRecent('overtime');
      await Checkin.renderHomeSummary();
      await Links.render();
    }else if(h==='#news'){
      UI.goto('#news');
      await News.renderList();
    }else if(h==='#post'){
      UI.goto('#post');
      await News.renderDetail(params.id);
    }else if(h==='#links'){
      UI.goto('#links');
      await Links.render();
    }else if(h==='#profile'){
      UI.goto('#profile');
      await Admin.render();
    }else if(h==='#checkin'){
      UI.goto('#checkin');
      await Checkin.render();
    }
  }catch(err){
    console.error('[route] error:', err);
    UI.toast && UI.toast('เกิดข้อผิดพลาดในการโหลดข้อมูล');
  }
}

function bindUI(){
  const back=document.getElementById('btnBackList');
  if(back) back.onclick=()=>{ location.hash='#news'; };
  const fab=document.getElementById('fabScan');
  if(fab) fab.onclick=()=>{ location.hash='#checkin'; };
  const btnTheme=document.getElementById('btnTheme');
  if(btnTheme) btnTheme.onclick=()=>UI.openPrefs && UI.openPrefs();
  document.querySelectorAll('.navbtn,[data-nav]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const to=el.getAttribute('data-nav');
      if(to) location.hash=to;
    });
  });
  document.querySelectorAll('[data-ci-tab]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const p = el.getAttribute('data-ci-tab');
      Checkin.renderHomeRecent(p);
    });
  });
}

window.addEventListener('hashchange', route);
document.addEventListener('DOMContentLoaded', async ()=>{ bindUI(); await loadLiffSdk(); route(); });
