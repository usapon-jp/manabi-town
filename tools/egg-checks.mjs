// node --experimental-default-type=module tools/egg-checks.mjs
// 教科の たまご（js/eggs.js）の たしかめ。いちばん大事なのは「たまごを もらっても ポイント・レベル・町が 1文字も 変わらないこと」。
import assert from 'node:assert/strict';
import {
  EGGS, TUNE, eggsOf, hasEggs, giveEggs, eggProgress, seedProgress, stateOf, wordsOf, needsTap, hatchEgg, plantSeed,
  finishBuilding, addWarmth, featureOpen, registerFeature, unlockLabels, onFeatureOpen, eggSubject, setEggSubject,
  renameEggSubject, studyMinutes, questSubjectFor, hatchedCount, plantedSpots, unlockLines, builtLines, subjectWord,
} from '../js/eggs.js';
import { mergeProfile } from '../js/merge.js';
import { islandOps, START } from '../js/islands.js';

const DAY = 86400000;
const T0 = new Date(2026, 10, 15, 9).getTime();
const clone = (v) => JSON.parse(JSON.stringify(v));
const SUBS = ['国語', '算数・数学', '理科', '社会', '英語', 'その他'];
const sess = (subject, minutes, at, id = `${subject}${at}`) => ({ id, date: '2026-11-15', start: at - minutes * 60000, minutes, kind: 'self', subject, points: minutes });
const kid = () => ({
  id: 'k1', name: 'たろう', grade: 'e4', points: 340, xp: 1280, items: [], quizzes: [], daily: {}, log: [{ at: 1, n: 10 }],
  sessions: [sess('国語', 30, T0 - 3 * DAY), sess('理科', 20, T0 - DAY)],
  world: { v: 1, ops: [{ t: 'path', r: 1, pts: [0, 0, 1, 1] }] },
  avatar: { name: 'はな' },
});

