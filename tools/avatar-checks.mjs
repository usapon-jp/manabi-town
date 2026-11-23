// node --experimental-default-type=module tools/avatar-checks.mjs
// 町の女の子（js/avatar.js）の たしかめ。いちばん大事なのは「名前を つけても ほかの データが 1文字も 変わらないこと」。
import assert from 'node:assert/strict';
import { lookOf, lookKey, DEFAULT_WEAR, DEFAULT_COLORS, hasAvatarName, avatarName, setAvatarName, wearPart, setAvatarColor, setAvatarFace, resetAvatarLook, cleanName, partsOfKind, partOf, PARTS, KINDS, COLORS, COLOR_SHIFT, FACE } from '../js/avatar.js';
import { ITEMS } from '../js/data/gacha.js';
import { mergeProfile } from '../js/merge.js';

const clone = (v) => JSON.parse(JSON.stringify(v));
const kid = () => ({ id: 'k1', name: 'たろう', grade: 'e4', points: 340, xp: 1280, items: [], quizzes: [], daily: {}, log: [{ at: 1, n: 10 }], world: { v: 1, ops: [{ t: 'path', r: 1, pts: [0, 0, 1, 1] }] } });

// 1. いまの子（p.avatar なし）: 名前は まだ、見た目は ふつう。読むだけで 何も 変わらない
{
  const p = kid(); const before = clone(p);
  assert.equal(hasAvatarName(p), false);
  assert.deepEqual(lookOf(p), { wear: DEFAULT_WEAR, colors: DEFAULT_COLORS, face: { eye: 0, mouth: 0, slim: 0 } });
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
// 6. 帽子・色・顔の 調整（女の子v2、2026-11-22）
{
  const p = kid(); const before = clone(p);
  assert.equal(lookOf(p).wear.hat, 'hat:none');
  assert.equal(wearPart(p, 'hat:beret'), true);
  assert.equal(setAvatarColor(p, 'eye', 'midori'), true);
  assert.equal(setAvatarFace(p, 'eye', 0.42), true);
  assert.equal(setAvatarFace(p, 'slim', -3), true);      // はんいの外は はしに よせる
  assert.equal(setAvatarFace(p, 'nose', 1), false);
  const l = lookOf(p);
  assert.equal(l.wear.hat, 'hat:beret');
  assert.equal(l.colors.eye, 'midori');
  assert.equal(l.face.eye, 0.4);                          // 0.05 きざみ
  assert.equal(l.face.slim, FACE.find((f) => f.key === 'slim').min);
  assert.notEqual(lookKey(l), lookKey(lookOf(kid())));
  p.avatar.face.mouth = 'abc';                            // こわれた 値は 0
  assert.equal(lookOf(p).face.mouth, 0);
  resetAvatarLook(p);
  assert.deepEqual(lookOf(p).face, { eye: 0, mouth: 0, slim: 0 });
  assert.equal(lookOf(p).colors.eye, DEFAULT_COLORS.eye);
  assert.equal(lookOf(p).wear.hat, 'hat:beret');          // 着ている ものは そのまま
  const { avatar, ...rest } = p;
  assert.deepEqual(rest, before);
  // 色は どれも 3Dの ずらし方が ある。ガチャの きせかえは 台帳の 部品と つながっている
  for (const slot of ['hair', 'eye']) for (const k of Object.keys(COLORS[slot])) assert.ok(COLOR_SHIFT[slot][k], `${slot}:${k}`);
  for (const it of ITEMS.filter((i) => i.kind === 'wear')) assert.equal(partOf(it.wear)?.gacha, it.id, it.id);
  for (const part of PARTS.filter((x) => x.gacha)) assert.ok(ITEMS.some((i) => i.id === part.gacha), part.id);
}
// 2026-11-23 三つ編み: 女の子v2の 髪型に ある id は 台帳の hair。みつあみを えらぶと 保存に のこる
{
  const girl = partOf('body:girl');
  for (const st of girl.hairStyles) assert.equal(partOf(st.id)?.kind, 'hair', st.id);
  const p = kid();
  assert.equal(wearPart(p, 'hair:mitsuami'), true);
  assert.equal(lookOf(p).wear.hair, 'hair:mitsuami');
  console.log('braids checks: ok');
}
