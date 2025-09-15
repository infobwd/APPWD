
import * as CFG from '../config.js';
function enc(o){return encodeURIComponent(JSON.stringify(o||{}));}
function getLiffDeepLink(params){ const id=(CFG?.LIFF_ID)||(window.LIFF_ID||''); return 'https://liff.line.me/'+id+'?flexShare='+enc(params||{}); }
async function ensureLiff(){ if(!window.liff) throw new Error('LIFF SDK not loaded'); if(!liff.isInitialized()){ const id=(CFG?.LIFF_ID)||(window.LIFF_ID||''); await liff.init({liffId:id}); } return liff; }
export function makeFlexNewsCard({ title, desc, url, img }){
  return { type:'bubble',
    hero: img ? { type:'image', url:img, size:'full', aspectRatio:'20:13', aspectMode:'cover' } : undefined,
    body:{ type:'box', layout:'vertical', contents:[
      { type:'text', text:title||'ข่าว', weight:'bold', size:'md', wrap:true },
      desc ? { type:'text', text:desc, size:'sm', color:'#6b7280', wrap:true } : { type:'spacer', size:'xs' }
    ]},
    footer:{ type:'box', layout:'vertical', contents:[
      { type:'button', style:'primary', action:{ type:'uri', label:'อ่านข่าว', uri:url || CFG.PUBLIC_URL || location.href } }
    ]}
  };
}
export async function shareFlexStrict(altText, bubble){
  try{ const sdk=await ensureLiff(); const can=sdk.isInClient() && await sdk.isApiAvailable('shareTargetPicker');
    if(can){ await sdk.shareTargetPicker([{ type:'flex', altText, contents:bubble }]); return; } }catch{}
  location.href = getLiffDeepLink({ altText, bubble });
}
export async function sharePostData({ title, url, img, desc }){ const b=makeFlexNewsCard({ title, url, img, desc }); await shareFlexStrict(title||'ข่าว', b); }
window.LINE_SHARE = { makeFlexNewsCard, shareFlexStrict, sharePostData };
(async function(){ try{ const p=new URLSearchParams(location.search); const payload=p.get('flexShare'); if(!payload) return;
  await ensureLiff(); const data=JSON.parse(decodeURIComponent(payload));
  const can=liff.isInClient() && await liff.isApiAvailable('shareTargetPicker');
  if(can){ await liff.shareTargetPicker([{ type:'flex', altText:data.altText||'แชร์', contents:data.bubble }]); history.replaceState({},'',location.pathname); setTimeout(()=>{ try{window.close()}catch{} },400); }
  else{ alert('กรุณาเปิดในแอป LINE เพื่อแชร์'); }
}catch(e){} })();
