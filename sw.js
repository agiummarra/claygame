/* ClayGame - service worker: rende il gioco installabile e giocabile offline. */
var CACHE = 'claygame-v3';
var CORE = ['./', 'index.html', 'css/style.css', 'js/engine.js', 'js/edu.js', 'js/game.js', 'guida-insegnante.html', 'js/app.js',
  'assets/scenes.js', 'assets/icons/logo.png', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'manifest.webmanifest'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(CORE).then(function () {
      // grafica e suoni: scaricati in background, senza bloccare l'installazione
      fetch('assets/files.json').then(function (r) { return r.json(); }).then(function (list) {
        list.forEach(function (u) { c.add(u).catch(function () { }); });
      }).catch(function () { });
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var isAsset = /\/assets\/(img|audio)\//.test(e.request.url);
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(e.request, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(e.request).then(function (res) {
        if (res && res.ok) c.put(e.request, res.clone());
        return res;
      });
      // immagini e suoni non cambiano mai (nome con hash): cache-first; il resto: rete, con cache di riserva
      if (isAsset && hit) return hit;
      return net.catch(function () { return hit; });
    });
  }));
});
