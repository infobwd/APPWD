
import { supabase } from '../api.js';
import { SLIDER_AUTO_MS, PUBLIC_URL } from '../config.js';
function mk(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
function safe(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function favicon(url){ try{ const u=new URL(url); return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`; }catch{ return ''; } }

/* ===== Apps/Systems card ===== */
async function loadFeaturedApps(limit=8){
  try{
    const q = await supabase.from('app_links').select('id,title,url,image_url,category,sort_order,is_active').eq('is_active',true).order('sort_order',{ascending:true}).order('title',{ascending:true}).limit(limit);
    return q?.data||[];
  }catch{ return []; }
}
export async function renderAppsCard(containerId='homeLinks'){
  const host = document.getElementById(containerId); if(!host) return;
  if (host.getAttribute('data-rendered')==='1') return; host.setAttribute('data-rendered','1');
  host.innerHTML = `<div class="p-4 text-slate-400">กำลังโหลดรายการ…</div>`;
  const apps = await loadFeaturedApps(8);
  if(!apps.length){ host.innerHTML = `<div class="p-4 text-slate-400">ยังไม่มีรายการแอป/ระบบ</div>`; return; }
  host.innerHTML = `<div class="flex items-center justify-between mb-2"><h3 class="text-base font-semibold">แอป/ระบบในโรงเรียน</h3></div><div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" id="appsGrid"></div>`;
  const grid = host.querySelector('#appsGrid');
  apps.forEach(a=>{
    const img = a.image_url || favicon(a.url);
    const el = mk(`<a class="block p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow transition bg-white" href="${safe(a.url)}" target="_blank" rel="noopener">
      <div class="flex items-center gap-3">
        ${img?`<img src="${safe(img)}" class="w-10 h-10 rounded-lg object-cover" alt="">`:`<div class="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500">🟦</div>`}
        <div class="min-w-0"><div class="font-medium truncate">${safe(a.title||'ไม่ระบุชื่อ')}</div>${a.category?`<div class="text-xs text-slate-500 truncate">${safe(a.category)}</div>`:''}</div>
      </div>
    </a>`);
    grid.appendChild(el);
  });
}

/* ===== Today's Work Summary ===== */
function startOfTodayLocal(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
function endOfTodayLocal(){ const d=new Date(); d.setHours(23,59,59,999); return d; }
async function fetchSummaryToday(){
  try{ const { data, error } = await supabase.rpc('work_summary_today'); if(!error && data) return data; }catch{}
  const fromISO = startOfTodayLocal().toISOString(), toISO=endOfTodayLocal().toISOString();
  const candidates = [
    { table:'work_summary_today_view', mode:'view' },
    { table:'work_logs', timeCol:'created_at', typeCol:'type' },
    { table:'attendance', timeCol:'created_at', typeCol:'category' },
    { table:'duty_logs', timeCol:'created_at', typeCol:'kind' },
  ];
  for(const c of candidates){
    try{
      if(c.mode==='view'){ const q=await supabase.from(c.table).select('work,meeting,training,official').limit(1); if(q?.data?.length) return q.data[0]; }
      else{ const q=await supabase.from(c.table).select(`${c.typeCol}, ${c.timeCol}`).gte(c.timeCol,fromISO).lte(c.timeCol,toISO); const rows=q?.data||[]; const sum={work:0,meeting:0,training:0,official:0}; const map={work:'work',meeting:'meeting',training:'training',official:'official','มา':'work','ประชุม':'meeting','อบรม':'training','ไปราชการ':'official'}; rows.forEach(r=>{ const k = map[String(r[c.typeCol]||'').toLowerCase()]||'work'; sum[k]=(sum[k]||0)+1; }); return sum; }
    }catch{}
  }
  return { work:0, meeting:0, training:0, official:0 };
}
export async function renderTodaySummary(containerId='homeSummaryCard'){
  const host = document.getElementById(containerId); if(!host) return;
  host.innerHTML = '<div class="p-4 text-slate-400">กำลังโหลดข้อมูลวันนี้…</div>';
  const data = await fetchSummaryToday();
  const item = (label, value)=>`<div class="p-3 rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center"><div class="text-2xl font-semibold">${value||0}</div><div class="text-sm text-slate-600 mt-1">${label}</div></div>`;
  host.innerHTML = `<div class="flex items-center justify-between mb-2"><h3 class="text-base font-semibold">สรุปการมาปฏิบัติงาน (วันนี้)</h3><div class="text-xs text-slate-500">${new Date().toLocaleDateString()}</div></div><div class="grid grid-cols-2 sm:grid-cols-4 gap-3">${item('มาทำงาน',data.work||0)}${item('ประชุม',data.meeting||0)}${item('อบรม',data.training||0)}${item('ไปราชการ',data.official||0)}</div>`;
}

/* ===== Featured slider + LINE Share ===== */
function buildShareLinks(url,title){ const enc=encodeURIComponent(url); const lineWeb='https://social-plugins.line.me/lineit/share?url='+enc; const lineNative='line://msg/text/'+encodeURIComponent((title?title+' ':'')+url); return {lineWeb,lineNative}; }
async function fetchFeatured(limit=5){
  const sources=[{table:'news',fields:'id,title,image_url,url,published_at,is_featured'},{table:'posts',fields:'id,title,image_url,url,published_at,is_featured'}];
  for(const s of sources){
    try{ const q=await supabase.from(s.table).select(s.fields).eq('is_featured',true).order('published_at',{ascending:false}).limit(limit); if(q?.data?.length) return q.data; }catch{}
  }
  try{ const q=await supabase.from('app_links').select('id,title,image_url,url,category,is_active,sort_order').eq('is_active',true).order('sort_order',{ascending:true}).limit(limit); return q?.data||[]; }catch{}
  return [];
}
export async function renderFeaturedSlider(containerId='featuredSlider'){
  const host=document.getElementById(containerId); if(!host) return;
  if(host.getAttribute('data-rendered')==='1') return; host.setAttribute('data-rendered','1');
  host.innerHTML = '<div class="p-4 text-slate-400">กำลังโหลดรายการเด่น…</div>';
  const rows = await fetchFeatured(5); if(!rows.length){ host.innerHTML=''; return; }
  host.innerHTML = `<div class="featured-wrap"><div class="featured-track"></div><div class="featured-dots"></div></div>`;
  const track=host.querySelector('.featured-track'), dots=host.querySelector('.featured-dots');
  rows.forEach((r,i)=>{ const url=r.url || (typeof PUBLIC_URL!=='undefined'?PUBLIC_URL:''); const share=buildShareLinks(url,r.title); const slide=document.createElement('div'); slide.className='featured-slide'; slide.innerHTML=`
    <a class="block rounded-2xl overflow-hidden border border-slate-200 bg-white" href="${url}" target="_blank" rel="noopener">
      ${r.image_url?`<img src="${r.image_url}" class="w-full h-40 sm:h-52 object-cover" alt="">`:''}
      <div class="p-3"><div class="font-semibold line-clamp-2">${r.title||''}</div><div class="mt-2"><a class="btn-line-share" href="${share.lineWeb}" target="_blank" rel="noopener">แชร์ LINE</a></div></div>
    </a>`; track.appendChild(slide); const dot=document.createElement('button'); dot.className='dot'; dot.setAttribute('data-i',String(i)); dots.appendChild(dot); });
  let i=0,N=rows.length,timer=null; const set=k=>{ i=(k+N)%N; track.style.setProperty('--i',String(i)); dots.querySelectorAll('.dot').forEach((d,idx)=>d.classList.toggle('active',idx===i)); };
  const play=()=>{ clearInterval(timer); const interval = (typeof SLIDER_AUTO_MS!=='undefined'?SLIDER_AUTO_MS:4000)||4000; timer=setInterval(()=>set(i+1),interval); };
  dots.addEventListener('click',ev=>{ const b=ev.target.closest('.dot'); if(!b) return; set(Number(b.getAttribute('data-i')||'0')); play(); });
  host.addEventListener('mouseenter',()=>clearInterval(timer)); host.addEventListener('mouseleave',play);
  set(0); play();
}
