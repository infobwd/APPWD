
import { supabase } from '../api.js';

const state = { page: 1, limit: 9, tab: 'all', category: 'ทั้งหมด', search: '' };
function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }
function esc(s=''){ const map={ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }; return String(s).replace(/[&<>"']/g,ch=>map[ch]); }
function getHashParams(){ const h=(location.hash||'').split('?')[1]||''; return new URLSearchParams(h); }

export async function initNews(){
  const root=document.getElementById('newsView'); const list=document.getElementById('newsList'); if(!root||!list) return;
  const u=getHashParams(); const tab=(u.get('tab')||'').toLowerCase(); if(tab==='featured') state.tab='featured';
  buildFilterBar(root);
  const prev=document.getElementById('btnPrev'); const next=document.getElementById('btnNext');
  prev?.addEventListener('click',()=>{ if(state.page>1){ state.page--; loadNews(); } });
  next?.addEventListener('click',()=>{ state.page++; loadNews(); });
  await loadNews();
}

function buildFilterBar(root){
  const bar=document.createElement('div'); bar.className='mb-3 flex flex-col sm:flex-row sm:items-center gap-2';
  bar.innerHTML=`
    <div class="flex flex-wrap gap-2">
      <button class="chip ${state.tab==='all'?'active':''}" data-tab="all">ทั้งหมด</button>
      <button class="chip ${state.tab==='featured'?'active':''}" data-tab="featured">เด่น</button>
      <select id="newsCat" class="chip-select"><option value="ทั้งหมด">หมวด: ทั้งหมด</option></select>
    </div>
    <div class="sm:ml-auto"><input id="newsSearch" class="news-search" placeholder="ค้นหาชื่อข่าว…"></div>`;
  const hostCard=root.querySelector('.card'); hostCard?.insertBefore(bar, hostCard.firstChild);
  bar.addEventListener('click',(e)=>{ const btn=e.target.closest('button[data-tab]'); if(!btn) return;
    qsa('.chip').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); state.tab=btn.dataset.tab; state.page=1; loadNews(); });
  const searchEl=bar.querySelector('#newsSearch'); searchEl?.addEventListener('input', debounce(()=>{ state.search=searchEl.value.trim(); state.page=1; loadNews(); },250));
  loadCategories(bar.querySelector('#newsCat'));
}

async function loadCategories(sel){
  try{
    const { data, error } = await supabase.from('posts').select('category').not('category','is',null).order('category',{ascending:true}).range(0,999);
    if (error) throw error;
    const uniq=Array.from(new Set((data||[]).map(r=>r.category))).filter(Boolean);
    sel.innerHTML='<option value="ทั้งหมด">หมวด: ทั้งหมด</option>'+uniq.map(c=>`<option value="${esc(c)}">หมวด: ${esc(c)}</option>`).join('');
    sel.addEventListener('change', ()=>{ state.category=sel.value; state.tab='category'; state.page=1; qsa('.chip').forEach(b=>b.classList.remove('active')); loadNews(); });
  }catch(e){ /* ignore */ }
}

async function loadNews(){
  const list=document.getElementById('newsList'); const pageInfo=document.getElementById('pageInfo');
  const from=(state.page-1)*state.limit; const to=from+state.limit-1;
  let q=supabase.from('posts').select('id,title,cover_url,body,category,published_at,is_featured',{count:'exact'})
    .lte('published_at', new Date().toISOString()).order('published_at',{ascending:false}).range(from,to);
  if(state.tab==='featured') q=q.eq('is_featured',true);
  if(state.tab==='category' && state.category && state.category!=='ทั้งหมด') q=q.eq('category', state.category);
  if(state.search) q=q.ilike('title', `%${state.search}%`);
  const { data, error, count } = await q;
  if(error){ console.error(error); list.innerHTML='<div class="text-sm text-red-600">โหลดข่าวไม่สำเร็จ</div>'; return; }
  list.innerHTML = renderNewsList(data||[]);
  const total=count||0; const maxPage=Math.max(1, Math.ceil(total/state.limit));
  pageInfo.textContent=`หน้า ${state.page} / ${maxPage} • ทั้งหมด ${total} ข่าว`;
}

function renderNewsList(rows){ if(!rows.length) return '<div class="text-sm text-ink3">ไม่พบข่าว</div>'; return '<div class="news-grid">'+rows.map(card).join('')+'</div>'; }

function card(r){
  const hasImg=!!(r.cover_url && r.cover_url.trim()); const title=esc(r.title);
  const date=r.published_at ? new Date(r.published_at).toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'numeric'}) : '';
  const href=`#news?post=${r.id}`; const badge=r.is_featured?'<span class="badge" style="right:10px; top:10px">เด่น</span>':'';
  const media = hasImg ? `<img class="thumb" src="${r.cover_url}" alt="">`
                       : `<div class="thumb grid place-items-center text-4xl" style="aspect-ratio:16/9; border-top-left-radius:14px; border-top-right-radius:14px; background:var(--card); border-bottom:1px solid var(--bd)">📰</div>`;
  const snippet = makeSnippet(r.body||'', 110);
  return `<article class="news-card">
    ${media}${badge}
    <div class="p-3">
      <a class="font-semibold block hover:underline" href="${href}">${title}</a>
      <div class="text-xs text-ink3 mb-1">${date}${r.category? ' • '+esc(r.category):''}</div>
      <div class="text-sm text-ink2 line-clamp-2">${esc(snippet)}</div>
      <div class="mt-2 flex gap-2"><a class="btn" href="${href}">อ่าน</a><button class="btn" onclick="window.sharePost && window.sharePost(${r.id})">แชร์</button></div>
    </div></article>`;
}

function makeSnippet(html, maxLen=110){ const txt=String(html).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); return txt.length>maxLen? (txt.slice(0,maxLen-1)+'…') : txt; }
function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }

document.addEventListener('DOMContentLoaded', ()=>{ if(document.getElementById('newsView')) initNews(); });
