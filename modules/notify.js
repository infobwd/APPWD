import { supabase } from '../api.js';
import { openSheet, toast } from '../ui.js';

let cached = []; let unread = 0;
const badge = document.getElementById('badgeBell');

export async function initRealtime(currentUser){
  const { data: list } = await supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(20);
  cached = list || [];
  unread = await computeUnread(currentUser?.id);
  setBadge(unread);

  supabase.channel('notif')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, async payload => {
      const n = payload.new;
      cached.unshift(n);
      toast('🔔 ' + n.title);
      setBadge((unread||0)+1);
    })
    .subscribe();
}

function setBadge(n){
  unread = n;
  if(!badge) return;
  if(n>0){ badge.textContent=String(n); badge.classList.remove('hide'); }
  else { badge.classList.add('hide'); }
}

async function computeUnread(uid){
  if(!uid || !cached?.length) return 0;
  const ids = cached.map(x=>x.id);
  const { data: reads } = await supabase.from('notification_reads').select('notif_id').in('notif_id', ids).eq('user_id', uid);
  const readSet = new Set((reads||[]).map(x=>x.notif_id));
  return cached.filter(x=>!readSet.has(x.id)).length;
}

function renderItem(n){
  const when = new Date(n.created_at).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'});
  const go = n.url ? `location.hash='${n.url}'` : '';
  return `<article class="p-3 border rounded-xl bg-white cursor-pointer" onclick="${go}">
    <div class="font-semibold">${esc(n.title)}</div>
    <div class="text-sm text-gray-600">${esc(n.body||'')}</div>
    <div class="text-[11px] text-gray-500 mt-1">${when}</div>
  </article>`;
}

export function openInbox(){
  openSheet(`<div class="flex items-center justify-between mb-2">
      <div class="text-base font-semibold">การแจ้งเตือน</div>
      <div class="flex items-center gap-2">
        <button id="btnMarkAll" class="btn">ทำเป็นอ่านแล้ว</button>
        <button id="btnNewNotif" class="btn btn-prim hide">+ ส่งแจ้งเตือน</button>
      </div>
    </div>
    <div id="inboxList" class="grid gap-2">${(cached||[]).map(renderItem).join('')}</div>`);

  isEditor().then(ok=>{ if(ok) document.getElementById('btnNewNotif').classList.remove('hide'); });
  document.getElementById('btnMarkAll').onclick = markAllRead;
  const newBtn = document.getElementById('btnNewNotif');
  if(newBtn){ newBtn.onclick = composeAndSend; }
}

async function markAllRead(){
  const { data: session } = await supabase.auth.getUser();
  const uid = session?.user?.id; if(!uid) return;
  const ids = (cached||[]).map(x=>x.id);
  for(const id of ids){ await supabase.from('notification_reads').upsert({ notif_id: id, user_id: uid }); }
  setBadge(0);
}

async function composeAndSend(){
  openSheet(`<form id="notifForm" class="grid gap-2 text-sm">
    <input name="title" placeholder="หัวข้อ" class="border border-[#E6EAF0] rounded p-2" required>
    <textarea name="body" rows="4" placeholder="ข้อความ" class="border border-[#E6EAF0] rounded p-2"></textarea>
    <input name="url" placeholder="ลิงก์ (#post?id=123)" class="border border-[#E6EAF0] rounded p-2">
    <label class="text-sm">กลุ่มเป้าหมาย (ออปชัน): <input name="audience" placeholder='{"role":["teacher"]}' class="border border-[#E6EAF0] rounded p-1 w-full"></label>
    <div class="flex gap-2"><button class="btn btn-prim">บันทึก & ส่ง OS Push</button><button type="button" id="cancelSheet" class="btn">ยกเลิก</button></div>
  </form>`);
  document.getElementById('cancelSheet').onclick = ()=>document.getElementById('sheet').classList.remove('show');
  const form=document.getElementById('notifForm');
  form.onsubmit = async (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      title: fd.get('title'),
      body: fd.get('body')||null,
      url: fd.get('url')||null,
      audience: fd.get('audience') ? JSON.parse(fd.get('audience')) : null
    };
    const { data: row, error } = await supabase.from('notifications').insert(payload).select('id').single();
    if(error){ toast('บันทึกแจ้งเตือนไม่สำเร็จ'); return; }
    import('../push.js').then(m=>m.broadcast(payload));
    toast('ส่งแจ้งเตือนแล้ว');
    document.getElementById('sheet').classList.remove('show');
  };
}

async function isEditor(){
  const { data: session } = await supabase.auth.getUser();
  const u=session.user; if(!u) return false;
  const { data } = await supabase.from('editors').select('user_id').eq('user_id',u.id).maybeSingle();
  return !!data;
}

function esc(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