// 1. いまの子（たまご なし）: 読むだけで 何も 変わらない
{
  const p = kid(); const before = clone(p);
  assert.equal(hasEggs(p), false);
  assert.equal(stateOf(p, 'kokugo', T0), null);
  assert.equal(eggProgress(p, 'kokugo', T0), 0);
  assert.equal(featureOpen(p, 'camera'), false);
  assert.deepEqual(plantedSpots(p), []);
  assert.deepEqual(p, before);
}
// 2. もらうと はじまりの島の 入れ物に eggs が ふえるだけ（ポイント・レベル・町の ops・名前は そのまま）
{
  const p = kid(); const before = clone(p);
  assert.equal(giveEggs(p, T0, SUBS), true);
  assert.equal(giveEggs(p, T0 + 5, SUBS), false);   // 2回は もらえない
  const { world, ...rest } = p; const { world: bw, ...brest } = before;
  assert.deepEqual(rest, brest);
  assert.deepEqual(world.ops, bw.ops);
  assert.equal(world.v, bw.v);
  assert.deepEqual(Object.keys(world.isles), [START]);
  assert.deepEqual(islandOps(p, START), bw.ops);
  assert.equal(eggsOf(p).got, T0);
  assert.equal(eggsOf(p).pre.kokugo, 30);   // もらう前の 国語 30分
  assert.equal(eggsOf(p).pre.rika, 20);
  assert.equal(eggsOf(p).pre.sansu, 0);
}
// 3. 放っておいても 7日で うまれる。のこりは ことばで（数字は 出さない）
{
  const p = kid(); p.sessions = []; giveEggs(p, T0, SUBS);
  assert.equal(stateOf(p, 'sansu', T0).stage, 'sleep');
  assert.equal(stateOf(p, 'sansu', T0 + 3 * DAY).stage, 'wiggle');
  assert.equal(stateOf(p, 'sansu', T0 + 5 * DAY).stage, 'crack');
  assert.equal(wordsOf(stateOf(p, 'sansu', T0 + 5 * DAY)), 'もうすぐかも…');
  assert.ok(stateOf(p, 'sansu', T0 + 7 * DAY - 60000).stage !== 'ready');
  assert.equal(stateOf(p, 'sansu', T0 + 7 * DAY).stage, 'ready');
  assert.equal(needsTap(stateOf(p, 'sansu', T0 + 7 * DAY)), true);
  assert.equal(needsTap(stateOf(p, 'sansu', T0 + DAY)), false);
  for (const d of EGGS) assert.ok(!/\d/.test(wordsOf(stateOf(p, d.id, T0 + 2 * DAY))));
}
// 4. その教科を 10分 やると 半日。ほかの教科・もらう前の 勉強は ふくまない
{
  const p = kid(); p.sessions = []; giveEggs(p, T0, SUBS);
  p.sessions.push(sess('算数・数学', 70, T0 + DAY));          // 3.5日ぶん
  p.sessions.push(sess('国語', 600, T0 + DAY));               // 国語は 算数の たまごに 入らない
  const k = eggProgress(p, 'sansu', T0 + 3.5 * DAY);
  assert.ok(Math.abs(k - 1) < 1e-9, String(k));             // 3.5日 + 3.5日 = 7日
  assert.equal(eggProgress(p, 'kokugo', T0 + 3.5 * DAY), 1);
  assert.ok(eggProgress(p, 'rika', T0 + 3.5 * DAY) < 0.6);
  assert.equal(studyMinutes(p, '算数・数学', T0), 70);
}
// 5. 前からの 勉強で 少し あたたまっている（上限あり。いきなり うまれない）
{
  const p = kid(); p.sessions = [sess('国語', 100000, T0 - DAY)]; giveEggs(p, T0, SUBS);
  const k = eggProgress(p, 'kokugo', T0);
  assert.ok(Math.abs(k - TUNE.preMaxDays / TUNE.eggDays) < 1e-9);
  assert.ok(k < 0.5);
  const q = kid(); q.sessions = [sess('国語', 40, T0 - DAY)]; giveEggs(q, T0, SUBS);
  assert.ok(eggProgress(q, 'kokugo', T0) > 0 && eggProgress(q, 'kokugo', T0) < 0.1);
  // もらった あとで 古い記録を なおしても、もらう前の 分は かわらない
  q.sessions[0].minutes = 5000;
  assert.equal(eggsOf(q).pre.kokugo, 40);
}
// 6. 孵化: うまれそう に なってから。しくみの 入口が ひらく（名前の 登録が ない しくみは カードに 出さない）
{
  const p = kid(); p.sessions = []; giveEggs(p, T0, SUBS);
  assert.equal(hatchEgg(p, 'rika', T0 + DAY), null);
  assert.equal(featureOpen(p, 'camera'), false);
  const heard = [];
  const off = onFeatureOpen((k) => heard.push(k));
  assert.deepEqual(unlockLabels('rika'), []);
  registerFeature('camera', { label: 'カメラ' });
  assert.deepEqual(hatchEgg(p, 'rika', T0 + 7 * DAY), ['camera', 'nightLights']);
  off();
  assert.deepEqual(heard, ['camera', 'nightLights']);
  assert.deepEqual(unlockLabels('rika'), ['カメラ']);
  assert.equal(featureOpen(p, 'camera'), true);
  assert.equal(featureOpen(p, 'bank'), false);
  assert.equal(hatchEgg(p, 'rika', T0 + 8 * DAY), null);   // 2回は うまれない
  assert.equal(stateOf(p, 'rika', T0 + 8 * DAY).phase, 'hatched');
  assert.equal(needsTap(stateOf(p, 'rika', T0 + 8 * DAY)), true);   // たねを うえてね の「！」
  assert.equal(hatchedCount(p), 1);
}
// 7. たね: うえてから 5日。理科を 10分 やると 半日。できあがりは そだってから
{
  const p = kid(); p.sessions = []; giveEggs(p, T0, SUBS);
  const t1 = T0 + 7 * DAY;
  hatchEgg(p, 'rika', t1);
  assert.equal(plantSeed(p, 'kokugo', 1, 1), false);          // まだ うまれていない 教科は うえられない
  assert.equal(plantSeed(p, 'rika', 5.123, -4.567, 0.5, t1), true);
  assert.equal(plantSeed(p, 'rika', 0, 0, 0, t1), false);      // 2回は うえない
  assert.deepEqual(plantedSpots(p), [{ id: 'rika', x: 5.12, z: -4.57, rot: 0.5 }]);
  assert.equal(stateOf(p, 'rika', t1).stage, 'seed');
  assert.equal(stateOf(p, 'rika', t1 + 2 * DAY).stage, 'sprout');
  assert.equal(finishBuilding(p, 'rika', t1 + 2 * DAY), false);
  p.sessions.push(sess('理科', 50, t1 + DAY));                 // 2.5日ぶん
  p.sessions.push(sess('理科', 500, t1 - DAY / 2));            // うえる前の 理科は たねに 入らない
  assert.ok(Math.abs(seedProgress(p, 'rika', t1 + 2.5 * DAY) - 1) < 1e-9);
  assert.equal(stateOf(p, 'rika', t1 + 2.5 * DAY).stage, 'ready');
  assert.equal(finishBuilding(p, 'rika', t1 + 2.5 * DAY), true);
  assert.equal(stateOf(p, 'rika', t1 + 3 * DAY).phase, 'built');
}
// 8. クエストの 分: 同じ パーツは 1回だけ。教科の名前は その子に あわせる
{
  const p = kid(); p.sessions = [];
  assert.equal(addWarmth(p, '国語', 5, 'quest:a'), false);     // たまごを もらう前は 入れない
  giveEggs(p, T0, SUBS);
  assert.equal(addWarmth(p, '国語', 5, 'quest:2026-11-15:kanji', T0 + 1000), true);
  assert.equal(addWarmth(p, '国語', 5, 'quest:2026-11-15:kanji', T0 + 2000), false);
  assert.equal(studyMinutes(p, '国語', T0), 5);
  assert.equal(questSubjectFor(p, { core: 'kanji' }, SUBS), '国語');
  assert.equal(questSubjectFor(p, { core: 'math' }, SUBS), '算数・数学');
  assert.equal(questSubjectFor(p, { core: 'math' }, ['国語', '算数', '理科']), '算数・数学');
  assert.equal(questSubjectFor(p, { id: 'x', x: { subject: '理科' } }, SUBS), '理科');
}
// 9. 教科の名前を かえた・おとなの ジャンル
{
  const p = kid(); giveEggs(p, T0, SUBS);
  renameEggSubject(p, '算数・数学', '算数', SUBS);
  assert.equal(eggSubject(p, 'sansu', SUBS), '算数');
  assert.equal(eggSubject(p, 'kokugo', SUBS), '国語');
  assert.equal(setEggSubject(p, 'eigo', '英会話'), true);
  assert.equal(eggSubject(p, 'eigo'), '英会話');
  const a = { ...kid(), grade: 'adult', sessions: [sess('仕事', 60, T0 - DAY)] };
  const ad = ['資格・勉強', '仕事', '健康', 'くらし', 'しゅみ', 'その他'];
  giveEggs(a, T0, ad);
  assert.equal(eggSubject(a, 'kokugo', ad), '資格・勉強');
  assert.equal(eggSubject(a, 'sansu', ['べつ']), '仕事');      // ならびを かえても かわらない
  assert.equal(eggsOf(a).pre.sansu, 60);
}
// 10. 端末どうしで そろえる: 片方で もらって、もう片方で 勉強しても 両方 のこる。ポイントも そのまま 足しあわさる
{
  const base = kid(); giveEggs(base, T0, SUBS);
  const a = clone(base); hatchEgg(a, 'kokugo', T0 + 7 * DAY); addWarmth(a, '英語', 5, 'quest:x', T0 + 100);
  const b = clone(base); b.sessions.push(sess('英語', 60, T0 + DAY, 'sB')); b.points += 60;
  const m = mergeProfile(base, a, b);
  assert.equal(m.points, 400);
  assert.ok(eggsOf(m).hatch.kokugo);
  assert.equal(studyMinutes(m, '英語', T0), 65);
  assert.deepEqual(m.world.ops, base.world.ops);
  // まだ もらっていない 古い 端末と そろえても たまごは 消えない
  const old = kid();
  const m2 = mergeProfile(old, clone(base), clone(old));
  assert.ok(hasEggs(m2));
}
// 子どもに 見せる ことば: 「算数・数学」は 学年で 算数／数学。しくみの 行は どこで つかうかまで
{
  assert.equal(subjectWord({ grade: 'e4' }, '算数・数学'), '算数');
  assert.equal(subjectWord({ grade: 'j2' }, '算数・数学'), '数学');
  assert.equal(subjectWord({ grade: 'adult' }, '算数・数学'), '算数・数学');
  assert.equal(subjectWord({ grade: 'e4' }, '理科'), '理科');
  registerFeature('bank', { label: '銀行', line: '銀行が できたら ポイントを あずけられるよ', built: 'タッチすると ポイントを あずけられるよ' });
  assert.deepEqual(unlockLines('sansu'), ['銀行が できたら ポイントを あずけられるよ']);
  assert.deepEqual(builtLines('sansu'), ['タッチすると ポイントを あずけられるよ']);
  assert.deepEqual(unlockLines('rika'), ['カメラが つかえるよ']);   // line が ない しくみは「〇〇が つかえるよ」
  assert.deepEqual(builtLines('rika'), []);
}
console.log('egg checks: ok');
