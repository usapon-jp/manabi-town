// node --experimental-default-type=module tools/bank-checks.mjs
// 町の 銀行（js/bank.js）の たしかめ。いちばん大事なのは
//   「あずけても おろしても レベル（けいけんち）が かわらない」「ポイントが 消えたり 二重に ふえたり しない」「2台で 同じ日を 開いても 利子が 二重に ならない」
import assert from 'node:assert/strict';
// 保存（store.js）が ブラウザの window を つかうので、からの ものを おく
globalThis.window = { dispatchEvent() {}, addEventListener() {} };
globalThis.CustomEvent = class { constructor(t) { this.type = t; } };
import { giveEggs, hatchEgg, plantSeed, finishBuilding, registerFeature, addWarmth } from '../js/eggs.js';
import { TUNE, bankOpen, bankLevel, balance, shown, settle, deposit, withdraw, canDeposit, nextGain, dailyGain, registerBank, bankOf } from '../js/bank.js';
import { mergeProfile } from '../js/merge.js';
import { levelOf } from '../js/progress.js';

registerBank();
const DAY = 86400000;
const T0 = new Date(2026, 10, 15, 9).getTime();
const SUBS = ['国語', '算数・数学', '理科', '社会', '英語', 'その他'];
const clone = (v) => JSON.parse(JSON.stringify(v));
const sess = (subject, minutes, at, id = `${subject}${at}`) => ({ id, date: '2026-11-15', start: at - minutes * 60000, minutes, kind: 'self', subject, points: minutes });
const kid = () => ({ id: 'k1', name: 'たろう', grade: 'e4', points: 500, xp: 1280, items: [], quizzes: [], daily: {}, log: [{ at: 1, n: 10 }], sessions: [], world: { v: 1, ops: [] }, avatar: { name: 'はな' } });
// 銀行が ひらいた 子（たまごを もらい、算数が 孵化し、銀行が できた）
function openKid(extra) {
  const p = kid(); Object.assign(p, extra || {});
  giveEggs(p, T0, SUBS);
  p.sessions.push(sess('算数・数学', 200, T0 + 8 * DAY));
  assert.ok(hatchEgg(p, 'sansu', T0 + 9 * DAY, SUBS));
  assert.ok(plantSeed(p, 'sansu', 3, 3, 0, T0 + 9 * DAY));
  assert.ok(finishBuilding(p, 'sansu', T0 + 14 * DAY, SUBS));
  return p;
}
const NOW = T0 + 14 * DAY;
const day = (n) => NOW + n * DAY;

