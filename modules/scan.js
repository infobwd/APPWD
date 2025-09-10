export async function render(){
  const box = document.getElementById('qrReader');
  const result = document.getElementById('scanResult');
  result.textContent = 'กำลังเตรียมกล้อง...';
  if(!window.Html5Qrcode){ result.textContent='ไม่พบไลบรารีสแกน (ตรวจการเชื่อมต่ออินเทอร์เน็ต)'; return; }
  const id = 'reader';
  box.innerHTML = `<div id="${id}" style="width:100%"></div>`;
  const qr = new Html5Qrcode(id);
  try{
    const cam = (await Html5Qrcode.getCameras())[0];
    await qr.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText)=>{
        result.innerHTML = `<div class="p-3 border border-[#E6EAF0] rounded-xl bg-white">
          <div class="font-medium">ผลสแกน:</div>
          <div class="text-sm break-words">${escapeHtml(decodedText)}</div>
          <div class="mt-2 flex gap-2">
            <a href="${decodedText}" target="_blank" rel="noopener" class="btn btn-prim">เปิดลิงก์</a>
            <button class="btn" id="btnCopy">คัดลอก</button>
          </div>
        </div>`;
        document.getElementById('btnCopy').onclick=()=>{ navigator.clipboard.writeText(decodedText); };
      },
      (err)=>{ /* ignore */ }
    );
  }catch(e){
    result.textContent = 'ไม่สามารถเปิดกล้องได้: ' + e;
  }
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
