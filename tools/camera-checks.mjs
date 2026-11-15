// node --experimental-default-type=module tools/camera-checks.mjs
// 町の カメラ（js/camera.js）の たしかめ。大事なのは「カメラの きまりを 読むだけでは 町・ポイント・レベルが 1文字も 変わらないこと」と
// 「理科の たまごの 育ちで できることが ふえること」「10まいで いっぱい」。
import assert from 'node:assert/strict';
import { giveEggs, hatchEgg, plantSeed, finishBuilding, registerFeature } from '../js/eggs.js';
import { FEATURE, MAX_SHOTS, FOLDER, cameraLevel, can, nextHint, shots, isFull, shotLabel, ZOOMS, POSES } from '../js/camera.js';
import { mergeProfile } from '../js/merge.js';

const DAY = 86400000;
const T0 = new Date(2026, 10, 15, 9).getTime();
const clone = (v) => JSON.parse(JSON.stringify(v));
const SUBS = ['国語', '算数・数学', '理科', '社会', '英語', 'その他'];
const kid = () => ({
  id: 'k1', name: 'たろう', grade: 'e4', points: 340, xp: 1280, items: [], quizzes: [], daily: {}, log: [{ at: 1, n: 10 }], sessions: [],
  world: { v: 1, ops: [{ t: 'path', r: 1, pts: [0, 0, 1, 1] }] },
  photos: [{ id: 'old1', folder: 'other', subject: '', name: 'プリント', takenAt: '2026-11-01T00:00:00Z' }],
});
registerFeature(FEATURE, { label: 'カメラ' });

// 1. たまごを もらう前・孵化する前は 使えない。読むだけで 何も 変わらない
{
  const p = kid(); const before = clone(p);
  assert.equal(cameraLevel(p), 0);
  assert.equal(can(p, 'zoom'), false);
  assert.equal(nextHint(p), null);
  giveEggs(p, T0, SUBS); const b2 = clone(p);
  assert.equal(cameraLevel(p), 0);
  assert.deepEqual(p, b2);
  assert.equal(before.points, p.points);
}
// 2. 育ちで ふえる: 孵化=1（撮るだけ）→ たね=2（ズーム・ポーズ）→ 発電所=3（自撮り・夕焼け色）
{
  const p = kid(); giveEggs(p, T0, SUBS);
  assert.ok(hatchEgg(p, 'rika', T0 + 7 * DAY));
  assert.equal(cameraLevel(p), 1);
  assert.deepEqual(['zoom', 'pose', 'selfie', 'filter'].map((k) => can(p, k)), [false, false, false, false]);
  assert.match(nextHint(p), /ズーム/);
  const t1 = T0 + 7 * DAY;
  assert.ok(plantSeed(p, 'rika', 4, -4, 0, t1));
  assert.equal(cameraLevel(p), 2);
  assert.deepEqual(['zoom', 'pose', 'selfie', 'filter'].map((k) => can(p, k)), [true, true, false, false]);
  assert.match(nextHint(p), /自撮り/);
  p.sessions.push({ id: 's', date: '2026-11-22', start: t1, minutes: 100, kind: 'self', subject: '理科', points: 100 });
  assert.ok(finishBuilding(p, 'rika', t1 + 6 * DAY));
  assert.equal(cameraLevel(p), 3);
  assert.deepEqual(['zoom', 'pose', 'selfie', 'filter'].map((k) => can(p, k)), [true, true, true, true]);
  assert.equal(nextHint(p), null);
}
// 3. 理科以外の たまごを 孵化させても カメラは ひらかない
{
  const p = kid(); p.sessions = [{ id: 's', date: '2026-11-01', start: T0 - 20 * DAY, minutes: 600, kind: 'self', subject: '国語', points: 600 }];
  giveEggs(p, T0, SUBS); hatchEgg(p, 'kokugo', T0 + 8 * DAY);
  assert.equal(cameraLevel(p), 0);
}
// 4. 写真: カメラの 写真だけ 数える。10まいで いっぱい。しりょうの 写真は 数えない
{
  const p = kid();
  assert.equal(shots(p).length, 0);
  for (let i = 0; i < MAX_SHOTS - 1; i++) p.photos.push({ id: `c${i}`, folder: FOLDER, subject: '理科', name: 'x', takenAt: `2026-11-0${i + 1}T00:00:00Z` });
  assert.equal(isFull(p), false);
  p.photos.push({ id: 'c9', folder: FOLDER, takenAt: '2026-11-15T00:00:00Z' });
  assert.equal(isFull(p), true);
  assert.equal(shots(p)[0].id, 'c9');            // あたらしい じゅん
  assert.equal(p.photos.length, MAX_SHOTS + 1);
  assert.equal(shots({}).length, 0);
  assert.equal(shots(null).length, 0);
}
// 5. 写真の 名前は ほかの 端末と そろう（id ごと）
{
  const base = kid();
  const a = clone(base); const b = clone(base);
  a.photos.push({ id: 'ca', folder: FOLDER, takenAt: '2026-11-15T01:00:00Z', name: shotLabel(new Date(2026, 10, 15)) });
  b.photos.push({ id: 'cb', folder: FOLDER, takenAt: '2026-11-15T02:00:00Z', name: 'b' });
  const m = mergeProfile(base, a, b);
  assert.deepEqual(m.photos.map((x) => x.id).sort(), ['ca', 'cb', 'old1']);
}
assert.equal(shotLabel(new Date(2026, 10, 15)), '11月15日の 町');
assert.ok(ZOOMS[0] === 1 && ZOOMS.length === 3 && POSES.length === 3);
console.log('camera-checks: ok');
