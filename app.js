import { supabase, currentUser } from './api.js';
import * as Helpdesk from './modules/helpdesk.js';
import * as Polls from './modules/polls.js';
import * as Directory from './modules/directory.js';
const views = Array.from(document.querySelectorAll('.viewport'));
function parseHash(){ const raw = location.hash || '#home'; const [path,q] = raw.split('?'); const params={}; if(q){ q.split('&').forEach(p=>{ const [k,v]=p.split('='); params[decodeURIComponent(k)]=decodeURIComponent(v||''); }); } return { path, params }; }
async function showRoute(route){
  const { path, params } = route || parseHash();
  const hash = path || '#home';
  views.forEach(v => v.classList.toggle('hide', v.dataset.view !== hash));
  document.querySelectorAll('[data-nav]').forEach(btn=>{ const on = btn.getAttribute('data-nav') === hash; btn.classList.toggle('text-prim', on); });
  if(location.hash !== hash + (Object.keys(params).length? '?' + new URLSearchParams(params).toString() : '')){
    location.hash = hash + (Object.keys(params).length? '?' + new URLSearchParams(params).toString() : '');
  }
  switch(hash){
    case '#helpdesk': await Helpdesk.render(); break;
    case '#polls': await Polls.render(); break;
    case '#directory': await Directory.render(); break;
  }
}
window.addEventListener('hashchange', ()=>showRoute(parseHash()));
document.querySelectorAll('[data-nav]').forEach(el=>{ el.addEventListener('click',(e)=>{ e.preventDefault(); showRoute({ path: el.getAttribute('data-nav'), params:{} }); }); });
showRoute(parseHash());
supabase.auth.onAuthStateChange(async ()=>{});
