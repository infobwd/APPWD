import { supabase } from '../api.js'; import { SCHOOL_LAT,SCHOOL_LNG,SCHOOL_RADIUS_METERS } from '../config.js'; import { toast, skel, openSheet, closeSheet } from '../ui.js';
let lastText=null,lastGeo=null,map=null,meMarker=null;
function fmtDist(m){ if(m>=1000) return (m/1000).toFixed(2)+' km'; return Math.round(m)+' m'; }
export async function render(){ const box=document.getElementById('qrReader'), geoState=document.getElementById('geoState'), res=document.getElementById('scanResult'), btnC=document.getElementById('btnCheckin'), btnG=document.getElementById('btnGpsOnly'); if(!box||!geoState||!res||!btnC||!btnG)return; box.innerHTML='';
  try{ const scanner=new Html5Qrcode('qrReader'); await scanner.start({facingMode:'environment'},{fps:10,qrbox:240}, t=>{ lastText=t; res.textContent='QR: '+t; }); }catch(e){ box.innerHTML='<div class="p-4 text-sm text-red-600">ไม่สามารถเปิดกล้อง: '+(e?.message||e)+'</div>'; }
  initMap(); getGeo(geoState);
  btnC.onclick=async()=>doCheckin('qr+gps'); btnG.onclick=async()=>doCheckin('gps'); await loadToday(); }
export async function renderHomeRecent(){ const box=document.getElementById('homeCheckins'); if(!box)return; box.innerHTML=skel(5,'52px'); const resp=await supabase.from('checkins').select('id,line_display_name,line_picture_url,created_at,distance_m,within_radius,method,text').order('created_at',{ascending:false}).limit(5);
  if(resp.error){ box.innerHTML='<div class="text-gray-500">โหลดเช็คอินไม่สำเร็จ</div>'; return; } const data=resp.data||[]; box.innerHTML=data.map(r=>`<div class="p-2 border border-[#E6EAF0] rounded-lg flex items-center gap-2 bg-white"><img src="${r.line_picture_url||''}" class="w-8 h-8 rounded-full border border-[#E6EAF0]" onerror="this.style.display='none'"><div class="flex-1 min-w-0"><div class="text-sm font-medium truncate">${r.line_display_name||'ไม่ระบุ'}</div><div class="text-[12px] text-gray-500">${new Date(r.created_at).toLocaleString('th-TH',{hour:'2-digit',minute:'2-digit'})} • ${r.method}${r.text?' • '+r.text:''}</div></div><div class="${r.within_radius?'text-green-600':'text-red-600'} text-[12px]">${fmtDist(r.distance_m)}</div></div>`).join('')||'<div class="text-gray-500">ยังไม่มีรายการ</div>'; }