// 1. ひらく 前は 何も できない・何も かわらない
{
  const p = kid(); const before = clone(p);
  assert.equal(bankOpen(p), false);
  assert.equal(deposit(p, 10, NOW, SUBS), false);
  assert.equal(withdraw(p, 10, NOW, SUBS), false);
  assert.equal(settle(p, NOW, SUBS), 0);
  assert.deepEqual(p, before);
  const q = kid(); giveEggs(q, T0, SUBS);
  assert.equal(bankOpen(q), false);   // たまごを もらっただけ
}
// 2. ひらいた 直後: ちょきん 0・Lv1
{
  const p = openKid();
  assert.equal(bankOpen(p), true);
  assert.equal(balance(p), 0);
  assert.equal(bankLevel(p, SUBS).lv, 1);
  assert.equal(settle(p, NOW, SUBS), 0);
}
// 3. あずける・おろす: ポイントは 1点も ふえも へりも しない / けいけんち・レベルは かわらない
{
  const p = openKid();
  const xp = p.xp; const total = p.points; const lv = levelOf(p).lv;
  assert.equal(deposit(p, 100, NOW, SUBS), true);
  assert.equal(p.points, total - 100); assert.equal(shown(p), 100); assert.equal(p.xp, xp);
  assert.equal(p.points + shown(p), total);
  assert.equal(withdraw(p, 40, NOW, SUBS), true);
  assert.equal(p.points + shown(p), total); assert.equal(p.xp, xp); assert.equal(levelOf(p).lv, lv);
  assert.equal(withdraw(p, 61, NOW, SUBS), false);   // ちょきん いじょうは おろせない
  assert.equal(deposit(p, 0, NOW, SUBS), false);
  assert.equal(deposit(p, -5, NOW, SUBS), false);
  assert.equal(deposit(p, 1e6, NOW, SUBS), false);   // もっている より おおい
  assert.equal(deposit(p, 2.9, NOW, SUBS), true);    // 小数は 切りすて（2pt）
  assert.equal(p.points + shown(p), total);
  // 記録は 「勉強した日」「けいけんち」に 数えられない
  assert.ok(p.log[0].spend && p.log[1].spend);
}
// 4. 上限: あずけられるのは レベルの 上限まで
{
  const p = openKid({ points: 9999 });
  const lim = bankLevel(p, SUBS).limit;
  assert.equal(canDeposit(p, SUBS), lim);
  assert.equal(deposit(p, lim + 1, NOW, SUBS), false);
  assert.equal(deposit(p, lim, NOW, SUBS), true);
  assert.equal(canDeposit(p, SUBS), 0);
  assert.equal(deposit(p, 1, NOW, SUBS), false);
}
// 5. 利子: 日が かわると つく。あずけた 日の 分は つかない。同じ日は 何回 開いても 1回
{
  const p = openKid();
  deposit(p, 100, NOW, SUBS);
  assert.equal(settle(p, NOW, SUBS), 0);
  assert.equal(settle(p, NOW + 3600000, SUBS), 0);     // 同じ日
  const lv1 = TUNE.levels[bankLevel(p, SUBS).lv - 1];
  const g = settle(p, day(1), SUBS);
  assert.equal(g, dailyGain(100, lv1)); assert.ok(g > 0);
  assert.equal(settle(p, day(1), SUBS), 0);            // 開きなおしても 二重に つかない
  assert.equal(settle(p, day(1) + 5000, SUBS), 0);
  assert.equal(balance(p), 100 + g);
  // 1日に ふえる 分は 上限を こえない
  const q = openKid({ points: 9999 });
  deposit(q, 5000, NOW, SUBS);                         // 上限(Lvの limit)まで
  const lq = bankLevel(q, SUBS);
  const gq = settle(q, day(1), SUBS);
  assert.ok(gq <= lq.cap + 1e-9);
}
// 6. 開かなかった 日は まとめて つく。へらない
{
  const p = openKid();
  deposit(p, 100, NOW, SUBS);
  const g = settle(p, day(10), SUBS);
  assert.ok(g > 10);                                     // 10日ぶんが ふくりで つく
  assert.ok(balance(p) > 110);
  const b0 = balance(p);
  assert.equal(settle(p, day(10), SUBS), 0);
  assert.equal(balance(p), b0);
  // 何か月 あいても へらない・さかのぼりは 上限まで
  const q = openKid(); deposit(q, 100, NOW, SUBS);
  settle(q, day(400), SUBS);
  assert.ok(balance(q) >= 100);
  assert.ok(Object.keys(bankOf(q).int).length <= TUNE.catchUpDays + 2);
}
// 7. 全部 おろして ゼロの 間は 利子が つかず、あとで あずけた ときに 昔の 分は つかない
{
  const p = openKid();
  deposit(p, 100, NOW, SUBS);
  withdraw(p, 100, day(1), SUBS);                        // 1日め（その日の 利子を つけてから おろす）
  const after = balance(p);
  assert.equal(shown(p) <= 0 || after >= 0, true);
  const left = shown(p);
  if (left > 0) withdraw(p, left, day(1), SUBS);
  settle(p, day(20), SUBS);
  assert.ok(balance(p) < 1);
  deposit(p, 50, day(20), SUBS);
  assert.equal(shown(p), 50);                            // 20日前の 分の 利子は つかない
  assert.equal(settle(p, day(20), SUBS), 0);
}
// 8. 算数を 勉強すると 銀行が そだつ（レベルが 上がって 利子の 割合が 上がる）。へらない
{
  const p = openKid();
  assert.equal(bankLevel(p, SUBS).lv, 1);
  const r1 = bankLevel(p, SUBS).rate;
  p.sessions.push(sess('算数・数学', 40, day(1)));       // 孵化のあとの 勉強
  const l2 = bankLevel(p, SUBS);
  assert.ok(l2.lv >= 2); assert.ok(l2.rate > r1);
  p.sessions.push(sess('国語', 300, day(1) + 1000));     // 国語は 関係ない
  assert.equal(bankLevel(p, SUBS).lv, l2.lv);
  // 孵化の 前の 算数は 数えない
  assert.equal(bankLevel(openKid(), SUBS).min, 0);
  // クエストの 勉強（warm）も 数える
  addWarmth(p, '算数・数学', 5, 'quest:a', day(2));
  assert.ok(bankLevel(p, SUBS).min > l2.min);
  // 記録が 消えても レベルは さがらない（settle で 書きとめた 分）
  settle(p, day(3), SUBS);
  const lvBefore = bankLevel(p, SUBS).lv;
  p.sessions.length = 0; p.world.isles.start.eggs.warm.length = 0;
  assert.equal(bankLevel(p, SUBS).lv, lvBefore);
  // 最高レベル
  const q = openKid(); q.sessions.push(sess('算数・数学', 5000, day(1)));
  const mx = bankLevel(q, SUBS);
  assert.equal(mx.lv, TUNE.levels.length); assert.equal(mx.max, true); assert.equal(mx.k, 1);
}
// 9. 通帳の 式（あした ふえる 見こみ）
{
  const p = openKid();
  deposit(p, 100, NOW, SUBS);
  const n = nextGain(p, SUBS);
  assert.equal(n.bal, 100); assert.equal(n.mult, 1.01); assert.equal(n.gain, 1); assert.equal(n.capped, false); assert.equal(n.after, 101);
  // 50 あずけた ときも 式が 正しい（「50 × 1.01 = 50」に ならない）
  const p2 = openKid(); deposit(p2, 50, NOW, SUBS);
  assert.equal(nextGain(p2, SUBS).after, 50.5);
}
// 10. 2台の 端末で 同じ日に 開いても 利子が 二重に ならない / あずけた 分が 消えない・ふえない
{
  const base = openKid(); deposit(base, 100, NOW, SUBS);
  const a = clone(base); const b = clone(base);
  settle(a, day(1), SUBS); settle(b, day(1), SUBS);      // 両方で 同じ日の 利子
  const m = mergeProfile(base, a, b);
  assert.equal(balance(m), balance(a));
  assert.equal(m.points, base.points);
  // 片方で あずけ、片方で おろす
  const c = clone(base); const d = clone(base);
  deposit(c, 50, day(0), SUBS);                          // 手もとの ポイントから 50 あずけ
  withdraw(d, 30, day(0), SUBS);
  const m2 = mergeProfile(base, c, d);
  assert.equal(m2.points + shown(m2), base.points + shown(base));   // ぜんぶの 合計は かわらない
  assert.equal(shown(m2), 120);
  // 片方で 利子、片方で あずける
  const e = clone(base); const f = clone(base);
  settle(e, day(1), SUBS); deposit(f, 20, day(0), SUBS);
  const m3 = mergeProfile(base, e, f);
  assert.equal(m3.points, base.points - 20);
  assert.ok(shown(m3) >= 120);
  // 初めての 引っこし（base なし）でも ポイントの 合計が かわらない・けいけんちが ふえない
  const g = clone(base); const h = clone(base); withdraw(g, 10, day(0), SUBS);
  const m4 = mergeProfile(null, g, h);
  assert.equal(m4.xp, base.xp);
}
// 11. 2台で 同時に おろして ちょきんが マイナスに なっても 数字が くずれない
{
  const base = openKid(); deposit(base, 100, NOW, SUBS);
  const a = clone(base); const b = clone(base);
  withdraw(a, 100, NOW, SUBS); withdraw(b, 100, NOW, SUBS);
  const m = mergeProfile(base, a, b);
  assert.ok(balance(m) >= 0);
  assert.equal(deposit(m, 10, NOW, SUBS), true);
  assert.ok(shown(m) >= 10);
}
// 12. 古い 子（たまごなし）や 保存が 欠けた 子でも こわれない
{
  for (const p of [{}, { world: null }, { world: { isles: { start: { eggs: { got: 1, hatch: {}, built: {} } } } } }, { world: { isles: { start: { bank: 5 } } } }]) {
    assert.equal(bankOpen(p), false); assert.equal(balance(p), 0); assert.equal(settle(p, NOW, SUBS), 0);
    assert.equal(deposit(p, 5, NOW, SUBS), false);
  }
}
// 13. 同じ量を 2台で おろしても あずけた・おろした 合計は 足される。はじめての あずけが 2台で あっても 消えない
{
  const base = openKid(); deposit(base, 100, NOW, SUBS);
  const a = clone(base); const b = clone(base);
  withdraw(a, 100, NOW, SUBS); withdraw(b, 60, NOW, SUBS);
  const m = mergeProfile(base, a, b);
  assert.equal(bankOf(m).bankOut, 160);
  assert.equal(balance(m), 0);
  const before = m.points;
  assert.equal(deposit(m, 50, NOW, SUBS), true);
  assert.equal(shown(m), 50); assert.equal(m.points, before - 50);   // あずけた 分が きえない
  const f0 = openKid(); const x = clone(f0); const y = clone(f0);
  deposit(x, 100, NOW, SUBS); deposit(y, 50, NOW, SUBS);
  const m2 = mergeProfile(f0, x, y);
  assert.equal(bankOf(m2).bankIn, 150);
  assert.equal(m2.points + shown(m2), f0.points);
}
console.log('bank-checks: ok');
