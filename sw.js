// オフラインでも開けるように、アプリの部品を端末にしまっておく。
// 部品を変えたら VERSION を上げる（古いしまい場所は消える）。
const VERSION = 'manabi-v12';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-48.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/maskable-512.png',
  'assets/models/piyo_base_rig.glb',
  'css/style.css',
  'js/characters.js',
  'js/bgm.js',
  'js/bonus.js',
  'js/icons.js',
  'js/controls.js',
  'js/data/english.js',
  'js/data/kanji.js',
  'js/importer.js',
  'js/ink/input.js',
  'js/ink/pad.js',
  'js/ink/stroke.js',
  'js/main.js',
  'js/math.js',
  'js/planner.js',
  'js/progress.js',
  'js/quests.js',
  'js/runner.js',
  'js/store.js',
  'js/timer.js',
  'js/tutorial.js',
  'js/ui.js',
  'js/world.js',
  'vendor/three/LICENSE',
  'vendor/three/addons/loaders/GLTFLoader.js',
  'vendor/three/addons/utils/BufferGeometryUtils.js',
  'vendor/three/three.module.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// ネットにつながるときは新しいものを取りにいき、だめならしまってあるものを使う
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.status === 200) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))),
  );
});
