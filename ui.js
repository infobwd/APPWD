export function toast(msg){ const box=document.getElementById('toast'); box.classList.remove('hide'); box.innerHTML=`<div class="rounded-xl px-3 py-2 shadow-soft bg-white border border-[#E6EAF0]">${msg}</div>`; clearTimeout(window.__toast); window.__toast=setTimeout(()=>box.classList.add('hide'), 2200); }
const sheet=document.getElementById('sheet'); const body=document.getElementById('sheet-body');
export function openSheet(html){ body.innerHTML=html; sheet.classList.add('show'); }
export function closeSheet(){ sheet.classList.remove('show'); }
export function goto(hash){ const old=document.querySelector('.view:not(.hide)'); const t=document.querySelector(hash+'View'); if(!t) return; if(old){ old.classList.add('hide'); } t.classList.remove('hide'); t.classList.add('slide-in'); requestAnimationFrame(()=>t.classList.add('show')); }
export async function copy(text){ try{ await navigator.clipboard.writeText(text); toast('คัดลอกแล้ว'); }catch(e){ toast('คัดลอกไม่สำเร็จ'); } }
