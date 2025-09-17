import * as News from './modules/news.js';
import * as Links from './modules/links.js';
import * as Checkin from './modules/checkin.js';
import * as Admin from './modules/profile_admin.js';
import { goto, openPrefs } from './ui.js';

function setActive(hash) { 
  document.querySelectorAll('.navbtn').forEach(b => { 
    b.classList.toggle('active', b.getAttribute('data-nav') === hash); 
  }); 
}

function parseHash() { 
  const raw = location.hash || '#home'; 
  const parts = raw.split('?'); 
  const path = parts[0]; 
  const qs = parts[1] || ''; 
  const params = {};
  
  if (qs) { 
    qs.split('&').forEach(p => { 
      const kv = p.split('='); 
      const k = decodeURIComponent(kv[0] || ''); 
      const v = decodeURIComponent(kv[1] || ''); 
      if (k) params[k] = v; 
    }); 
  } 
  
  return { path, params }; 
}

async function route() { 
  const { path, params } = parseHash(); 
  const h = path || '#home'; 
  setActive(h);
  
  try {
    if (h === '#home') { 
      goto('#home'); 
      
      // Ensure CSS is injected before rendering
      await ensureCheckinStyles();
      
      // Render components in proper order
      await Promise.all([
        News.renderHome(),
        Checkin.initTabs()
      ]);
      
      // Then render data-dependent components
      await Checkin.renderHomeRecent('work');
      await Checkin.renderHomeSummary();
      await Links.render();
      
    } else if (h === '#news') { 
      goto('#news'); 
      await News.renderList(); 
      
    } else if (h === '#post') { 
      goto('#post'); 
      await News.renderDetail(params.id); 
      
    } else if (h === '#links') { 
      goto('#links'); 
      await Links.render(); 
      
    } else if (h === '#profile') { 
      goto('#profile'); 
      await Admin.render(); 
      
    } else if (h === '#checkin') { 
      goto('#checkin'); 
      await ensureCheckinStyles();
      await Checkin.render(); 
    }
    
  } catch (error) {
    console.error('Routing error:', error);
    // Show user-friendly error if needed
    if (h === '#home') {
      const homeView = document.getElementById('homeView');
      if (homeView) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'card p-4 text-center text-red-600 mb-4';
        errorDiv.innerHTML = 'เกิดข้อผิดพลาดในการโหลดหน้าแรก กรุณาลองรีเฟรชหน้า';
        homeView.insertBefore(errorDiv, homeView.firstChild);
      }
    }
  }
}

// Ensure checkin styles are loaded
async function ensureCheckinStyles() {
  return new Promise((resolve) => {
    if (document.getElementById('checkin-enhanced-styles')) {
      resolve();
      return;
    }
    
    const style = document.createElement('style');
    style.id = 'checkin-enhanced-styles';
    style.textContent = `
      .badge {
        display: inline-flex !important;
        align-items: center;
        gap: 0.25rem;
        padding: 0.125rem 0.5rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
        opacity: 1 !important;
        visibility: visible !important;
      }
      
      .badge-ontime {
        background-color: #dcfce7 !important;
        color: #166534 !important;
        border: 1px solid #bbf7d0 !important;
      }
      
      .badge-late {
        background-color: #fef3c7 !important;
        color: #92400e !important;
        border: 1px solid #fde68a !important;
      }
      
      .badge-offsite {
        background-color: #e0e7ff !important;
        color: #3730a3 !important;
        border: 1px solid #c7d2fe !important;
      }
      
      .btn-sm {
        padding: 0.375rem 0.75rem;
        font-size: 0.875rem;
        border-radius: 0.5rem;
      }
      
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      
      .animate-spin {
        animation: spin 1s linear infinite;
      }
      
      #homeCheckins .card {
        transition: all 0.2s ease;
        min-height: 60px;
        border: 1px solid var(--bd);
      }
      
      #homeCheckins .card:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      
      @media (max-width: 420px) {
        .badge {
          font-size: 0.7rem !important;
          padding: 0.125rem 0.375rem !important;
        }
      }
    `;
    
    document.head.appendChild(style);
    
    // Wait a bit to ensure styles are applied
    setTimeout(resolve, 10);
  });
}

function bindUI() { 
  const back = document.getElementById('btnBackList'); 
  if (back) back.onclick = () => { location.hash = '#news'; };
  
  const fab = document.getElementById('fabScan'); 
  if (fab) fab.onclick = () => { location.hash = '#checkin'; };
  
  const btnTheme = document.getElementById('btnTheme'); 
  if (btnTheme) btnTheme.onclick = () => openPrefs();
  
  document.querySelectorAll('.navbtn,[data-nav]').forEach(el => { 
    el.addEventListener('click', e => { 
      e.preventDefault(); 
      const to = el.getAttribute('data-nav'); 
      if (to) location.hash = to; 
    }); 
  });
  
  // Enhanced checkin tab binding with debounce
  let tabTimeout;
  document.querySelectorAll('[data-ci-tab]').forEach(el => { 
    el.addEventListener('click', () => { 
      const purpose = el.getAttribute('data-ci-tab');
      
      // Clear existing timeout
      if (tabTimeout) clearTimeout(tabTimeout);
      
      // Update tab state immediately
      document.querySelectorAll('[data-ci-tab]').forEach(tab => {
        tab.classList.toggle('btn-prim', tab.getAttribute('data-ci-tab') === purpose);
      });
      
      // Debounced render
      tabTimeout = setTimeout(() => {
        Checkin.renderHomeRecent(purpose).catch(console.error);
      }, 150);
    }); 
  }); 
}

// Enhanced error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

window.addEventListener('hashchange', route);
document.addEventListener('DOMContentLoaded', () => { 
  bindUI(); 
  route(); 
});
