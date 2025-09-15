
import * as CFG from '../config.js';
async function ensureLiff() {
  if (!window.liff) throw new Error('LIFF SDK not loaded');
  if (!liff.isInitialized()) { const liffId = (CFG?.LIFF_ID) || (window.LIFF_ID || ''); await liff.init({ liffId }); }
  return liff;
}
export async function shareText(text) {
  try{ if (navigator.share) { await navigator.share({ text }); return; } }catch{}
  try{
    const sdk = await ensureLiff();
    const can = sdk.isInClient() && await sdk.isApiAvailable('shareTargetPicker');
    if (can) { await sdk.shareTargetPicker([{ type:'text', text }]); return; }
  }catch{}
  window.open('https://line.me/R/msg/text/?' + encodeURIComponent(text), '_blank');
}
export async function shareFlex(altText, bubble) {
  const sdk = await ensureLiff();
  const msg = { type:'flex', altText, contents:bubble };
  const can = sdk.isInClient() && await sdk.isApiAvailable('shareTargetPicker');
  if (can) await sdk.shareTargetPicker([msg]);
  else alert('การแชร์ Flex ต้องเปิดจากในแอป LINE');
}
export function makeFlexNewsCard({ title, desc, url, img }){
  return {
    type:"bubble",
    hero: img ? { type:"image", url:img, size:"full", aspectRatio:"20:13", aspectMode:"cover" } : undefined,
    body:{ type:"box", layout:"vertical", spacing:"sm", contents:[
      { type:"text", text: title || "ข่าว", weight:"bold", size:"md", wrap:true },
      desc ? { type:"text", text: desc, size:"sm", color:"#6b7280", wrap:true } : { type:"spacer", size:"xs" }
    ]},
    footer:{ type:"box", layout:"vertical", spacing:"sm", contents:[
      { type:"button", style:"primary", action:{ type:"uri", label:"อ่านข่าว", uri: url || CFG.PUBLIC_URL || location.href } }
    ]}
  };
}
export async function sharePostData({ title, url, img, desc }){
  try{
    const sdk = await ensureLiff().catch(()=>null);
    if (sdk && sdk.isInClient && sdk.isInClient() && await sdk.isApiAvailable('shareTargetPicker')) {
      const bubble = makeFlexNewsCard({ title, desc, url, img });
      await shareFlex(title || 'ข่าว', bubble);
      return;
    }
  }catch{}
  try{
    if (navigator.share) { await navigator.share({ title: title||document.title, text: desc||'', url: url||location.href }); return; }
  }catch{}
  await shareText(`${title ? title + "\n" : ""}${url || location.href}`);
}
window.LINE_SHARE = { shareText, shareFlex, makeFlexNewsCard, sharePostData };
