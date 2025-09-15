
// Robust LINE share helpers: shareTargetPicker + Flex with graceful fallback
import * as CFG from '../config.js';

async function ensureLiff() {
  if (!window.liff) throw new Error('LIFF SDK not loaded');
  if (!liff.isInitialized()) {
    const liffId = (CFG?.LIFF_ID) || (window.LIFF_ID || '');
    await liff.init({ liffId });
  }
  return liff;
}

export async function shareText(text) {
  try{
    const sdk = await ensureLiff();
    const canPicker = sdk.isInClient() && await sdk.isApiAvailable('shareTargetPicker');
    if (canPicker) {
      await sdk.shareTargetPicker([{ type: 'text', text }]);
      return;
    }
  }catch{}
  // Fallback: open web share URL
  const url = 'https://line.me/R/msg/text/?' + encodeURIComponent(text);
  window.open(url, '_blank');
}

export async function shareFlex(altText, bubble) {
  const sdk = await ensureLiff();
  const msg = { type:'flex', altText, contents:bubble };
  const canPicker = sdk.isInClient() && await sdk.isApiAvailable('shareTargetPicker');
  if (canPicker) {
    await sdk.shareTargetPicker([msg]);
  } else {
    alert('การแชร์ Flex ต้องเปิดจากในแอป LINE');
  }
}

export function makeFlexNewsCard({ title, desc, url, img }) {
  return {
    type: "bubble",
    hero: img ? { type:"image", url: img, size:"full", aspectRatio:"20:13", aspectMode:"cover" } : undefined,
    body: {
      type: "box", layout: "vertical", spacing: "sm",
      contents: [
        { type: "text", text: title || "ข่าว", weight: "bold", size: "md", wrap: true },
        desc ? { type: "text", text: desc, size: "sm", color: "#6b7280", wrap: true } : { type:"spacer", size:"xs" }
      ]
    },
    footer: {
      type: "box", layout: "vertical", spacing: "sm",
      contents: [
        { type:"button", style:"primary", action:{ type:"uri", label:"อ่านข่าว", uri: url || CFG.PUBLIC_URL || location.href } }
      ]
    }
  };
}

export async function sharePost({ title, url, img, desc }){
  try{
    const bubble = makeFlexNewsCard({ title, desc, url, img });
    await shareFlex(title || 'ข่าว', bubble);
  }catch(e){
    const text = `${title ? title + "\n" : ""}${url || CFG.PUBLIC_URL || location.href}`;
    await shareText(text);
  }
}

window.LINE_SHARE = { shareText, shareFlex, sharePost, makeFlexNewsCard };
