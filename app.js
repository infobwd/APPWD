import * as News from './modules/news.js';
import * as Links from './modules/links.js';
import * as Checkin from './modules/checkin.js';
import { goto } from './ui.js';
function setActive(hash){document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active',b.getAttribute('data-nav')===hash));}
function parseHash(){const raw=location.hash||'#home';const [path,qs]=raw.split('?');const params={};if(qs){qs.split('&').forEach(p=>{const[k,v]=p.split('=');params[decodeURIComponent(k)]=decodeURIComponent(v||'');});}return{path,params};}
async function route(){const {path,params}=parseHash();const h=path||'#home';setActive(h);
  if(h==='#home'){goto('#home');await News.renderHome();await Checkin.renderHomeRecent();await Links.renderHome();}
  else if(h==='#news'){goto('#news');await News.renderList();}
  else if(h==='#post'){goto('#post');await News.renderDetail(params.id);}
  else if(h==='#links'){goto('#links');await Links.render();}
  else if(h==='#profile'){goto('#profile');}
  else if(h==='#checkin'){goto('#checkin');await Checkin.render();}}
function bindUI(){const back=document.getElementById('btnBackList');if(back)back.onclick=()=>location.hash='#news';const fab=document.getElementById('fabScan');if(fab)fab.onclick=()=>{location.hash='#checkin';};document.querySelectorAll('.navbtn,[data-nav]').forEach(el=>{el.addEventListener('click',e=>{e.preventDefault();const to=el.getAttribute('data-nav');if(to)location.hash=to;});});let def=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();def=e;const btn=document.getElementById('btnInstall');if(btn){btn.classList.remove('hide');btn.onclick=async()=>{if(!def)return;def.prompt();await def.userChoice;def=null;btn.classList.add('hide');};});});}
window.addEventListener('hashchange',route);document.addEventListener('DOMContentLoaded',()=>{bindUI();route();});