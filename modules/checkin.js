import { supabase, currentUser } from '../api.js';
import { PUBLIC_URL } from '../config.js';
const els = { list: ()=>document.getElementById('myCheckins'), btnIn: ()=>document.getElementById('btnCheckIn'), btnOut: ()=>document.getElementById('btnCheckOut'), photo: ()=>document.getElementById('photoInput') };
export async function render(){ wire(); await refresh(); }
function wire(){ els.btnIn().onclick=()=>handle('in'); els.btnOut().onclick=()=>handle('out'); }
async function ensureSession(){ const u = await currentUser(); if(u) return u; const email = prompt('กรุณาใส่อีเมลเพื่อยืนยัน (ครั้งแรกเท่านั้น):'); if(!email) return null; const { error } = await supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo: PUBLIC_URL } }); if(error){ alert('ส่งลิงก์ไม่สำเร็จ: '+error.message); return null; } alert('ส่งลิงก์ยืนยันไปที่อีเมลแล้ว กดยืนยันแล้วกลับมาอีกครั้ง'); return null; }
async function handle(type){
  const u = await ensureSession(); if(!u) return;
  let lat=null,lng=null; try{ const pos = await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:10000})); lat=pos.coords.latitude; lng=pos.coords.longitude; }catch(_){}
  let photo_path=null; const file=els.photo().files?.[0];
  if(file){ const path=`checkin/${u.id}/${Date.now()}_${file.name}`; const up=await supabase.storage.from('checkin-photos').upload(path,file,{upsert:false,contentType:file.type}); if(!up.error) photo_path=path; }
  const { error } = await supabase.from('checkins').insert({ user_id:u.id, type, lat, lng, photo_path }); if(error){ alert('ผิดพลาด: '+error.message); return; } await refresh();
}
async function refresh(){
  const u = await currentUser(); const list = els.list(); if(!u){ list.innerHTML='<div class="text-gray-500">เข้าสู่ระบบด้วย LINE เพื่อใช้งาน และยืนยันอีเมลเมื่อต้องบันทึกข้อมูล</div>'; return; }
  const { data, error } = await supabase.from('checkins').select('id,type,ts,photo_path,lat,lng').eq('user_id',u.id).order('ts',{ascending:false}).limit(30);
  if(error){ list.innerHTML='<div class="text-red-600">โหลดประวัติไม่สำเร็จ</div>'; return; }
  list.innerHTML = (data||[]).map(r => {
    const time=new Date(r.ts).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'});
    return `<div class="p-3 border border-[#E6EAF0] rounded-xl bg-white"><div class="font-medium">${r.type==='in'?'เช็คอิน':'เช็คเอาท์'} • ${time}</div></div>`;
  }).join('') || '<div class="text-gray-500">ยังไม่มีข้อมูล</div>';
}