function initMap(){ const el=document.getElementById('map'); if(!el) return; if(map){ map.remove(); map=null; } map=L.map('map').setView([SCHOOL_LAT,SCHOOL_LNG], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  L.circle([SCHOOL_LAT,SCHOOL_LNG],{radius:SCHOOL_RADIUS_METERS,color:'#2563EB',fillOpacity:0.08}).addTo(map);
  L.marker([SCHOOL_LAT,SCHOOL_LNG]).addTo(map).bindPopup('โรงเรียน');
}
function updateMeMarker(lat,lng){ if(!map) return; if(!meMarker){ meMarker=L.marker([lat,lng]).addTo(map).bindPopup('ตำแหน่งของฉัน'); } else { meMarker.setLatLng([lat,lng]); } }
function getGeo(out){ out.textContent='กำลังอ่านตำแหน่ง…'; if(!navigator.geolocation){ out.textContent='อุปกรณ์ไม่รองรับตำแหน่ง'; return; } navigator.geolocation.getCurrentPosition((pos)=>{ const {latitude,longitude,accuracy}=pos.coords; lastGeo={lat:latitude,lng:longitude,accuracy}; updateMeMarker(latitude,longitude); const d=dist(SCHOOL_LAT,SCHOOL_LNG,latitude,longitude); const ok=d<=SCHOOL_RADIUS_METERS; out.innerHTML=`ตำแหน่ง: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)}m) → ${ok?'<span class="text-green-600">ในเขต</span>':'<span class="text-red-600">นอกเขต ('+fmtDist(d)+')'}`; }, (err)=>{ out.textContent='อ่านตำแหน่งไม่สำเร็จ: '+(err?.message||err); }, {enableHighAccuracy:true,timeout:8000,maximumAge:0}); }
function dist(a,b,c,d){ const R=6371000; const toR=x=>x*Math.PI/180; const dLat=toR(c-a), dLon=toR(d-b); const A=Math.sin(dLat/2)**2 + Math.cos(toR(a))*Math.cos(toR(c))*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(A)); }
async function doCheckin(method){ const profile=JSON.parse(localStorage.getItem('LINE_PROFILE')||'null'); if(!profile){ toast('ต้องเข้าสู่ระบบด้วย LINE ก่อน'); return; } if(!lastGeo){ toast('ยังไม่ได้ตำแหน่ง'); return; }
  const distance=dist(SCHOOL_LAT,SCHOOL_LNG,lastGeo.lat,lastGeo.lng); const within=distance<=SCHOOL_RADIUS_METERS;
  if(within===false){
    openSheet(`<div class="text-sm space-y-2">
      <div class="font-semibold">อยู่นอกเขตโรงเรียน — ระบุเหตุผล</div>
      <label class="flex items-center gap-2"><input type="radio" name="p" value="meeting"> ประชุม</label>
      <label class="flex items-center gap-2"><input type="radio" name="p" value="training"> อบรม</label>
      <label class="flex items-center gap-2"><input type="radio" name="p" value="official"> ไปราชการ</label>
      <input id="pWork" class="border border-[#E6EAF0] rounded p-2 w-full" placeholder="หัวข้อ/หน่วยงาน/ภารกิจ">
      <div class="grid grid-cols-2 gap-2"><button id="okOut" class="btn btn-prim">บันทึก</button><button id="cancelOut" class="btn">ยกเลิก</button></div>
    </div>`);
    document.getElementById('cancelOut').onclick=closeSheet;
    document.getElementById('okOut').onclick=async()=>{
      const sel=document.querySelector('input[name="p"]:checked'); const desc=document.getElementById('pWork').value.trim();
      if(!sel){ toast('กรุณาเลือกเหตุผล'); return; }
      if(!desc){ toast('กรุณากรอกรายละเอียด'); return; }
      await saveCheckin({ method: sel.value, text: desc, within });
      closeSheet();
    };
    return;
  }
  await saveCheckin({ method, text:lastText||null, within });
}
async function saveCheckin({ method, text, within }){
  const profile=JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  try{ await supabase.rpc('upsert_user',{ p_line_user_id:profile.userId, p_display_name:profile.displayName||null, p_picture_url:profile.pictureUrl||null, p_email:null }); }catch(e){}
  const distance=dist(SCHOOL_LAT,SCHOOL_LNG,lastGeo.lat,lastGeo.lng);
  const payload={ line_user_id:profile?.userId||null, line_display_name:profile?.displayName||null, line_picture_url:profile?.pictureUrl||null, method, text, lat:lastGeo.lat, lng:lastGeo.lng, accuracy:lastGeo.accuracy, distance_m:Math.round(distance), within_radius:within };
  const ins=await supabase.from('checkins').insert(payload); if(ins.error){ toast('เช็คอินไม่สำเร็จ'); return; } toast(within?'เช็คอินสำเร็จ ✅':'บันทึกภารกิจนอกสถานที่ ✅'); await loadToday();
}
async function loadToday(){ const profile=JSON.parse(localStorage.getItem('LINE_PROFILE')||'null'); const box=document.getElementById('todayList'); if(!box)return; box.innerHTML=''; if(!profile){ box.innerHTML='<div class="text-gray-500">ยังไม่เข้าสู่ระบบ</div>'; return; }
  const start=new Date(); start.setHours(0,0,0,0); const resp=await supabase.from('checkins').select('*').eq('line_user_id',profile.userId).gte('created_at',start.toISOString()).order('created_at',{ascending:false}).limit(50);
  const data=resp.data||[]; box.innerHTML=data.map(r=>`<div class="p-2 border border-[#E6EAF0] rounded-lg flex items-center gap-2 text-sm"><img src="${r.line_picture_url||''}" class="w-8 h-8 rounded-full border border-[#E6EAF0]" onerror="this.style.display='none'"><div class="flex-1">${new Date(r.created_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} — ${r.method}${r.text?' • '+r.text:''}</div><div class="${r.within_radius?'text-green-600':'text-red-600'}">${fmtDist(r.distance_m)}</div></div>`).join('')||'<div class="text-gray-500">ยังไม่มีรายการวันนี้</div>'; }