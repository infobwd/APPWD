// sw.js — minimal safe version (injected)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
// no fetch handler during dev; add caching strategies in prod when ready
