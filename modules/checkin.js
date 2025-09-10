import { supabase, currentUser, signedUrl } from '../api.js';

const els = {
  list: () => document.getElementById('myCheckins'),
  btnIn: () => document.getElementById('btnCheckIn'),
  btnOut: () => document.getElementById('btnCheckOut'),
  photo: () => document.getElementById('photoInput'),
};

export async function render(){
  wireButtons();
  await refreshList();
}

function wireButtons(){
  els.btnIn().onclick = () => handleCheck('in');
  els.btnOut().onclick = () => handleCheck('out');
}

async function handleCheck(type){
  const user = await currentUser();
  if(!user){ alert('กรุณาเข้าสู่ระบบก่อน'); return; }

  let lat = null, lng = null;
  try{
    const pos = await new Promise((res, rej)=>navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy:true, timeout:10000 }));
    lat = pos.coords.latitude; lng = pos.coords.longitude;
  }catch(e){
    // continue without GPS
  }

  // optional photo upload
  let photo_path = null;
  const file = els.photo().files?.[0];
  if(file){
    const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${(file.name.split('.').pop()||'jpg')}`;
    const { error: upErr } = await supabase.storage.from('checkin-photos').upload(path, file, { upsert:false, contentType:file.type });
    if(upErr){ alert('อัปโหลดรูปไม่สำเร็จ: ' + upErr.message); return; }
    photo_path = path;
  }

  const { error } = await supabase.from('checkins').insert({
    user_id: user.id, type, lat, lng, photo_path
  });
  if(error){ alert('บันทึกเวลาไม่สำเร็จ: ' + error.message); return; }
  await refreshList();
}

async function refreshList(){
  const user = await currentUser();
  const list = els.list();
  if(!user){ list.innerHTML = '<div class="text-slate-400">กรุณาเข้าสู่ระบบ</div>'; return; }
  list.innerHTML = '<div class="animate-pulse h-4 bg-slate-700/20 rounded w-1/2"></div>';

  const { data, error } = await supabase
    .from('checkins')
    .select('id,type,ts,photo_path,lat,lng')
    .eq('user_id', user.id)
    .order('ts', { ascending:false })
    .limit(20);
  if(error){ list.innerHTML = '<div class="text-red-300">โหลดประวัติไม่สำเร็จ</div>'; return; }

  const rows = await Promise.all((data||[]).map(async (r)=>{
    let img = '';
    if(r.photo_path){
      const url = await signedUrl('checkin-photos', r.photo_path, 3600);
      if(url){ img = `<img src="${url}" class="w-12 h-12 rounded object-cover border border-[#223052]" alt="">`; }
    }
    const time = new Date(r.ts).toLocaleString('th-TH', { dateStyle:'medium', timeStyle:'short' });
    const pos = (r.lat && r.lng) ? `<span class="text-xs text-slate-400">(${r.lat.toFixed(5)}, ${r.lng.toFixed(5)})</span>` : '';
    return `<div class="flex items-center gap-3 p-2 border border-[#223052] rounded-lg">
      ${img}
      <div>
        <div class="font-medium">${r.type === 'in' ? 'เช็คอิน' : 'เช็คเอาท์'} • ${time}</div>
        ${pos}
      </div>
    </div>`;
  }));

  list.innerHTML = rows.join('') || '<div class="text-slate-400">ยังไม่มีข้อมูล</div>';
}
