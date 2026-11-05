// オフラインでも開けるように、アプリの部品を端末にしまっておく。
// 部品を変えたら VERSION を上げる（古いしまい場所は消える）。
const VERSION = 'manabi-v48';
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
  'js/builds.js',
  'js/bonus.js',
  'js/ai.js',
  'js/review.js',
  'js/tests.js', 'js/rescue.js', 'js/scan.js', 'js/feedback.js', 'js/ask.js', 'js/coach.js', 'js/adult.js', 'js/challenge.js', 'js/photos.js',
  'js/sync.js', 'js/merge.js', 'js/account.js',
  'js/icons.js', 'js/gacha.js', 'js/data/gacha.js', 'js/catalog.js',
  'js/controls.js',
  'js/cutmask.js',
  'js/editor.js',
  'js/cottage.js',
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
  'js/quality.js',
  'js/quests.js',
  'js/runner.js',
  'js/store.js',
  'js/meadow.js',
  'js/plants.js',
  'js/terrain.js',
  'js/timer.js',
  'js/tools.js',
  'js/wind.js',
  'js/town.js',
  'js/townkit.js',
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
      // このアプリ（manabi-）の古いしまい場所だけ消す。同じドメインのほかのアプリのものは消さない
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('manabi-') && k !== VERSION).map((k) => caches.delete(k))))
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
