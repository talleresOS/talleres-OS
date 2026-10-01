const CACHE='talleros-phase2-2.2.0';
const SHELL=['./','./index.html','./styles.css','./app.js','./domain.mjs','./storage.mjs','./service.mjs','./pwa.js','./manifest.webmanifest','./manifest.json','./icon.svg','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./version.json'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
// Deliberately no skipWaiting: every old tab must close before changing the database version.
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('talleros')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const hit=await cache.match(event.request);
    if(hit)return hit;
    try{const response=await fetch(event.request);return response;}
    catch{if(event.request.mode==='navigate')return cache.match('./index.html');return Response.error();}
  }));
});
