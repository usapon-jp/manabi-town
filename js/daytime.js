// 町の時間（朝焼け・昼・夕焼け・夜）。本当の時刻には合わせず、アプリを開いて 見えている あいだだけ進む。
// 1日 = 60分。内わけは 朝焼け8分・昼24分・夕焼け12分・夜16分（2026-11-15 フミオさん）。
// ここは 3D に さわらない（数と色だけ）。空の絵は sky.js、時計のカードは clockdial.js。
//
// 町の時刻は 「分」（0〜60）で あらわす。0 が 夜あけ（朝焼けの はじまり）。
//   0〜8 朝焼け / 8〜32 昼 / 32〜44 夕焼け / 44〜60 夜
// おぼえかた: 端末ごと・きょうだい（プロフィール）ごとに localStorage へ。ほかの端末とは そろえない
//   （開いている あいだだけ 進むので、端末ごとに ちがっていて よい。プロフィールの データには 1文字も 足さない）。
//
// 夜の灯り（理科の たまごで ひらく 予定）などは skyNow を 毎フレーム 読めばよい:
//   skyNow.night  … 夜の こさ 0〜1（昼は 0、まよなかは 1）
//   skyNow.lights … 灯りを どれだけ つけるか 0〜1（夕焼けの おわりに つきはじめ、朝焼けで きえる）
//   skyNow.minute / skyNow.phase（'asa' | 'hiru' | 'yugata' | 'yoru'）
//   onPhase(fn) … 時間帯が かわったとき（朝→昼 など）に fn(phase) を よぶ

export const DAY_MIN = 60;
export const PHASES = [
  { id: 'asa', name: '朝焼け', from: 0, to: 8 },
  { id: 'hiru', name: '昼', from: 8, to: 32 },
  { id: 'yugata', name: '夕焼け', from: 32, to: 44 },
  { id: 'yoru', name: '夜', from: 44, to: 60 },
];
// 時計の「朝・昼・夕方・夜」ボタンで とぶ 時刻（いちばん きれいな ところ）
export const JUMP = { asa: 4.5, hiru: 16, yugata: 39, yoru: 52 };
// はじめて 町を 開いた子は 昼の はじめから（いつもの 草原から 始まる）
export const START_MINUTE = 10;

export const wrap = (m) => ((m % DAY_MIN) + DAY_MIN) % DAY_MIN;
export function phaseOf(minute) {
  const m = wrap(minute);
  return PHASES.find((p) => m >= p.from && m < p.to) || PHASES[3];
}

