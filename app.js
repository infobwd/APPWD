import { supabase, currentUser } from './api.js';
async function route(hash){
  document.querySelectorAll('.bottom-nav .navbtn').forEach(b=>b.classList.remove('active'));
  const btn = document.querySelector(`.bottom-nav .navbtn[data-nav="${hash}"]`); if(btn) btn.classList.add('active');
  document.getElementById('newsView').classList.add('hide');
  document.getElementById('linkView').classList.add('hide');
  document.getElementById('leaveView').classList.add('hide');
  document.getElementById('checkView').classList.add('hide');
  if(hash==='#news') { document.getElementById('newsView').classList.remove('hide'); await loadNews(); }
  if(hash==='#applinks') { document.getElementById('linkView').classList.remove('hide'); await loadLinks(); }
  if(hash==='#leave') { document.getElementById('leaveView').classList.remove('hide'); await setupLeave(); }
  if(hash==='#checkin') { document.getElementById('checkView').classList.remove('hide'); await setupCheckin(); }
}
window.addEventListener('hashchange', ()=>route(location.hash));
document.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',e=>{ e.preventDefault(); location.hash = el.getAttribute('data-nav'); }));
async function loadNews(){
  const home=document.getElementById('homeNews'); const list=document.getElementById('newsList');
  const { data } = await supabase.from('posts').select('id,title,category,published_at').lte('published_at', new Date().toISOString()).order('published_at',{ascending:false}).limit(20);
  const card = p => `<article class="p-3 border border-[#E6EAF0] rounded-xl bg-white flex items-start gap-3"><div class="w-10 h-10 rounded-lg bg-brandSoft grid place-items-center text-brand font-semibold">N</div><div><div class="font-semibold">${e(p.title)}</div><div class="text-xs text-gray-500">${e(p.category||'ทั่วไป')} • ${new Date(p.published_at).toLocaleDateString('th-TH')}</div></div></article>`;
  if(home) home.innerHTML = (data||[]).slice(0,6).map(card).join('') || '<div class="text-gray-500">ยังไม่มีข่าว</div>';
  if(list) list.innerHTML = (data||[]).map(card).join('') || '<div class="text-gray-500">ยังไม่มีข่าว</div>';
}
async function loadLinks(){
  const grid=document.getElementById('linkGrid');
  const { data } = await supabase.from('app_links').select('title,url,icon,category').order('title');
  grid.innerHTML = (data||[]).map(l=>`<a href="${encodeURI(l.url)}" target="_blank" class="p-3 border border-[#E6EAF0] rounded-xl bg-white flex flex-col items-center gap-2"><div class="w-12 h-12 grid place-items-center rounded-lg border border-[#E6EAF0] text-gray-700">${e(l.icon||'🔗')}</div><div class="text-sm font-medium text-center">${e(l.title)}</div><div class="text-[11px] text-gray-500">${e(l.category||'ทั่วไป')}</div></a>`).join('') || '<div class="text-gray-500">ยังไม่มีลิงก์</div>';
}
async function setupLeave(){
  const f=document.getElementById('leaveForm'); f.onsubmit=submitLeave; await myLeaves();
}
async function submitLeave(e){
  e.preventDefault();
  const u = await currentUser();
  if(!u){
    const email = prompt('ใส่อีเมลเพื่อยืนยัน (ครั้งแรกเท่านั้น):'); if(!email) return;
    const { error } = await supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo: location.href } });
    if(error){ alert('ส่งลิงก์ไม่สำเร็จ: ' + error.message); return; }
    alert('ส่งลิงก์ยืนยันไปที่อีเมลแล้ว กดยืนยันแล้วกลับมาอีกครั้ง');
    return;
  }
  const fd=new FormData(e.target);
  const payload={ user_id:u.id, type:fd.get('type'), start_date:fd.get('start_date')||null, end_date:fd.get('end_date')||null, reason:fd.get('reason')||null, status:'pending' };
  const { error } = await supabase.from('leave_requests').insert(payload);
  if(error){ alert('ยื่นคำขอไม่สำเร็จ: '+error.message); return; }
  e.target.reset(); await myLeaves();
}
async function myLeaves(){
  const u = await currentUser(); const box=document.getElementById('myLeaves');
  if(!u){ box.innerHTML='<div class="text-gray-500">เข้าสู่ระบบด้วย LINE เพื่อเห็นประวัติ และยืนยันอีเมลเมื่อต้องบันทึกข้อมูล</div>'; return; }
  const { data, error } = await supabase.from('leave_requests').select('type,start_date,end_date,status,created_at').eq('user_id',u.id).order('created_at',{ascending:false});
  if(error){ box.innerHTML='<div class="text-red-600">โหลดคำขอไม่สำเร็จ</div>'; return; }
  box.innerHTML = (data||[]).map(r=>`<div class="p-3 border border-[#E6EAF0] rounded-xl bg-white"><div class="font-medium">${labelType(r.type)} • ${labelStatus(r.status)}</div><div class="text-xs text-gray-500">${r.start_date||'—'} → ${r.end_date||'—'}</div></div>`).join('') || '<div class="text-gray-500">ยังไม่มีคำขอ</div>';
}
async function setupCheckin(){
  document.getElementById('btnCheckIn').onclick=()=>doCheck('in');
  document.getElementById('btnCheckOut').onclick=()=>doCheck('out');
  await myCheckins();
}
async function doCheck(type){
  const u = await currentUser();
  if(!u){
    const email = prompt('ใส่อีเมลเพื่อยืนยัน (ครั้งแรกเท่านั้น):'); if(!email) return;
    const { error } = await supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo: location.href } });
    if(error){ alert('ส่งลิงก์ไม่สำเร็จ: ' + error.message); return; }
    alert('ส่งลิงก์ยืนยันไปที่อีเมลแล้ว กดยืนยันแล้วกลับมาอีกครั้ง');
    return;
  }
  let lat=null,lng=null; try{ const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:10000})); lat=pos.coords.latitude; lng=pos.coords.longitude; }catch(_){}
  const file=document.getElementById('photoInput').files?.[0]; let photo_path=null;
  if(file){ const path=`checkin/${u.id}/${Date.now()}_${file.name}`; const up=await supabase.storage.from('checkin-photos').upload(path,file,{upsert:false,contentType:file.type}); if(!up.error) photo_path=path; }
  const { error } = await supabase.from('checkins').insert({ user_id:u.id, type, lat, lng, photo_path });
  if(error){ alert('ผิดพลาด: '+error.message); return; }
  await myCheckins();
}
async function myCheckins(){
  const u = await currentUser(); const box=document.getElementById('myCheckins');
  if(!u){ box.innerHTML='<div class="text-gray-500">เข้าสู่ระบบด้วย LINE เพื่อใช้งาน และยืนยันอีเมลเมื่อต้องบันทึกข้อมูล</div>'; return; }
  const { data, error } = await supabase.from('checkins').select('type,ts').eq('user_id',u.id).order('ts',{ascending:false}).limit(30);
  if(error){ box.innerHTML='<div class="text-red-600">โหลดประวัติไม่สำเร็จ</div>'; return; }
  box.innerHTML = (data||[]).map(r=>`<div class="p-3 border border-[#E6EAF0] rounded-xl bg-white"><div class="font-medium">${r.type==='in'?'เช็คอิน':'เช็คเอาท์'} • ${new Date(r.ts).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})}</div></div>`).join('') || '<div class="text-gray-500">ยังไม่มีข้อมูล</div>';
}
function labelType(t){ return ({vacation:'ลาพักผ่อน', business:'ลากิจ', sick:'ลาป่วย'})[t]||t }
function labelStatus(s){ return ({pending:'รออนุมัติ', approved:'อนุมัติ', rejected:'ตีกลับ'})[s]||s }
function e(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
route('#home'); loadNews();
