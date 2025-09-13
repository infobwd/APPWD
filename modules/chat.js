
import { supabase } from '../supabase.js';
import { toast, esc } from '../ui.js';

let sub = null;
const ROOM = 'school-global';

export async function render(){
  const list = document.getElementById('chatList');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  document.getElementById('chatRoomHeader').textContent = `# ห้อง: ${ROOM}`;

  const { data, error } = await supabase.from('chat_messages')
    .select('*').eq('room', ROOM).order('created_at', { ascending: true }).limit(200);
  if(error){ toast('โหลดข้อความไม่สำเร็จ','error'); return; }
  list.innerHTML = data.map(row => bubble(row)).join('');

  if(sub) supabase.removeChannel(sub);
  sub = supabase.channel('chat:'+ROOM)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room=eq.${ROOM}` }, payload => {
      list.insertAdjacentHTML('beforeend', bubble(payload.new));
      list.lastElementChild?.scrollIntoView({behavior:'smooth'});
    })
    .subscribe((s)=>{});

  form.onsubmit = async (e)=>{
    e.preventDefault();
    const content = (input.value||'').trim();
    if(!content) return;
    const prof = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
    const display_name = prof?.displayName || 'ผู้ใช้';
    const avatar_url = prof?.pictureUrl || null;
    const { data:auth } = await supabase.auth.getUser();
    const user_id = auth?.user?.id || null;
    const line_user_id = prof?.userId || null;

    if(!user_id && !line_user_id){
      toast('เข้าสู่ระบบด้วย LINE ก่อนจึงจะส่งข้อความได้','warn');
      return;
    }
    const { error:err } = await supabase.from('chat_messages').insert([{
      room: ROOM, content, user_id, line_user_id, display_name, avatar_url
    }]);
    if(err){ toast('ส่งไม่สำเร็จ','error'); return; }
    input.value='';
  };

  setTimeout(()=>list.lastElementChild?.scrollIntoView({behavior:'smooth'}), 100);
}

function bubble(row){
  const me = whoAmI();
  const itsMe = (row.line_user_id && row.line_user_id===me.line) || (row.user_id && row.user_id===me.uid);
  const ts = new Date(row.created_at||Date.now());
  const time = ts.toLocaleString();
  return `<div class="flex ${itsMe?'justify-end':''}">
    <div class="max-w-[80%] rounded-2xl px-3 py-2 mb-1 ${itsMe?'bg-[var(--prim)] text-white':'bg-[var(--card)] border'}">
      <div class="text-xs opacity-80">${esc(row.display_name||'ผู้ใช้')}</div>
      <div class="whitespace-pre-wrap leading-relaxed">${esc(row.content||'')}</div>
      <div class="text-[11px] opacity-70 mt-1">${time}</div>
    </div>
  </div>`;
}

function whoAmI(){
  const prof = JSON.parse(localStorage.getItem('LINE_PROFILE')||'null');
  const line = prof?.userId || null;
  return { line, uid: null };
}
