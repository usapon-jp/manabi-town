// オフラインでも開けるように、アプリの部品を端末にしまっておく。
// 部品を変えたら VERSION を上げる（古いしまい場所は消える）。
const VERSION = 'manabi-v83';
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
  'assets/models/lamppost.json',
  'assets/gacha/fence-iron.webp', 'assets/gacha/fence-stone.webp', 'assets/gacha/fence-white.webp', 'assets/gacha/fence-wood.webp', 'assets/gacha/part-archdoor-brown.webp', 'assets/gacha/part-archdoor.webp', 'assets/gacha/part-door.webp', 'assets/gacha/part-flowerbox.webp', 'assets/gacha/part-roundwindow.webp', 'assets/gacha/part-window.webp', 'assets/gacha/part-wreath.webp', 'assets/gacha/piece-awning.webp', 'assets/gacha/piece-bench.webp', 'assets/gacha/piece-flowerpot.webp', 'assets/gacha/piece-hill.webp', 'assets/gacha/piece-lamppost.webp', 'assets/gacha/piece-lantern.webp', 'assets/gacha/piece-mailbox.webp', 'assets/gacha/piece-raisedbed.webp', 'assets/gacha/piece-rosearch.webp', 'assets/gacha/seed-cosmos.webp', 'assets/gacha/seed-lavender.webp', 'assets/gacha/seed-sunflower.webp',
  'css/style.css',
  'js/characters.js',
  'js/bgm.js',
  'js/builds.js',
  'js/bonus.js',
  'js/more.js',
  'js/mytodo.js',
  'js/diary.js',
  'js/pins.js',
  'js/ai.js',
  'js/review.js',
  'js/tests.js', 'js/rescue.js', 'js/scan.js', 'js/feedback.js', 'js/ask.js', 'js/townask.js', 'js/townguide.js', 'js/coach.js', 'js/adult.js', 'js/subjects.js', 'js/challenge.js', 'js/voice.js', 'js/photos.js', 'js/pickphoto.js', 'js/rangebar.js',
  'js/sync.js', 'js/merge.js', 'js/account.js', 'js/notify.js',
  'js/icons.js', 'js/gacha.js', 'js/data/gacha.js', 'js/catalog.js',
  'js/controls.js',
  'js/props.js',
  'js/structures.js',
  'js/pieces.js',
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
  'js/townart.js',
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

// スマホへのお知らせ（notify.js / Supabase manabi-push から とどく）
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'まなびタウン', {
    body: d.body || '',
    tag: d.tag || 'manabi',
    icon: 'assets/icons/icon-192.png',
    badge: 'assets/icons/favicon-48.png',
    data: { tab: d.url || '' },
  }));
});

// お知らせを おしたら アプリをひらく（ひらいていれば そのタブへ）
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const tab = /^[a-z]{1,12}$/.test(e.notification.data?.tab || '') ? e.notification.data.tab : '';
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = list.find((x) => new URL(x.url).origin === location.origin);
    if (c) { await c.focus(); if (tab) c.postMessage({ type: 'open-tab', tab }); return; }
    await self.clients.openWindow(tab ? `./?tab=${tab}` : './');
  })());
});
