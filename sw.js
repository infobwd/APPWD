
const CACHE='appwd-v5.4.1';
const ASSETS=['./','./index.html','./app.js','./ui.js','./api.js','./config.js','./liff.js','./auth-bridge.html','./modules/news.js','./modules/links.js','./modules/checkin.js','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE && k.startsWith('appwd-')).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{const req=e.request;const url=new URL(req.url);
  const isHTML = req.mode==='navigate' || req.destination==='document' || url.pathname.endsWith('.html');
  if(isHTML){e.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));return res;}).catch(()=>caches.match(req)));return;}
  if(url.origin===location.origin && (ASSETS.includes(url.pathname)||/\.(js|css|png|jpg|jpeg|gif|webp|svg|json)$/i.test(url.pathname))){e.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));return res;})));}
});
self.addEventListener('message',e=>{ if(e.data==='SKIP_WAITING') self.skipWaiting(); });
