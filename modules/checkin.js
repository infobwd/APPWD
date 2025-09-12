import { supabase } from '../api.js';
import { SCHOOL_LAT, SCHOOL_LNG, SCHOOL_RADIUS_METERS } from '../config.js';
import { toast } from '../ui.js';

let scanner=null, lastText=null, lastGeo=null;

export async function render(){
  const box=document.getElementById('qrReader');
  const geoState=document.getElementById('geoState');
  const res = document.getElementById('scanResult');
  const btnC = document.getElementById('btnCheckin');
  const btnG = document.getElementById('btnGpsOnly');
  if(!box||!geoState||!res||!btnC||!btnG) return;
  box.innerHTML='';
  try{
    scanner = new Html5Qrcode('qrReader');
    await scanner.start({facingMode:'environment'},{fps:10,qrbox:240}, decodedText=>{ lastText=decodedText; res.textContent = 'QR: ' + decodedText; });
  }catch(e){
    box.innerHTML = '<div class="p-4 text-sm text-red-600">ไม่สามารถเปิดกล้อง: '+(e?.message||e)+'</div>';
  }
  getGeo(geoState);
  btnC.onclick = async ()=> doCheckin('qr+gps');
  btnG.onclick = async ()=> doCheckin('gps');
  await loadToday();
}

function getGeo(outEl){
  outEl.textContent='กำลังอ่านตำแหน่ง…';
  if(!navigator.geolocation){ outEl.textContent='อุปกรณ์ไม่รองรับตำแหน่ง'; return; }
  navigator.geolocation.getCurrentPosition((pos)=>{
    const { latitude, longitude, accuracy } = pos.coords;
    lastGeo = { lat: latitude, lng: longitude, accuracy };
    const d = distanceMeters(SCHOOL_LAT,SCHOOL_LNG, latitude, longitude);
    const ok = d <= SCHOOL_RADIUS_METERS;
    outEl.innerHTML = `ตำแหน่งปัจจุบัน: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)}m) → ${ok?'<span class="text-green-600">ในเขตเช็คอิน</span>':'<span class="text-red-600">อยู่นอกเขต ('+Math.round(d)+'m)</span>'}`;
  }, (err)=>{
    outEl.textContent='อ่านตำแหน่งไม่สำเร็จ: '+(err?.message||err);
  }, { enableHighAccuracy:true, timeout:8000, maximumAge:0 });
}

function distanceMeters(lat1, lon1, lat2, lon2){
  const R=6371000; const toRad=x=>x*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

async function doCheckin(method){
  const profile = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  if(!profile){ toast('ต้องเข้าสู่ระบบด้วย LINE ก่อน'); return; }
  if(!lastGeo){ toast('ยังไม่ได้ตำแหน่ง'); return; }
  const dist = distanceMeters(SCHOOL_LAT,SCHOOL_LNG, lastGeo.lat, lastGeo.lng);
  const within = dist <= SCHOOL_RADIUS_METERS;
  const payload = {
    line_user_id: profile?.userId || null,
    line_display_name: profile?.displayName || null,
    line_picture_url: profile?.pictureUrl || null,
    method, text: lastText||null,
    lat: lastGeo.lat, lng: lastGeo.lng, accuracy: lastGeo.accuracy,
    distance_m: Math.round(dist),
    within_radius: within
  };
  const { error } = await supabase.from('checkins').insert(payload);
  if(error){ toast('เช็คอินไม่สำเร็จ'); return; }
  toast(within ? 'เช็คอินสำเร็จ ✅' : 'บันทึกนอกเขต ❗');
  await loadToday();
}

async function loadToday(){
  const profile = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  const box = document.getElementById('todayList'); if(!box) return; box.innerHTML='';
  if(!profile){ box.innerHTML='<div class="text-gray-500">ยังไม่เข้าสู่ระบบ</div>'; return; }
  const start = new Date(); start.setHours(0,0,0,0);
  const { data } = await supabase.from('checkins').select('*').eq('line_user_id', profile.userId).gte('created_at', start.toISOString()).order('created_at', { ascending:false }).limit(20);
  box.innerHTML = (data||[]).map(row=>`<div class="p-2 border border-[#E6EAF0] rounded-lg flex justify-between text-sm">
    <div>${new Date(row.created_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} — ${row.method}${row.text? ' • '+row.text:''}</div>
    <div class="${row.within_radius?'text-green-600':'text-red-600'}">${row.distance_m} m</div>
  </div>`).join('') || '<div class="text-gray-500">ยังไม่มีรายการวันนี้</div>';
}
