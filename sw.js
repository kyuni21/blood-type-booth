// 오프라인 캐시 서비스 워커 — 네트워크 우선(3초), 실패하면 캐시. 파일 목록을 바꾸면 VERSION을 올릴 것
const VERSION = 'btb-v1';
const FILES = [
  './', 'index.html', 'wall.html', 'manifest.webmanifest', 'icon.svg',
  'css/style.css', 'js/genetics.js', 'js/store.js', 'js/app.js', 'js/wall.js'
];
const TIMEOUT_MS = 3000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const fromCache = () => caches.match(e.request, { ignoreSearch: true });
  const fromNet = new Promise((resolve, reject) => {
    const t = setTimeout(reject, TIMEOUT_MS);
    fetch(e.request).then((res) => {
      clearTimeout(t);
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      resolve(res);
    }, (err) => { clearTimeout(t); reject(err); });
  });
  e.respondWith(fromNet.catch(() => fromCache().then((hit) => hit || Response.error())));
});
