// node --experimental-default-type=module tools/album-checks.mjs
// 町の アルバム（js/album.js）の たしかめ。大事なのは「社会の たまごで ひらく・育つと ページと できることが ふえる」
// 「アルバムが あれば カメラの 10まいの 上限が アルバムの ページぶんに なる」「スタンプ・ひとことは 写真の メタに 入り、2台で そろう」
// 「読むだけでは 町・ポイント・写真が 1文字も 変わらない」。
import assert from 'node:assert/strict';
import { giveEggs, hatchEgg, plantSeed, finishBuilding } from '../js/eggs.js';
import { FOLDER, MAX_SHOTS } from '../js/camera.js';
import {
  albumLevel, can, pageCount, shotCap, isFull, isMax, nextHint, albumShots, pagesOf, lastPage, setStamp, setNote, cleanNote, PER_PAGE, PAGES, STAMPS, NOTE_MAX,
} from '../js/album.js';
import { mergeProfile } from '../js/merge.js';

const DAY = 86400000;
const T0 = new Date(2026, 10, 15, 9).getTime();
const clone = (v) => JSON.parse(JSON.stringify(v));
const SUBS = ['国語', '算数・数学', '理科', '社会', '英語', 'その他'];
const kid = () => ({
  id: 'k1', name: 'はな', grade: 'e4', points: 340, xp: 1280, items: [], quizzes: [], daily: {}, log: [{ at: 1, n: 10 }], sessions: [],
  world: { v: 1, ops: [{ t: 'path', r: 1, pts: [0, 0, 1, 1] }] },
  photos: [{ id: 'old1', folder: 'other', subject: '', name: 'プリント', takenAt: '2026-11-01T00:00:00Z' }],
});
const addShots = (p, n, from = 0) => {
  for (let i = from; i < from + n; i++) p.photos.push({ kind: 'town', isle: 'start', sky: 'yugata', id: `c${i}`, folder: FOLDER, subject: '理科', name: 'x', takenAt: new Date(T0 + i * 60000).toISOString() });
};

