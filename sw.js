const CACHE = 'wd-portal-v3';
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./app.js','./api.js','./config.js','./liff-bridge.js']))); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); });
self.addEventListener('fetch', e=>{
  if(e.request.method!=='GET') return;
  e.respondWith((async()=>{
    const cached = await caches.match(e.request);
    try{
      const fresh = await fetch(e.request);
      const c = await caches.open(CACHE);
      c.put(e.request, fresh.clone());
      return fresh;
    }catch(_){ return cached || new Response('offline', { status: 200, headers: { 'Content-Type': 'text/plain' } }); }
  })());
});