// ---- 色の きまり（分 → 空の色） -----------------------------------------
// 色は 0〜1 の [r,g,b]。あいだは なめらかに まぜる。
// top: 空のてっぺん / mid: 空のなかほど / hz: 地平線（太陽の がわ） / hzAway: 地平線（太陽の はんたい がわ）
// sun: 日の光の 色 / sunI: 日の光（夜は 月の光）の つよさ / glow: 太陽の まわりの 光の ひろがり
// hemi / ground / hemiI: 空からの やわらかい光 / cloud: 雲の 色 / stars: 星の こさ / glowK: 建物の ほんのり光る つよさ
const K = [
  // 朝焼け: 夜のあと、むらさき → もも色 → 金色 と あけていく
  { m: 0, top: [0.05, 0.07, 0.21], mid: [0.13, 0.13, 0.33], hz: [0.36, 0.25, 0.48], hzAway: [0.16, 0.17, 0.36], sun: [0.75, 0.6, 0.95], sunI: 0.5, glow: 0.25, hemi: [0.55, 0.55, 0.85], ground: [0.2, 0.25, 0.32], hemiI: 0.85, cloud: [0.55, 0.52, 0.78], stars: 0.55, glowK: 0.75 },
  { m: 2.2, top: [0.2, 0.2, 0.45], mid: [0.45, 0.36, 0.62], hz: [0.86, 0.55, 0.72], hzAway: [0.42, 0.38, 0.62], sun: [1.0, 0.62, 0.7], sunI: 0.45, glow: 0.55, hemi: [0.78, 0.66, 0.85], ground: [0.32, 0.36, 0.38], hemiI: 1.0, cloud: [0.95, 0.68, 0.82], stars: 0.15, glowK: 0.85 },
  { m: 4.5, top: [0.42, 0.55, 0.82], mid: [0.86, 0.7, 0.8], hz: [1.0, 0.72, 0.62], hzAway: [0.78, 0.68, 0.82], sun: [1.0, 0.72, 0.58], sunI: 1.1, glow: 0.75, hemi: [1.0, 0.84, 0.82], ground: [0.42, 0.52, 0.36], hemiI: 1.25, cloud: [1.0, 0.8, 0.8], stars: 0, glowK: 0.95 },
  { m: 6.5, top: [0.45, 0.67, 0.92], mid: [0.92, 0.84, 0.74], hz: [1.0, 0.86, 0.55], hzAway: [0.86, 0.86, 0.86], sun: [1.0, 0.84, 0.6], sunI: 1.7, glow: 0.55, hemi: [1.0, 0.93, 0.84], ground: [0.48, 0.62, 0.36], hemiI: 1.45, cloud: [1.0, 0.92, 0.82], stars: 0, glowK: 1 },
  // 昼（絵本の 世界: 上は うすい 水色 → クリーム色 → 地平線は もも色。日ざしは 夕方の ような やさしい 金色。2026-11-18 フミオさん）
  { m: 8.5, top: [0.38, 0.62, 0.88], mid: [0.93, 0.88, 0.8], hz: [1.0, 0.86, 0.72], hzAway: [0.98, 0.9, 0.82], sun: [1.0, 0.86, 0.66], sunI: 2.0, glow: 0.5, hemi: [1.0, 0.94, 0.86], ground: [0.62, 0.66, 0.42], hemiI: 1.6, cloud: [1.0, 0.96, 0.9], stars: 0, glowK: 1 },
  { m: 31, top: [0.38, 0.62, 0.88], mid: [0.93, 0.88, 0.8], hz: [1.0, 0.86, 0.72], hzAway: [0.98, 0.9, 0.82], sun: [1.0, 0.86, 0.66], sunI: 2.0, glow: 0.5, hemi: [1.0, 0.94, 0.86], ground: [0.62, 0.66, 0.42], hemiI: 1.6, cloud: [1.0, 0.96, 0.9], stars: 0, glowK: 1 },
  // 夕焼け: だいだい色 → もも色 → むらさき と すこしずつ
  { m: 34, top: [0.4, 0.6, 0.88], mid: [0.86, 0.82, 0.78], hz: [1.0, 0.8, 0.5], hzAway: [0.92, 0.84, 0.76], sun: [1.0, 0.76, 0.46], sunI: 2.0, glow: 0.5, hemi: [1.0, 0.88, 0.74], ground: [0.5, 0.6, 0.34], hemiI: 1.45, cloud: [1.0, 0.9, 0.76], stars: 0, glowK: 1 },
  { m: 37, top: [0.36, 0.48, 0.8], mid: [0.98, 0.7, 0.52], hz: [1.0, 0.6, 0.3], hzAway: [0.86, 0.66, 0.68], sun: [1.0, 0.6, 0.32], sunI: 1.75, glow: 0.85, hemi: [1.0, 0.76, 0.6], ground: [0.5, 0.5, 0.32], hemiI: 1.35, cloud: [1.0, 0.72, 0.52], stars: 0, glowK: 1 },
  { m: 40, top: [0.32, 0.36, 0.68], mid: [0.94, 0.56, 0.62], hz: [1.0, 0.52, 0.5], hzAway: [0.62, 0.46, 0.66], sun: [1.0, 0.5, 0.48], sunI: 1.15, glow: 0.95, hemi: [0.96, 0.66, 0.72], ground: [0.42, 0.4, 0.38], hemiI: 1.15, cloud: [1.0, 0.62, 0.68], stars: 0, glowK: 0.95 },
  { m: 42.2, top: [0.18, 0.18, 0.44], mid: [0.5, 0.34, 0.6], hz: [0.8, 0.42, 0.6], hzAway: [0.32, 0.28, 0.52], sun: [0.78, 0.48, 0.85], sunI: 0.55, glow: 0.6, hemi: [0.7, 0.58, 0.85], ground: [0.28, 0.3, 0.38], hemiI: 0.95, cloud: [0.78, 0.55, 0.8], stars: 0.2, glowK: 0.85 },
  // 夜（こわくない 絵本の 夜: こい青に 星。町の すがたは ちゃんと 見える）
  { m: 45, top: [0.05, 0.08, 0.24], mid: [0.1, 0.14, 0.34], hz: [0.2, 0.22, 0.42], hzAway: [0.16, 0.19, 0.38], sun: [0.68, 0.76, 1.0], sunI: 0.5, glow: 0.2, hemi: [0.48, 0.55, 0.9], ground: [0.16, 0.22, 0.3], hemiI: 0.7, cloud: [0.4, 0.44, 0.66], stars: 0.9, glowK: 0.6 },
  { m: 52, top: [0.03, 0.05, 0.18], mid: [0.07, 0.1, 0.28], hz: [0.16, 0.18, 0.36], hzAway: [0.13, 0.15, 0.33], sun: [0.68, 0.76, 1.0], sunI: 0.5, glow: 0.2, hemi: [0.45, 0.52, 0.88], ground: [0.14, 0.2, 0.28], hemiI: 0.62, cloud: [0.36, 0.4, 0.62], stars: 1, glowK: 0.55 },
  { m: 60, top: [0.05, 0.07, 0.21], mid: [0.13, 0.13, 0.33], hz: [0.36, 0.25, 0.48], hzAway: [0.16, 0.17, 0.36], sun: [0.75, 0.6, 0.95], sunI: 0.5, glow: 0.25, hemi: [0.55, 0.55, 0.85], ground: [0.2, 0.25, 0.32], hemiI: 0.85, cloud: [0.55, 0.52, 0.78], stars: 0.55, glowK: 0.75 },
];
const smooth = (t) => t * t * (3 - 2 * t);
const mixN = (a, b, t) => a + (b - a) * t;
const mixC = (a, b, t) => [mixN(a[0], b[0], t), mixN(a[1], b[1], t), mixN(a[2], b[2], t)];