// 1. もらう前は 0。読むだけで 何も 変わらない
{
  const p = kid(); giveEggs(p, T0, SUBS); addShots(p, 3);
  const before = clone(p);
  assert.equal(albumLevel(p), 0);
  assert.equal(pageCount(p), 0);
  assert.equal(shotCap(p), MAX_SHOTS);
  assert.equal(can(p, 'stamp'), false);
  assert.equal(nextHint(p), null);
  albumShots(p); pagesOf(p); lastPage(p); isFull(p);
  assert.deepEqual(p, before);
  assert.equal(setStamp(p, 'c0', 'star'), false);
  assert.deepEqual(p, before);
}
// 2. 社会の たまごで ひらく → たね → 市場 で 育つ
{
  const p = kid(); giveEggs(p, T0, SUBS);
  const t1 = T0 + 7 * DAY;
  assert.ok(hatchEgg(p, 'shakai', t1)?.includes('album'));
  assert.equal(albumLevel(p), 1);
  assert.equal(shotCap(p), PAGES[1] * PER_PAGE);
  assert.ok(shotCap(p) > MAX_SHOTS);
  assert.deepEqual([can(p, 'stamp'), can(p, 'note')], [false, false]);
  assert.match(nextHint(p), /スタンプ/);
  assert.ok(plantSeed(p, 'shakai', 3, 2, 0, t1));
  assert.equal(albumLevel(p), 2);
  assert.deepEqual([can(p, 'stamp'), can(p, 'note')], [true, false]);
  assert.match(nextHint(p), /ひとこと/);
  assert.ok(finishBuilding(p, 'shakai', t1 + 6 * DAY));
  assert.equal(albumLevel(p), 3);
  assert.equal(shotCap(p), 100);
  assert.ok(isMax(p));
  assert.deepEqual([can(p, 'stamp'), can(p, 'note')], [true, true]);
  assert.equal(nextHint(p), null);
}
// 3. ほかの 教科では ひらかない（理科は カメラだけ）
{
  const p = kid(); giveEggs(p, T0, SUBS); hatchEgg(p, 'rika', T0 + 8 * DAY); hatchEgg(p, 'kokugo', T0 + 8 * DAY);
  assert.equal(albumLevel(p), 0);
}
// 4. ページ: 古い じゅん・4まいずつ。ページ数は Lv ぶん（写真が 多ければ その ぶんまで）
{
  const p = kid(); giveEggs(p, T0, SUBS); hatchEgg(p, 'shakai', T0 + 7 * DAY);
  assert.equal(pagesOf(p).length, PAGES[1]);
  assert.equal(lastPage(p), 0);
  addShots(p, 9);
  const list = albumShots(p);
  assert.equal(list.length, 9);                         // しりょうの 写真は 入らない
  assert.equal(list[0].id, 'c0');                       // いちばん 古いのが 1ページめの はじめ
  const pages = pagesOf(p);
  assert.deepEqual(pages.slice(0, 3).map((x) => x.length), [4, 4, 1]);
  assert.equal(lastPage(p), 2);
  assert.equal(isFull(p), false);
  // 古い 版の 端末で 上限より 多く たまっていても、ぜんぶ 見える
  const q = kid(); giveEggs(q, T0, SUBS); hatchEgg(q, 'shakai', T0 + 7 * DAY); addShots(q, 40);
  assert.equal(pagesOf(q).length, 10);
  assert.ok(isFull(q));
}
// 5. いっぱい: Lv1 は 32まい。たねを うえると また とれる
{
  const p = kid(); giveEggs(p, T0, SUBS); hatchEgg(p, 'shakai', T0 + 7 * DAY);
  addShots(p, 32);
  assert.ok(isFull(p));
  plantSeed(p, 'shakai', 1, 1, 0, T0 + 7 * DAY);
  assert.equal(isFull(p), false);
}
// 6. スタンプ・ひとこと: メタに 入るだけ。同じ スタンプで はずれる。ひとことは 16字・改行なし
{
  const p = kid(); giveEggs(p, T0, SUBS); hatchEgg(p, 'shakai', T0 + 7 * DAY); addShots(p, 2);
  assert.equal(setStamp(p, 'c0', 'star'), false);       // Lv1 では まだ
  plantSeed(p, 'shakai', 1, 1, 0, T0 + 7 * DAY);
  const pts = p.points; const ops = clone(p.world.ops);
  assert.ok(setStamp(p, 'c0', 'star'));
  assert.equal(p.photos.find((m) => m.id === 'c0').stamp, 'star');
  assert.ok(setStamp(p, 'c0', 'star'));
  assert.equal('stamp' in p.photos.find((m) => m.id === 'c0'), false);
  assert.equal(setStamp(p, 'c0', 'nope'), false);
  assert.equal(setStamp(p, 'none', 'star'), false);
  assert.equal(setNote(p, 'c0', 'たのしい'), false);    // Lv2 では まだ
  finishBuilding(p, 'shakai', T0 + 13 * DAY);
  assert.ok(setNote(p, 'c1', '  ゆうやけ\nきれい  '));
  assert.equal(p.photos.find((m) => m.id === 'c1').note, 'ゆうやけ きれい');
  assert.equal([...cleanNote('あ'.repeat(30))].length, NOTE_MAX);
  assert.ok(setNote(p, 'c1', '   '));
  assert.equal('note' in p.photos.find((m) => m.id === 'c1'), false);
  assert.equal(p.points, pts);
  assert.deepEqual(p.world.ops, ops);
  assert.equal(STAMPS.length, new Set(STAMPS.map((s) => s.id)).size);
}
// 7. 2台で べつべつに スタンプと ひとこと → まとめると 両方 のこる。写真も 両方の ぶん
{
  const base = kid(); giveEggs(base, T0, SUBS); hatchEgg(base, 'shakai', T0 + 7 * DAY); plantSeed(base, 'shakai', 1, 1, 0, T0 + 7 * DAY);
  finishBuilding(base, 'shakai', T0 + 13 * DAY); addShots(base, 2);
  const a = clone(base); const b = clone(base);
  setStamp(a, 'c0', 'moon');
  setNote(b, 'c1', 'みんなで');
  addShots(b, 1, 5);
  const out = mergeProfile(clone(base), a, b);
  const m = (id) => out.photos.find((x) => x.id === id);
  assert.equal(m('c0').stamp, 'moon');
  assert.equal(m('c1').note, 'みんなで');
  assert.ok(m('c5'));
  assert.equal(out.points, base.points);
}
console.log('album checks ok');
