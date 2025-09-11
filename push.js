import { VAPID_PUBLIC_KEY, PUSH_FUNCTION_URL } from './config.js';
import { supabase } from './api.js';
function urlBase64ToUint8Array(base64String){
  const padding='='.repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64); const arr=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;++i) arr[i]=raw.charCodeAt(i);
  return arr;
}
export async function enablePush(){
  if(!('serviceWorker' in navigator) || !('PushManager' in window)){
    alert('อุปกรณ์นี้ยังไม่รองรับการแจ้งเตือน'); return;
  }
  const perm = await Notification.requestPermission();
  if(perm!=='granted'){ alert('ต้องอนุญาตการแจ้งเตือนก่อน'); return; }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  const { data: session } = await supabase.auth.getUser(); const uid = session?.user?.id; if(!uid){ alert('กรุณาเข้าสู่ระบบ'); return; }
  const json = sub.toJSON();
  await supabase.from('push_subscriptions').insert({ user_id: uid, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent });
  alert('เปิดการแจ้งเตือนแล้ว');
}
export async function broadcast(payload){
  await fetch(PUSH_FUNCTION_URL, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
}