// 太陽の のぼる・しずむ 時刻（分）。夜は 月が 出る
export const SUNRISE = 3.5;
export const SUNSET = 41;
const MAX_ELEV = 0.62;        // いちばん 高いときの 高さ（ラジアン。約35度）

// 太陽の むき（単位ベクトル [x,y,z]）。朝は 左おく、夕方は 右おく（はじめの カメラの 正面）に しずむ
export function sunDir(minute) {
  const m = wrap(minute);
  const u = (m - SUNRISE) / (SUNSET - SUNRISE);     // 0=日の出, 1=日の入り
  const az = mixN(-1.05, 0.62, Math.min(1.15, Math.max(-0.15, u)));   // -z を 0 として +x へ
  const elev = u > 0 && u < 1 ? MAX_ELEV * Math.pow(Math.sin(Math.PI * u), 0.55) : -0.12;
  const c = Math.cos(elev);
  return [Math.sin(az) * c, Math.sin(elev), -Math.cos(az) * c];
}
// 月の むき（夜の まんなかで いちばん 高い。太陽と はんたいの 空）
export function moonDir(minute) {
  const m = wrap(minute);
  const night = m >= SUNSET ? m - SUNSET : m + DAY_MIN - SUNSET;   // 日の入りから 何分
  const u = night / (DAY_MIN - SUNSET + SUNRISE);
  const az = mixN(-0.9, 0.5, u);
  const elev = 0.15 + 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
  const c = Math.cos(elev);
  return [Math.sin(az) * c, Math.sin(elev), -Math.cos(az) * c];
}

// 夜の こさ（0〜1）と 灯り（0〜1）
export function nightOf(minute) {
  const m = wrap(minute);
  if (m < 2) return 1 - smooth(m / 2) * 0.4;
  if (m < 5) return 0.6 * (1 - smooth((m - 2) / 3));
  if (m < 40) return 0;
  if (m < 45) return smooth((m - 40) / 5);
  return 1;
}
export function lightsOf(minute) {
  const m = wrap(minute);
  if (m < 4) return 1;
  if (m < 6) return 1 - smooth((m - 4) / 2);
  if (m < 40.5) return 0;
  if (m < 43) return smooth((m - 40.5) / 2.5);
  return 1;
}

