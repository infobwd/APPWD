
import * as CFG from '../config.js';
import { supabase } from '../api.js';

function enc(obj){ return encodeURIComponent(JSON.stringify(obj||{})); }
function getLiffDeepLink(params){
  const liffId = (CFG?.LIFF_ID) || (window.LIFF_ID || '');
  return 'https://liff.line.me/' + liffId + '?' + (params.sharePost ? ('sharePost=' + encodeURIComponent(params.sharePost)) : ('flexShare=' + enc(params||{})));
}
async function ensureLiff(){
  if (!window.liff) throw new Error('LIFF SDK not loaded');
  if (!liff.isInitialized()) { const liffId = (CFG?.LIFF_ID) || (window.LIFF_ID || ''); await liff.init({ liffId }); }
  return liff;
}
export function makeFlexNewsCard({ title, desc, url, img }){
  return {
    type:'bubble',
    hero: img ? { type:'image', url:img, size:'full', aspectRatio:'20:13', aspectMode:'cover' } : undefined,
    body:{ type:'box', layout:'vertical', spacing:'sm', contents:[
      { type:'text', text:title||'ข่าว', weight:'bold', size:'md', wrap:true },
      desc ? { type:'text', text:desc, size:'sm', color:'#6b7280', wrap:true } : { type:'spacer', size:'xs' }
    ]},
    footer:{ type:'box', layout:'vertical', spacing:'sm', contents:[
      { type:'button', style:'primary', action:{ type:'uri', label:'อ่านข่าว', uri:url || CFG.PUBLIC_URL || location.href } }
    ]}
  };
}
export async function shareFlexStrict(altText, bubble){
  try{
    const sdk = await ensureLiff();
    const can = sdk.isInClient() && await sdk.isApiAvailable('shareTargetPicker');
    if (can){ await sdk.shareTargetPicker([{ type:'flex', altText, contents:bubble }]); return; }
  }catch{}
  location.href = getLiffDeepLink({ altText, bubble });
}
export async function sharePostData({ title, url, img, desc, id }){
  const bubble = makeFlexNewsCard({ title, desc, url, img });
  // ถ้าอยู่นอก LINE → ใช้ deep link ด้วย id เพื่อ payload เล็ก
  try{
    const sdk = await ensureLiff();
    const can = sdk.isInClient() && await sdk.isApiAvailable('shareTargetPicker');
    if (can){ await sdk.shareTargetPicker([{ type:'flex', altText:title||'ข่าว', contents:bubble }]); return; }
  }catch{}
  if (id){ location.href = getLiffDeepLink({ sharePost:String(id) }); return; }
  location.href = getLiffDeepLink({ altText:title||'ข่าว', bubble });
}
async function sharePostId(pid){
  try{
    const id = Number(pid); if (!id) return;
    const { data } = await supabase.from('posts').select('*').eq('id', id).maybeSingle();
    const title = data?.title || data?.name || document.title;
    const img = data?.cover_url || data?.image_url || data?.cover || data?.thumb || '';
    const desc = (data?.summary || data?.desc || data?.description || data?.content || '').replace(/<[^>]+>/g,' ').slice(0,140);
    const url = (CFG.PUBLIC_URL || location.origin + location.pathname) + '#news?post=' + id;
    await sharePostData({ title, url, img, desc, id });
  }catch(e){}
}
window.LINE_SHARE = { makeFlexNewsCard, shareFlexStrict, sharePostData };
// Auto-run when opened via ?flexShare=... or ?sharePost=/article=
(async function(){
  try{
    const params = new URLSearchParams(location.search);
    const payload = params.get('flexShare');
    const postId = params.get('sharePost') || params.get('article');
    if (!payload && !postId) return;
    await ensureLiff();
    const can = liff.isInClient() && await liff.isApiAvailable('shareTargetPicker');
    if (postId){ await sharePostId(postId); return; }
    const data = JSON.parse(decodeURIComponent(payload));
    if (can){
      await liff.shareTargetPicker([{ type:'flex', altText: data.altText || 'แชร์', contents: data.bubble }]);
      history.replaceState({}, '', location.pathname);
      setTimeout(()=>{ try{ window.close(); }catch{} }, 500);
    } else {
      alert('กรุณาเปิดในแอป LINE เพื่อแชร์');
    }
  }catch(e){}
})();
