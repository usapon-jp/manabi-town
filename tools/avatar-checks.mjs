// node --experimental-default-type=module tools/avatar-checks.mjs
// 町の女の子（js/avatar.js）の たしかめ。いちばん大事なのは「名前を つけても ほかの データが 1文字も 変わらないこと」。
import assert from 'node:assert/strict';
import { lookOf, lookKey, DEFAULT_WEAR, DEFAULT_COLORS, hasAvatarName, avatarName, setAvatarName, wearPart, setAvatarColor, cleanName, partsOfKind, PARTS, KINDS } from '../js/avatar.js';
import { mergeProfile } from '../js/merge.js';

const clone = (v) => JSON.parse(JSON.stringify(v));
const kid = () => ({ id: 'k1', name: 'たろう', grade: 'e4', points: 340, xp: 1280, items: [], quizzes: [], daily: {}, log: [{ at: 1, n: 10 }], world: { v: 1, ops: [{ t: 'path', r: 1, pts: [0, 0, 1, 1] }] } });

// 1. いまの子（p.avatar なし）: 名前は まだ、見た目は ふつう。読むだけで 何も 変わらない
{
  const p = kid(); const before = clone(p);
  assert.equal(hasAvatarName(p), false);
  assert.deepEqual(lookOf(p), { wear: DEFAULT_WEAR, colors: DEFAULT_COLORS });
  assert.deepEqual(p, before);
}
// 2. 名前を つけると p.avatar だけ ふえる（ポイント・レベル・町は そのまま）
{
  const p = kid(); const before = clone(p);
  assert.equal(setAvatarName(p, '  はな \n'), true);
  assert.equal(avatarName(p), 'はな');
  const { avatar, ...rest } = p;
  assert.deepEqual(rest, before);
  assert.deepEqual(avatar, { name: 'はな' });
  assert.equal(setAvatarName(p, '   '), false);   // 空は つけない
  assert.equal(avatarName(p), 'はな');
  assert.equal(cleanName('あいうえおかきくけこ').length, 8);
}
// 3. 台帳: 体も 同じ 一覧。どの kind にも ふつうの 部品がある。id は かぶらない
{
  assert.equal(new Set(PARTS.map((x) => x.id)).size, PARTS.length);
  for (const k of KINDS) assert.ok(partsOfKind(k).some((x) => x.id === DEFAULT_WEAR[k]), k);
  assert.ok(partsOfKind('body').length >= 1);
}
// 4. 着せ替え（あとの スレッド用）: 知らない部品・色は つけない。消えた部品は ふつうに もどる
{
  const p = kid();
  assert.equal(wearPart(p, 'hair:bob'), true);
  assert.equal(wearPart(p, 'hair:nai'), false);
  assert.equal(setAvatarColor(p, 'hair', 'kuro'), true);
  assert.equal(setAvatarColor(p, 'hair', 'niji'), false);
  assert.equal(lookOf(p).wear.hair, 'hair:bob');
  assert.equal(lookOf(p).colors.hair, 'kuro');
  p.avatar.wear.outfit = 'outfit:mukashi';     // 台帳から 消えた
  p.avatar.wear.hair = 'outfit:wanpi';         // kind が ちがう
  assert.equal(lookOf(p).wear.outfit, DEFAULT_WEAR.outfit);
  assert.equal(lookOf(p).wear.hair, DEFAULT_WEAR.hair);
  assert.notEqual(lookKey(lookOf(kid())), lookKey(lookOf(p)));
}
// 5. 端末どうしで そろえる: 片方で 名前を つけ、もう片方で 勉強しても 両方 のこる
{
  const base = kid();
  const a = clone(base); setAvatarName(a, 'はな');
  const b = clone(base); b.points = 400; b.log.push({ at: 2, n: 60 });
  const m = mergeProfile(base, a, b);
  assert.equal(m.avatar.name, 'はな');
  assert.equal(m.points, 400);
  assert.equal(m.log.length, 2);
  assert.deepEqual(m.world, base.world);
}
console.log('avatar checks: ok');
