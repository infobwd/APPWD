const PAGE_SIZE = 10;
let page = 1, total = 0;
let sliderTimer = null;

// ==== ตัวกรอง ====
let currentCat = '__ALL__';
let featuredOnly = false;

async function setupNewsFilters(){
  // เตรียม container
  let bar = document.getElementById('newsFilterBar');
  const listEl = document.getElementById('newsList');
  if(!bar){
    bar = document.createElement('div');
    bar.id = 'newsFilterBar';
    bar.className = 'flex items-center gap-2 flex-wrap mb-3';
    if(listEl) listEl.insertAdjacentElement('beforebegin', bar);
  }
  if(!bar) return;

  // ดึงหมวดหมู่ (unique)
  const { data: catsRows } = await supabase
    .from('posts')
    .select('category')
    .not('category','is',null)
    .neq('category','')
    .order('category',{ ascending:true });

  const cats = ['ทั้งหมด', ...Array.from(new Set((catsRows||[]).map(r=>r.category)))];

  // เรนเดอร์แท็บ + สวิตช์ "เฉพาะข่าวเด่น"
  bar.innerHTML = `
    <div class="overflow-x-auto">
      <div class="flex gap-2" id="newsCatChips">
        ${cats.map(c=>`
          <button class="cat-tab ${c==='ทั้งหมด'?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>
        `).join('')}
      </div>
    </div>
    <label class="ml-auto flex items-center gap-2 text-sm">
      <input type="checkbox" id="newsFeaturedOnly" ${featuredOnly?'checked':''}>
      เฉพาะข่าวเด่น
    </label>
  `;

  // คลิกเปลี่ยนหมวด
  bar.querySelectorAll('.cat-tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      bar.querySelectorAll('.cat-tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      currentCat = btn.dataset.cat;
      loadPage(1);
    });
  });

  // สลับเฉพาะข่าวเด่น
  const chk = bar.querySelector('#newsFeaturedOnly');
  if(chk){
    chk.addEventListener('change', ()=>{
      featuredOnly = chk.checked;
      loadPage(1);
    });
  }
}