// 分 → 空の ようす（色・光・星・太陽の むき）。毎フレーム よんでも 軽いように、ただの 計算だけ
export function skyAt(minute) {
  const m = wrap(minute);
  let i = 0;
  while (i < K.length - 2 && m >= K[i + 1].m) i++;
  const a = K[i]; const b = K[i + 1];
  const t = smooth(Math.min(1, Math.max(0, (m - a.m) / (b.m - a.m || 1))));
  const out = { minute: m, phase: phaseOf(m).id, night: nightOf(m), lights: lightsOf(m) };
  for (const k of Object.keys(a)) {
    if (k === 'm') continue;
    out[k] = Array.isArray(a[k]) ? mixC(a[k], b[k], t) : mixN(a[k], b[k], t);
  }
  const sd = sunDir(m);
  out.sunUp = sd[1] > 0;
  out.sunDir = sd;
  out.moonDir = moonDir(m);
  // 光の むき: 日が 出ているあいだは 太陽、しずんだら 月（切りかわりは 光が よわい ときなので めだたない）
  out.lightDir = sd[1] > 0.02 ? sd : out.moonDir;
  return out;
}

// いまの 空（sky.js が 毎フレーム 書きかえる。夜の灯りなどは ここを 読む）
export const skyNow = { minute: START_MINUTE, phase: 'hiru', night: 0, lights: 0 };
const phaseFns = new Set();
export function onPhase(fn) { phaseFns.add(fn); return () => phaseFns.delete(fn); }
export function publishSky(s) {
  const was = skyNow.phase;
  skyNow.minute = s.minute; skyNow.phase = s.phase; skyNow.night = s.night; skyNow.lights = s.lights;
  if (was !== s.phase) phaseFns.forEach((fn) => { try { fn(s.phase); } catch (_) { /* ひとつ こわれても ほかは 動かす */ } });
}

// ---- 時計（進める・おぼえる） ------------------------------------------
// store: { get(): string|null, set(string) }（ふだんは localStorage。たしかめでは にせもの）
// now: () => ミリ秒（ふだんは performance.now）
export const CLOCK_KEY = 'manabi-townclock';
const TICK_MAX_MS = 15000;   // これより 長い すきま（端末が ねていた など）は 進めない

export function createClock({ store, now = () => performance.now(), speed = 1 } = {}) {
  let memo = null;
  const read = () => {
    if (memo) return memo;
    try { const v = JSON.parse(store?.get() || 'null'); memo = v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (_) { memo = {}; }
    return memo;
  };
  const write = () => { try { store?.set(JSON.stringify(read())); } catch (_) { /* おぼえられなくても この回は 動く */ } };
  let pid = null;
  let minute = START_MINUTE;
  let running = false;
  let last = 0;
  let dirty = false;

  const valid = (v) => typeof v === 'number' && Number.isFinite(v);
  function fold() {
    if (!running) return;
    const t = now();
    const gap = t - last;
    last = t;
    if (gap > 0 && gap <= TICK_MAX_MS) { minute = wrap(minute + (gap / 60000) * speed); dirty = true; }
  }
  function persist() {
    fold();
    if (pid == null || !dirty) return;
    read()[pid] = Math.round(minute * 1000) / 1000;
    dirty = false;
    write();
  }
  return {
    // きょうだいを かえたら、その子の 時刻に
    setProfile(id) {
      if (id === pid) return;
      persist();
      pid = id ?? null;
      const v = pid == null ? null : read()[pid];
      minute = valid(v) ? wrap(v) : START_MINUTE;
      last = now();
    },
    // 見えている あいだだけ 進む（かくれたら とめて おぼえる）
    setRunning(on) {
      if (on === running) return;
      if (!on) { persist(); running = false; return; }
      running = true; last = now();
    },
    // いまの 分（よぶたびに 進んだ分を たす）
    minute() { fold(); return minute; },
    // 時計塔で あわせる
    // keep: false のときは まだ おぼえない（指で まわしている とちゅう）。おわったら save()
    set(m, keep = true) { if (!valid(m)) return; fold(); minute = wrap(m); dirty = true; if (keep) persist(); },
    save: persist,
    get running() { return running; },
  };
}
