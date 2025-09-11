import { supabase } from '../api.js';
import { toast } from '../ui.js';
export async function scanCheckin(){ location.hash='#scan'; }
export async function gpsCheckin(){
  if(!navigator.geolocation){ toast('อุปกรณ์ไม่รองรับ GPS'); return; }
  navigator.geolocation.getCurrentPosition(async pos=>{
    const { latitude:lat, longitude:lon } = pos.coords || {};
    const SCHOOL = { lat: 14.102000, lon: 99.511000 };
    const ok = distanceMeters(lat,lon,SCHOOL.lat,SCHOOL.lon) <= 120;
    if(!ok){ toast('อยู่นอกเขตเช็คอิน'); return; }
    await saveCheckin('gps', null, lat, lon);
  }, err=> toast('เปิด GPS ไม่สำเร็จ'));
}
export async function saveCheckin(method, payload=null, lat=null, lon=null){
  const { data: session } = await supabase.auth.getUser();
  if(!session?.user){ toast('กรุณาเข้าสู่ระบบ'); return; }
  const { error } = await supabase.from('checkins').insert({ user_id: session.user.id, method, payload, lat, lon });
  toast(error ? 'บันทึกเช็คอินไม่สำเร็จ' : 'เช็คอินสำเร็จ');
}
function distanceMeters(lat1,lon1,lat2,lon2){
  const toRad = v=> v*Math.PI/180, R=6371000;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}