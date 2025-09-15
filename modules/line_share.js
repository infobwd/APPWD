
import * as CFG from '../config.js';
function enc(obj){ return encodeURIComponent(JSON.stringify(obj||{})); }
function getLiffDeepLink(params){
  const liffId = (CFG?.LIFF_ID) || (window.LIFF_ID || '');
  return 'https://liff.line.me/' + liffId + '?flexShare=' + enc(params||{});
}
async function ensureLiff(){
  if (!window.liff) throw new Error('LIFF SDK not loaded');
  if (!liff.isInitialized()) { const liffId = (CFG?.LIFF_ID) || (window.LIFF_ID || ''); await liff.init({ liffId }); }
  return liff;
}
export function makeFlexNewsCard({ title, desc, url, img }){
  return { type:'bubble',
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
export async function sharePostData({ title, url, img, desc }){
  const bubble = makeFlexNewsCard({ title, desc, url, img });
  await shareFlexStrict(title || 'ข่าว', bubble);
}
window.LINE_SHARE = { makeFlexNewsCard, shareFlexStrict, sharePostData };
(async function(){
  try{
    const params = new URLSearchParams(location.search);
    const payload = params.get('flexShare'); if (!payload) return;
    await ensureLiff();
    const data = JSON.parse(decodeURIComponent(payload));
    const can = liff.isInClient() && await liff.isApiAvailable('shareTargetPicker');
    if (can){
      await liff.shareTargetPicker([{ type:'flex', altText: data.altText || 'แชร์', contents:data.bubble }]);
      history.replaceState({}, '', location.pathname);
      setTimeout(()=>{ try{ window.close(); }catch{} }, 500);
    }else{ alert('กรุณาเปิดในแอป LINE เพื่อแชร์'); }
  }catch(e){}
})();
