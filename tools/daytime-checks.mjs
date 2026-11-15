// node --experimental-default-type=module tools/daytime-checks.mjs
// 町の時間（js/daytime.js）の たしかめ。いちばん大事なのは「開いている あいだだけ 進む」「きょうだいごとに おぼえる」「プロフィールの データに さわらない」。
import assert from 'node:assert/strict';
import { PHASES, DAY_MIN, phaseOf, skyAt, createClock, START_MINUTE, nightOf, lightsOf, sunDir, JUMP, wrap, skyNow, publishSky, onPhase } from '../js/daytime.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≒ ${b}`);
const memStore = () => { let v = null; return { get: () => v, set: (x) => { v = x; }, peek: () => v }; };

// 1. 内わけ: 朝焼け8・昼24・夕焼け12・夜16 で 60分
{
  assert.deepEqual(PHASES.map((p) => p.to - p.from), [8, 24, 12, 16]);
  assert.equal(PHASES.at(-1).to, DAY_MIN);
  assert.equal(phaseOf(0).id, 'asa'); assert.equal(phaseOf(7.99).id, 'asa');
  assert.equal(phaseOf(8).id, 'hiru'); assert.equal(phaseOf(31.9).id, 'hiru');
  assert.equal(phaseOf(32).id, 'yugata'); assert.equal(phaseOf(44).id, 'yoru');
  assert.equal(phaseOf(60).id, 'asa'); assert.equal(phaseOf(-1).id, 'yoru');
  for (const [id, m] of Object.entries(JUMP)) assert.equal(phaseOf(m).id, id);
}
// 2. 空の色: どの 分でも 0〜1 の 色。昼は いままでの 草原と 同じ。夜は 暗く 星が 出る。1日の さいごと はじめが つながる
{
  for (let m = 0; m < 60; m += 0.25) {
    const s = skyAt(m);
    for (const k of ['top', 'mid', 'hz', 'hzAway', 'sun', 'hemi', 'ground', 'cloud']) for (const c of s[k]) assert.ok(c >= 0 && c <= 1 && Number.isFinite(c), `${k}@${m}`);
    for (const k of ['sunI', 'hemiI', 'glow', 'stars', 'glowK', 'night', 'lights']) assert.ok(Number.isFinite(s[k]) && s[k] >= 0, `${k}@${m}`);
    assert.ok(Math.abs(Math.hypot(...s.sunDir) - 1) < 1e-6);
  }
  const day = skyAt(20);
  assert.deepEqual(day.top, [0.42, 0.68, 0.92]);
  assert.deepEqual(day.hz, [0.965, 0.914, 0.812]);
  near(day.sunI, 2.1); near(day.hemiI, 1.55); assert.equal(day.stars, 0); assert.equal(day.night, 0);
  assert.ok(day.sunUp && day.sunDir[1] > 0.4, '昼は 太陽が 高い');
  const night = skyAt(52);
  assert.ok(night.top[2] < 0.3 && night.stars > 0.9 && night.night === 1 && !night.sunUp);
  const a = skyAt(59.999); const b = skyAt(0);
  for (const k of ['top', 'mid', 'hz', 'cloud']) for (let i = 0; i < 3; i++) near(a[k][i], b[k][i], 1e-3);
  // 夕焼けは だいだい → もも色 → むらさき（地平線の 赤みが 強く、あとほど 青みが 増える）
  const orange = skyAt(37).hz; const pink = skyAt(40).hz; const purple = skyAt(42.2).hz;
  assert.ok(orange[0] > orange[2] + 0.5, 'だいだい');
  assert.ok(pink[2] > orange[2], 'もも色');
  assert.ok(purple[2] > purple[1], 'むらさき');
  // 朝焼けは むらさき → もも色 → 金色
  const dawn1 = skyAt(0.5).hz; const dawn2 = skyAt(2.2).hz; const dawn3 = skyAt(6.5).hz;
  assert.ok(dawn1[2] > dawn1[1], 'むらさき'); assert.ok(dawn2[0] > 0.8, 'もも色'); assert.ok(dawn3[0] > 0.95 && dawn3[1] > dawn3[2] + 0.2, '金色');
  // 太陽は 夕焼けの 中で しずむ / 朝焼けの 中で のぼる
  assert.ok(sunDir(38)[1] > 0 && sunDir(42)[1] < 0);
  assert.ok(sunDir(3)[1] < 0 && sunDir(5)[1] > 0);
}
// 3. 夜の灯り: 夕焼けの おわりで つきはじめ、夜は つきっぱなし、朝焼けで きえる。昼は つかない
{
  assert.equal(lightsOf(20), 0); assert.equal(lightsOf(50), 1); assert.equal(lightsOf(2), 1); assert.equal(lightsOf(7), 0);
  assert.ok(lightsOf(42) > 0 && lightsOf(42) < 1);
  assert.equal(nightOf(20), 0); assert.equal(nightOf(50), 1);
  for (let m = 0; m < 60; m += 0.1) { assert.ok(lightsOf(m) >= 0 && lightsOf(m) <= 1); assert.ok(nightOf(m) >= 0 && nightOf(m) <= 1); }
  const seen = [];
  const off = onPhase((p) => seen.push(p));
  publishSky(skyAt(20)); publishSky(skyAt(21)); publishSky(skyAt(40)); publishSky(skyAt(50));
  off();
  publishSky(skyAt(2));
  assert.deepEqual(seen, ['yugata', 'yoru']);   // かわったときだけ（はじめの 昼→昼は よばない）
  assert.equal(skyNow.phase, 'asa');
}
// 4. 時計: 見えている あいだだけ 進む。1分で 1分。長い すきま（ねていた）は 進めない
{
  let t = 0; const store = memStore();
  const c = createClock({ store, now: () => t });
  c.setProfile('k1');
  assert.equal(c.minute(), START_MINUTE);            // はじめての子は 昼から
  t += 60000; assert.equal(c.minute(), START_MINUTE); // まだ 走っていない
  c.setRunning(true);
  t += 5000; t += 5000; c.minute(); t += 5000; c.minute(); t += 5000; c.minute();
  near(c.minute(), START_MINUTE + 20 / 60);
  c.setRunning(false);                                // かくれた（アプリを とじた）
  t += 3600000;
  near(c.minute(), START_MINUTE + 20 / 60);
  c.setRunning(true);
  t += 10 * 60000;                                    // 10分 だれも 数えなかった（端末が ねていた）
  near(c.minute(), START_MINUTE + 20 / 60);
  for (let i = 0; i < 12 * 60; i++) { t += 5000; c.minute(); }   // 60分 → 1日 まわって もとの 時刻
  near(c.minute(), START_MINUTE + 20 / 60, 1e-6);
}
// 5. おぼえる: きょうだいごと。つぎに 開くと つづきから。こわれた 保存でも 動く
{
  let t = 0; const store = memStore();
  const c = createClock({ store, now: () => t });
  c.setProfile('ane'); c.setRunning(true);
  c.set(40);
  t += 5000; c.minute();
  c.setProfile('otouto');
  assert.equal(c.minute(), START_MINUTE);
  c.set(50);
  c.setRunning(false);
  const saved = JSON.parse(store.peek());
  near(saved.ane, 40 + 5 / 60, 1e-3); assert.equal(saved.otouto, 50);
  const c2 = createClock({ store, now: () => t });
  c2.setProfile('ane'); near(c2.minute(), 40 + 5 / 60, 1e-3);
  c2.setProfile('otouto'); assert.equal(c2.minute(), 50);
  for (const bad of ['{', '[1,2]', 'null', '"x"', JSON.stringify({ k: 'abc' }), JSON.stringify({ k: 1e999 })]) {
    const s = { get: () => bad, set: () => {} };
    const c3 = createClock({ store: s, now: () => 0 });
    c3.setProfile('k'); assert.equal(c3.minute(), START_MINUTE);
  }
  // 保存が つかえない 端末（かきこみで エラー）でも 進む
  const c4 = createClock({ store: { get: () => { throw new Error('x'); }, set: () => { throw new Error('x'); } }, now: () => t });
  c4.setProfile('k'); c4.setRunning(true); t += 6000; near(c4.minute(), START_MINUTE + 0.1); c4.set(30); assert.equal(c4.minute(), 30); c4.save();
  // 指で まわしている とちゅう（keep:false）は まだ おぼえない
  const s5 = memStore(); const c5 = createClock({ store: s5, now: () => t });
  c5.setProfile('k'); c5.set(33, false); assert.equal(s5.peek(), null); c5.save(); assert.equal(JSON.parse(s5.peek()).k, 33);
  assert.equal(wrap(-0.5), 59.5); c5.set(75); assert.equal(c5.minute(), 15);
}
// 6. プロフィールの データには さわらない（時計は 端末の localStorage だけ）
{
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../js/daytime.js', import.meta.url), 'utf8'));
  assert.ok(!/^import/m.test(src), 'ほかの ファイル（store など）を 読まない');
}
console.log('daytime-checks: ok');
