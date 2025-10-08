self.addEventListener('install', e=>{
  e.waitUntil(caches.open('app-v1').then(c=>c.addAll(['/','/index.html','/styles.css','/app.js','/privacy.html','/disclaimer.html','/about.html'])));
});
self.addEventListener('fetch', e=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});
