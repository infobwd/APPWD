import { supabase, getSession, signInEmail, signOut, currentUser } from './api.js';
import * as Ann from './modules/announcements.js';
import * as Checkin from './modules/checkin.js';
import * as Leave from './modules/leave.js';
import * as AppHub from './modules/apphub.js';

// Simple router
const views = Array.from(document.querySelectorAll('.viewport'));

// Router with query params (#path?key=value)
function parseHash(){
  const raw = location.hash || '#home';
  const [path, q] = raw.split('?');
  const params = {};
  if(q){ q.split('&').forEach(pair => {
    const [k,v] = pair.split('=');
    params[decodeURIComponent(k)] = decodeURIComponent(v||'');
  });}
  return { path, params };
}

async function showRoute(route){
  const { path, params } = route || parseHash();
  const hash = path || '#home';
  views.forEach(v => v.classList.toggle('hide', v.dataset.view !== hash));
  document.querySelectorAll('[data-nav]').forEach(btn=>{
    const on = btn.getAttribute('data-nav') === hash;
    btn.classList.toggle('text-accent', on);
  });
  if(location.hash !== hash + (Object.keys(params).length? '?' + new URLSearchParams(params).toString() : '')){
    location.hash = hash + (Object.keys(params).length? '?' + new URLSearchParams(params).toString() : '');
  }
  switch(hash){
    case '#home': await renderHome(); break;
    case '#announcements': await Ann.renderList(); await Ann.renderComposeButton(); break;
    case '#checkin': await Checkin.render(); break;
    case '#leave': await Leave.render(); break;
    case '#apphub': await AppHub.render(); break;
    case '#post': await Ann.renderDetail(params.id); break;
    case '#compose': await Ann.renderCompose(); break;
  }
}
window.addEventListener('hashchange', ()=>showRoute(parseHash()));
document.querySelectorAll('[data-nav]').forEach(el=>{
  el.addEventListener('click', (e)=>{ e.preventDefault(); showRoute({ path: el.getAttribute('data-nav'), params:{} }); });
});

function show(hash){
  if(!hash) hash = '#home';
  views.forEach(v => v.classList.toggle('hide', v.dataset.view !== hash));
  document.querySelectorAll('[data-nav]').forEach(btn=>{
    const on = btn.getAttribute('data-nav') === hash;
    btn.classList.toggle('text-accent', on);
  });
  if(location.hash !== hash) location.hash = hash;
  // onShow hooks
  switch(hash){
    case '#home': renderHome(); break;
    case '#announcements': Ann.renderList(); break;
    case '#checkin': Checkin.render(); break;
    case '#leave': Leave.render(); break;
    case '#apphub': AppHub.render(); break;
  }
}

// Auth UI
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');
const userInfo = document.getElementById('userInfo');

btnLogin.addEventListener('click', async ()=>{
  const email = prompt('กรอกอีเมลสำหรับรับลิงก์เข้าสู่ระบบ (Magic link)');
  if(!email) return;
  try{
    await signInEmail(email);
    alert('ส่งลิงก์เข้าสู่ระบบทางอีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย');
  }catch(err){
    alert('เข้าสู่ระบบไม่สำเร็จ: ' + err.message);
  }
});

btnLogout.addEventListener('click', async ()=>{
  await signOut();
  await initAuth();
  show('#home');
});

async function initAuth(){
  const session = await getSession();
  if(session){
    btnLogin.classList.add('hide');
    btnLogout.classList.remove('hide');
    userInfo.classList.remove('hide');
    userInfo.textContent = session.user.email || 'ผู้ใช้';
  }else{
    btnLogin.classList.remove('hide');
    btnLogout.classList.add('hide');
    userInfo.classList.add('hide');
    userInfo.textContent = '';
  }
}

// Home render
async function renderHome(){
  // Posts preview
  const homePosts = document.getElementById('homePosts');
  homePosts.innerHTML = '<div class="animate-pulse h-5 bg-slate-700/30 rounded w-1/2"></div>';
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id,title,category,published_at')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(5);
  if(error){ homePosts.innerHTML = '<div class="text-sm text-red-300">โหลดข่าวไม่สำเร็จ</div>'; return; }
  homePosts.innerHTML = posts.map(p => `
    <a href="#announcements" class="block p-3 border border-[#223052] rounded-lg hover:bg-[#1b2746]">
      <div class="font-semibold">${escapeHtml(p.title)}</div>
      <div class="text-xs text-slate-400">${p.category||'—'} • ${formatDate(p.published_at)}</div>
    </a>
  `).join('');

  // Today widgets (my leaves + checkin today)
  const todayBox = document.getElementById('todayStatus');
  const user = await currentUser();
  if(!user){
    todayBox.querySelectorAll('.chip')[0].textContent = 'ต้องเข้าสู่ระบบ';
    todayBox.querySelectorAll('.chip')[1].textContent = '—';
    return;
  }

  const today = new Date().toISOString().slice(0,10);
  const { data: cks } = await supabase
    .from('checkins')
    .select('type, ts')
    .eq('user_id', user.id)
    .gte('ts', today + 'T00:00:00Z')
    .lte('ts', today + 'T23:59:59Z')
    .order('ts', { ascending: true });
  const status = (cks||[]).length
    ? (cks[cks.length-1].type === 'in' ? 'เช็คอินแล้ว' : 'เช็คเอาท์แล้ว')
    : 'ยังไม่เช็คอิน';
  todayBox.querySelectorAll('.chip')[0].textContent = status;

  const { count: myLeaveCount } = await supabase
    .from('leave_requests')
    .select('*', { count:'exact', head: true })
    .eq('user_id', user.id);
  todayBox.querySelectorAll('.chip')[1].textContent = String(myLeaveCount ?? 0);

  // Sidebar metrics
  document.getElementById('metricCheckin').textContent = status;
  document.getElementById('metricMyLeaves').textContent = String(myLeaveCount ?? 0);
  document.getElementById('metricNewPosts').textContent = String(posts.length);
}

function formatDate(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('th-TH', { dateStyle:'medium', timeStyle:undefined });
}
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// Initialize
await initAuth();
showRoute(parseHash());

// Listen for auth state changes (e.g., after magic link)
supabase.auth.onAuthStateChange(async (_event, _session)=>{
  await initAuth();
  showRoute(parseHash());
});
