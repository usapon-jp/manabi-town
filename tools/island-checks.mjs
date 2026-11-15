// node --experimental-default-type=module tools/island-checks.mjs
// 町の保存を島ごとに分ける土台（js/islands.js）の たしかめ。
// いちばん大事なのは「いままでのデータが 1文字も 変わらずに はじまりの島として読めること」。
import assert from 'node:assert/strict';
import { START, registerIsland, islandDef, worldOf, isOpen, openIsland, openIslands, islandOps, islandData, currentIslandId, setCurrentIsland, otherIslands, onIslandChange } from '../js/islands.js';
import { mergeProfile } from '../js/merge.js';

const clone = (v) => JSON.parse(JSON.stringify(v));
// いま使われている形（町のデータは p.world.ops）
const oldProfile = () => ({
  id: 'kid1', name: 'たろう', grade: 'e4', points: 340, xp: 1280, character: 'piyo',
  items: [{ id: 'a1', type: 'test', title: '理科', date: '2026-11-20', done: false }], quizzes: [], daily: { '2026-11-14': { score: 3, total: 3 } },
  log: [{ at: 1, n: 10, reason: 'クエスト' }], lvKeep: { lv: 7, base: 1200 },
  world: { v: 1, ops: [
    { t: 'path', r: 1.2, pts: [0, 0, 1, 1, 2, 2] },
    { t: 'place', k: 'piece:raisedbed', seed: 5, x: 3, z: 4, rot: 0.5 },
    { t: 'town', id: 'town:3', x: 9, z: -6, rot: 0.2 },
    { t: 'town', id: 'town:6', stored: true },
    { t: 'pond', pts: [5, 5, 6, 5, 6, 6] },
  ] },
});

// 1. いままでのデータは、そのまま「はじまりの島」になる。読むだけでは 何も変わらない
{
  const p = oldProfile(); const before = clone(p);
  assert.equal(currentIslandId(p), START);
  assert.equal(islandOps(p, START), p.world.ops);            // 同じ入れ物（写しではない）
  assert.deepEqual(openIslands(p).map((d) => d.id), [START]);
  assert.deepEqual(otherIslands(p, START), []);
  assert.deepEqual(p, before);                               // 1文字も変わっていない（ポイント・レベルも）
  assert.equal(islandDef(START).town, true);
}

// 2. 町を まだ作っていない人・形がこわれている人でも 落ちない。あるものは消さない
{
  const p = { id: 'new', points: 5 };
  assert.deepEqual(islandOps(p, START), []);
  assert.deepEqual(p.world, { v: 1, ops: [] });
  const q = { id: 'odd', world: { v: 1, ops: 'こわれた', unlocked: ['x'] } };
  assert.deepEqual(islandOps(q, START), []);
  assert.deepEqual(q.world.unlocked, ['x']);
  const r = { id: 'odd2', world: { v: 2, ops: [{ t: 'path', r: 1, pts: [0, 0] }], isles: 'こわれた' } };
  assert.equal(islandOps(r, START).length, 1);
  assert.equal(worldOf(r).ops.length, 1);
}

// 3. 2つめの島: ひらくまでは 使えない。ひらくと 別の並びになり、はじまりの島には まざらない
registerIsland({ id: 'lake', name: 'みずうみの島' });
{
  const p = oldProfile(); const startBefore = clone(p.world.ops);
  assert.equal(isOpen(p, 'lake'), false);
  assert.equal(islandOps(p, 'lake'), null);
  assert.equal(setCurrentIsland(p, 'lake'), false);
  assert.equal(currentIslandId(p), START);
  assert.equal(openIsland(p, 'nothing'), false);

  assert.equal(openIsland(p, 'lake'), true);
  assert.equal(p.world.v, 2);
  islandOps(p, 'lake').push({ t: 'path', r: 0.7, pts: [1, 1] }, { t: 'place', k: 'piece:awning', seed: 9, x: 0, z: 2 });
  assert.deepEqual(p.world.ops, startBefore);                // はじまりの島は そのまま
  assert.equal(p.world.isles.lake.ops.length, 2);
  assert.equal(openIsland(p, 'lake'), true);                 // もういちど ひらいても 消えない
  assert.equal(p.world.isles.lake.ops.length, 2);

  // 島ごとの おぼえがき（たまご・たね など、あとで足すもの）
  islandData(p, 'lake').eggs = { kokugo: 3 };
  islandData(p, START).eggs = { sansu: 1 };
  assert.deepEqual(p.world.isles.start, { eggs: { sansu: 1 } });
  assert.deepEqual(p.world.ops, startBefore);
  assert.equal(islandOps(p, 'lake').length, 2);

  // うつる
  let heard = null; const off = onIslandChange((id) => { heard = id; });
  assert.equal(setCurrentIsland(p, 'lake'), true);
  assert.equal(heard, 'lake');
  assert.equal(currentIslandId(p), 'lake');
  assert.deepEqual(otherIslands(p, 'lake').map((x) => x.def.id), [START]);
  assert.equal(otherIslands(p, START)[0].ops, p.world.isles.lake.ops);
  assert.equal(currentIslandId({ id: 'other' }), START);     // きょうだいは 別べつ
  assert.equal(setCurrentIsland(p, START), true);
  assert.equal(currentIslandId(p), START);
  off();

  // 保存して読みなおしても 同じ（JSON に そのまま入る）
  const again = clone(p);
  assert.deepEqual(islandOps(again, START), startBefore);
  assert.equal(islandOps(again, 'lake').length, 2);
}

// 4. ためしの島（dev）は プロフィールに 何も書かない
registerIsland({ id: 'dev-x', name: 'ためし', dev: true });
{
  const p = oldProfile(); const before = clone(p);
  assert.equal(isOpen(p, 'dev-x'), true);
  islandOps(p, 'dev-x').push({ t: 'path', r: 1, pts: [0, 0] });
  assert.equal(islandOps(p, 'dev-x').length, 1);
  assert.deepEqual(p, before);
}

// 5. 端末どうしを そろえるとき（merge.js）: 古い版の端末が はじまりの島を、新しい版の端末が 2つめの島を
//    それぞれ進めても、どちらも のこる。ポイントも これまでどおり 足しあわされる
{
  const base = oldProfile();
  const oldDevice = clone(base);                             // 古い版: p.world.ops に 書きたすだけ
  oldDevice.world.ops.push({ t: 'path', r: 1.9, pts: [7, 7, 8, 8] });
  oldDevice.points += 30; oldDevice.xp += 30;
  const newDevice = clone(base);
  openIsland(newDevice, 'lake');
  islandOps(newDevice, 'lake').push({ t: 'ring', k: 'log', seed: 3, pts: [0, 0, 2, 0, 2, 2] });
  newDevice.points += 20; newDevice.xp += 20;
  for (const [l, r] of [[newDevice, oldDevice], [oldDevice, newDevice]]) {
    const m = mergeProfile(base, clone(l), clone(r));
    assert.equal(islandOps(m, START).length, base.world.ops.length + 1);
    assert.deepEqual(islandOps(m, START).slice(0, base.world.ops.length), base.world.ops);
    assert.equal(islandOps(m, 'lake').length, 1);
    assert.equal(m.points, base.points + 50);
    assert.equal(m.xp, base.xp + 50);
    assert.deepEqual(m.lvKeep, base.lvKeep);
  }
}

console.log('island-checks: ok');
