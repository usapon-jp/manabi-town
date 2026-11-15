// 教科の たまご と 建物の たね。3D と 画面には さわらない（3D は js/eggs3d.js、画面は js/eggui.js）。
//
// きまり（企画 2026-11-15）:
//   - ピヨ先生から 5教科の たまごを まとめて もらう。どれから あたためても よい
//   - たまごも たねも、放っておいても ゆっくり 育つ（たまご 7日・たね 5日）。
//     その教科を 10分 勉強するごとに 半日ぶん すすむ（とちゅうの 5分も その半分 すすむ）
//   - もらったとき、それまでに その教科を 勉強した分だけ 少し あたたまっている（上限あり）
//   - たまごが 孵化すると 教科の なかまが うまれ、その教科の 建物の たねを くれる。たねを うえると 芽 → つぼみ → 建物
//   - 孵化するたびに 新しい しくみが ひらく（しくみ本体は べつの スレッドで作る。ここは 入口だけ）
//   - やらなかった日に へることは ない。のこり時間は 数字で 見せない（stageOf の ことばで 出す）
//
// 保存の形（はじまりの島の 入れ物 islandData(p, 'start') の中。端末どうしで そろう）:
//   eggs = {
//     got: 1731650000000,                 // たまごを もらった時刻
//     pre: { kokugo: 120, ... },          // もらったときまでに 勉強した分（分）。あとで 記録を なおしても かわらない
//     hatch: { kokugo: 1731700000000 },   // 孵化させた時刻（子どもが タッチした とき）
//     seed: { kokugo: { x, z, rot, at } },// たねを うえた 場所と 時刻
//     built: { kokugo: 1731800000000 },   // 建物が できあがった時刻（タッチした とき）
//     link: { kokugo: '国語' },           // つなげる 教科の名前（おとな・教科の名前を かえた子）。ないときは ふつうの 教科
//     warm: [{ id, at, subject, min }],   // タイマー いがいで 勉強した分（きょうのクエスト など）
//   }
// - すすみは「保存した数」では なく、時刻と 勉強の記録（p.sessions と warm）から 毎回 計算する。
//   2台の 端末で 別々に 勉強しても、記録が そろえば すすみも そろう（足しすぎ・消えすぎが おきない）。
// - ポイント・レベル・町の ops には さわらない。p.world.ops も 動かさない。
import { islandData, START } from './islands.js';

// ---- 数字（ためしてから 調整できるように ここに まとめる） ----
export const TUNE = {
  eggDays: 7,            // 放っておいて 孵化するまで
  seedDays: 5,           // 放っておいて 建物が できるまで
  boostMin: 10,          // この分 勉強すると…
  boostDays: 0.5,        // …これだけ すすむ（10分で 半日）
  questMin: 5,           // きょうのクエストの 1パーツは 5分 勉強した ことにする
  preDaysPer10: 0.15,    // もらう前の 勉強 10分で すすむ日数（いまの 勉強より ひかえめ）
  preMaxDays: 2.5,       // もらう前の 勉強で すすむのは ここまで（いきなり 孵化しないように）
  warmMax: 400,          // warm の 記録は ここまで（古い 順に すてる）
};
const DAY = 86400000;

// ---- 5つの たまご。id は 保存に入るので 変えない ----
// subject: ふつうの 教科名（子ども）/ adult: おとなの ふつうの ジャンル（ならびの 何番目か）
// chara: 生まれる なかま（3Dモデルが できたら model に GLB の パスを 書く。js/eggs3d.js の CHARAS も 見てね）
// building: たねから できる 建物
export const EGGS = [
  { id: 'kokugo', subject: '国語', adult: 0, color: 0xd78b9f, chara: { name: 'ふくろう', kind: 'owl', model: null }, building: { id: 'library', name: '図書館' } },
  { id: 'sansu', subject: '算数・数学', adult: 1, color: 0x7f985e, chara: { name: 'リス', kind: 'squirrel', model: null }, building: { id: 'bank', name: '銀行' } },
  { id: 'rika', subject: '理科', adult: 2, color: 0xd8b85a, chara: { name: 'モグラ', kind: 'mole', model: null }, building: { id: 'power', name: '発電所' } },
  { id: 'shakai', subject: '社会', adult: 3, color: 0xc98766, chara: { name: 'キツネ', kind: 'fox', model: null }, building: { id: 'market', name: '市場' } },
  { id: 'eigo', subject: '英語', adult: 4, color: 0x7aa6bd, chara: { name: 'ウサギ', kind: 'rabbit', model: null }, building: { id: 'airport', name: '空港' } },
];
const byId = new Map(EGGS.map((e) => [e.id, e]));
export const eggDef = (id) => byId.get(id) || null;

// ---- 孵化で ひらく しくみ（入口だけ） ----
// その たまごが 孵化したら ひらく しくみの キー。しくみ本体は registerFeature で 名前を 登録すると、
// 孵化の カードで「〇〇が つかえるよ」と 出る（登録が まだの しくみは 出さない）。
export const UNLOCKS = {
  rika: ['camera', 'nightLights'],
  sansu: ['bank'],
  kokugo: ['library'],
  shakai: ['album', 'market'],
  eigo: ['tourists'],
};
const features = new Map();     // key -> { label, line, built }
const featureListeners = new Set();
export function registerFeature(key, def = {}) {
  if (typeof key !== 'string' || !key) return false;
  // line: 孵化の カードに 出す ことば（なければ「〇〇が つかえるよ」）。built: 建物が できた カードに 出す ことば
  features.set(key, { label: String(def.label || key), line: def.line ? String(def.line) : '', built: def.built ? String(def.built) : '' });
  return true;
}
export const featureDef = (key) => features.get(key) || null;
// しくみが ひらいているか（どれかの たまごが 孵化して その しくみを くれた）
export function featureOpen(p, key) {
  const e = eggsOf(p);
  if (!e) return false;
  return EGGS.some((d) => e.hatch?.[d.id] && (UNLOCKS[d.id] || []).includes(key));
}
// 孵化して しくみが ひらいたら fn(key, p) を よぶ（しくみの スレッドが 使う）
export function onFeatureOpen(fn) { featureListeners.add(fn); return () => featureListeners.delete(fn); }
// その たまごで ひらいて、名前が 登録ずみの しくみ（孵化カードに 出す）
export const unlockLabels = (id) => (UNLOCKS[id] || []).map((k) => features.get(k)?.label).filter(Boolean);
// 孵化の カードの ことば（しくみごと 1行。どこで つかうかまで わかるように）
export const unlockLines = (id) => (UNLOCKS[id] || []).map((k) => features.get(k)).filter(Boolean).map((f) => f.line || `${f.label}が つかえるよ`);
// その たまごの 建物が できたときの ことば（銀行なら「タッチすると あずけられるよ」）
export const builtLines = (id) => (UNLOCKS[id] || []).map((k) => features.get(k)?.built).filter(Boolean);
// 子どもに 見せる 教科名（「算数・数学」は 小学生なら 算数、中学生なら 数学）。記録の 教科名は かえない
export function subjectWord(p, name) {
  if (name !== '算数・数学') return name;
  if (p?.grade === 'adult') return name;
  return /^j/.test(p?.grade || '') ? '数学' : '算数';
}

// ---- 入れ物 ----
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// 読むだけ（まだ もらっていなければ null。p は 書きかえない）
export function eggsOf(p) {
  const w = p?.world;
  if (!plain(w) || !plain(w.isles) || !plain(w.isles[START])) return null;
  const e = w.isles[START].eggs;
  return plain(e) && num(e.got) != null ? e : null;
}
export const hasEggs = (p) => !!eggsOf(p);

// 書くための 入れ物（足りない ところを おぎなう）
function own(p) {
  const rec = islandData(p, START);
  if (!plain(rec.eggs)) rec.eggs = {};
  const e = rec.eggs;
  for (const k of ['pre', 'hatch', 'seed', 'built', 'link']) if (!plain(e[k])) e[k] = {};
  if (!Array.isArray(e.warm)) e.warm = [];
  return e;
}

// ---- どの教科と つながっているか ----
// subjects: その人の 教科（ジャンル）の名前の ならび（subjects.js の subjectNames）。なくても よい
export function eggSubject(p, id, subjects) {
  const d = byId.get(id);
  if (!d) return null;
  const link = eggsOf(p)?.link?.[id];
  if (typeof link === 'string' && link) return link;
  if (p?.grade === 'adult' && Array.isArray(subjects) && subjects[d.adult]) return subjects[d.adult];
  return d.subject;
}
export function setEggSubject(p, id, name) {
  if (!byId.has(id) || typeof name !== 'string' || !name.trim() || !hasEggs(p)) return false;
  own(p).link[id] = name.trim();
  return true;
}
// 教科の名前を かえたとき（subjects.js）: つながりも いっしょに かえる
export function renameEggSubject(p, from, to, subjects) {
  if (!hasEggs(p)) return;
  for (const d of EGGS) if (eggSubject(p, d.id, subjects) === from) own(p).link[d.id] = to;
}

// ---- 勉強の 分数 ----
// 記録 1つの おわった時刻。タイマーは start + 分。start が ない古い記録は その日の おひる
function endOf(s) {
  const st = num(s.start);
  if (st != null) return st + (Number(s.minutes) || 0) * 60000;
  if (typeof s.date === 'string') {
    const [y, m, d] = s.date.split('-').map(Number);
    if (y && m && d) return new Date(y, m - 1, d, 12).getTime();
  }
  return 0;
}
// subject を from（時刻）より あとに 勉強した 分数。before: true なら from より 前
export function studyMinutes(p, subject, from, { before = false } = {}) {
  let sum = 0;
  const add = (t, min) => { if (!(min > 0)) return; if (before ? t < from : t >= from) sum += min; };
  (Array.isArray(p?.sessions) ? p.sessions : []).forEach((s) => { if (s && s.subject === subject) add(endOf(s), Number(s.minutes) || 0); });
  if (!before) (eggsOf(p)?.warm || []).forEach((w) => { if (w && w.subject === subject) add(num(w.at) ?? 0, Number(w.min) || 0); });
  return sum;
}

// ---- もらう ----
export function giveEggs(p, now = Date.now(), subjects) {
  if (!p || hasEggs(p)) return false;
  const e = own(p);
  e.got = now;
  // おとなは いまの ジャンルの ならびで つなげて おく（あとで ならびかえても かわらない）
  if (p.grade === 'adult' && Array.isArray(subjects)) for (const d of EGGS) if (subjects[d.adult]) e.link[d.id] = subjects[d.adult];
  // もらう前の 勉強は ここで 数えて とっておく（あとで 古い記録を なおしても かわらない）
  for (const d of EGGS) {
    const s = eggSubject(p, d.id, subjects);
    e.pre[d.id] = studyMinutes(p, s, now, { before: true });
  }
  return true;
}

// ---- すすみ（0〜1） ----
const boostDays = (min) => (min / TUNE.boostMin) * TUNE.boostDays;
export function eggProgress(p, id, now = Date.now(), subjects) {
  const e = eggsOf(p);
  if (!e || !byId.has(id)) return 0;
  if (e.hatch?.[id]) return 1;
  const pre = Math.min(TUNE.preMaxDays, ((Number(e.pre?.[id]) || 0) / 10) * TUNE.preDaysPer10);
  const days = Math.max(0, now - e.got) / DAY + boostDays(studyMinutes(p, eggSubject(p, id, subjects), e.got)) + pre;
  return Math.min(1, days / TUNE.eggDays);
}
export function seedProgress(p, id, now = Date.now(), subjects) {
  const e = eggsOf(p);
  const s = e?.seed?.[id];
  if (!s || num(s.at) == null) return 0;
  if (e.built?.[id]) return 1;
  const days = Math.max(0, now - s.at) / DAY + boostDays(studyMinutes(p, eggSubject(p, id, subjects), s.at));
  return Math.min(1, days / TUNE.seedDays);
}
// いま あたために 効いている 勉強の分（反応を 出すかを 見る）。たまごの間は もらってから、たねの間は うえてから
export function warmMinutes(p, id, subjects) {
  const e = eggsOf(p);
  if (!e || !byId.has(id)) return 0;
  const from = e.seed?.[id] ? e.seed[id].at : e.got;
  return studyMinutes(p, eggSubject(p, id, subjects), from);
}

// ---- いまの すがた ----
// phase: 'egg'（たまご）→ 'hatched'（生まれた。たねは まだ うえていない）→ 'seed'（そだち中）→ 'built'（できた）
// stage: たまご 'sleep' | 'wiggle' | 'crack' | 'ready'、たね 'seed' | 'sprout' | 'bud' | 'ready'
export function stateOf(p, id, now = Date.now(), subjects) {
  const e = eggsOf(p);
  if (!e || !byId.has(id)) return null;
  if (e.built?.[id]) return { phase: 'built', stage: 'built', k: 1 };
  if (e.seed?.[id]) {
    const k = seedProgress(p, id, now, subjects);
    return { phase: 'seed', stage: k >= 1 ? 'ready' : k >= 0.6 ? 'bud' : k >= 0.25 ? 'sprout' : 'seed', k };
  }
  if (e.hatch?.[id]) return { phase: 'hatched', stage: 'hatched', k: 1 };
  const k = eggProgress(p, id, now, subjects);
  return { phase: 'egg', stage: k >= 1 ? 'ready' : k >= 0.62 ? 'crack' : k >= 0.3 ? 'wiggle' : 'sleep', k };
}

// のこりを 数字で 出さない ことば（ピヨ先生ふう・20字まで）
const WORDS = {
  sleep: 'すやすや ねむってる',
  wiggle: 'ときどき うごくよ',
  crack: 'もうすぐかも…',
  ready: 'うまれそう！',
  hatched: 'たねを うえよう',
  seed: 'つちの中で ねむってる',
  sprout: 'めが でたよ！',
  bud: 'つぼみが ふくらんできた',
  seedReady: 'できあがりそう！',
  built: 'できあがり！',
};
export function wordsOf(st) {
  if (!st) return '';
  if (st.phase === 'seed' && st.stage === 'ready') return WORDS.seedReady;
  return WORDS[st.stage] || '';
}

// やることが あるか（頭の上に「！」を出す）: 生まれそうな たまご・たねを うえていない なかま・できあがりそうな たね
export const needsTap = (st) => !!st && (st.stage === 'ready' || st.phase === 'hatched');

// ---- 孵化・たね・できあがり ----
// 孵化させる（すすみが 1 に なっていれば）。ひらいた しくみの キーを かえす（だめなら null）
export function hatchEgg(p, id, now = Date.now(), subjects) {
  const e = eggsOf(p);
  if (!e || !byId.has(id) || e.hatch?.[id]) return null;
  if (eggProgress(p, id, now, subjects) < 1) return null;
  const before = new Set(EGGS.flatMap((d) => (e.hatch?.[d.id] ? UNLOCKS[d.id] || [] : [])));
  own(p).hatch[id] = now;
  const fresh = (UNLOCKS[id] || []).filter((k) => !before.has(k));
  fresh.forEach((k) => featureListeners.forEach((fn) => { try { fn(k, p); } catch (_) { /* しくみがわの まちがいで 孵化を とめない */ } }));
  return fresh;
}
export const hatchedCount = (p) => { const e = eggsOf(p); return e ? EGGS.filter((d) => e.hatch?.[d.id]).length : 0; };

const round2 = (v) => Math.round(v * 100) / 100;
export function plantSeed(p, id, x, z, rot = 0, now = Date.now()) {
  const e = eggsOf(p);
  if (!e || !e.hatch?.[id] || e.seed?.[id] || ![x, z, rot].every(Number.isFinite)) return false;
  own(p).seed[id] = { x: round2(x), z: round2(z), rot: round2(rot), at: now };
  return true;
}
export function finishBuilding(p, id, now = Date.now(), subjects) {
  const e = eggsOf(p);
  if (!e || !e.seed?.[id] || e.built?.[id]) return false;
  if (seedProgress(p, id, now, subjects) < 1) return false;
  own(p).built[id] = now;
  pruneWarm(p);
  return true;
}
// 建物の 場所を かえる（あとの「うごかす」用）
export function moveBuilding(p, id, x, z, rot = 0) {
  const e = eggsOf(p);
  if (!e?.seed?.[id] || ![x, z, rot].every(Number.isFinite)) return false;
  Object.assign(own(p).seed[id], { x: round2(x), z: round2(z), rot: round2(rot) });
  return true;
}
// うえた たね・建物の 場所 [{ id, x, z, rot }]
export function plantedSpots(p) {
  const e = eggsOf(p);
  if (!e) return [];
  return EGGS.filter((d) => plain(e.seed?.[d.id])).map((d) => ({ id: d.id, x: Number(e.seed[d.id].x) || 0, z: Number(e.seed[d.id].z) || 0, rot: Number(e.seed[d.id].rot) || 0 }));
}

// ---- タイマー いがいの 勉強（きょうのクエスト など）を あたために 入れる ----
// key は 同じ勉強を 2回 数えないための 名前（例: `quest:2026-11-15:kanji`）
export function addWarmth(p, subject, min, key, now = Date.now()) {
  if (!hasEggs(p) || typeof subject !== 'string' || !subject || !(min > 0)) return false;
  const e = own(p);
  const id = String(key || `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  if (e.warm.some((w) => w && w.id === id)) return false;
  e.warm.push({ id, at: now, subject, min: Math.round(min * 10) / 10 });
  if (e.warm.length > TUNE.warmMax) e.warm.splice(0, e.warm.length - TUNE.warmMax);
  return true;
}
// たまごも 建物も ぜんぶ おわった 教科の 記録は もう いらない
function pruneWarm(p) {
  const e = own(p);
  // 算数の 記録は 銀行の そだちに つかうので のこす
  const done = new Set(EGGS.filter((d) => e.built[d.id] && d.id !== 'sansu').map((d) => eggSubject(p, d.id)));
  const live = new Set(EGGS.filter((d) => !e.built[d.id]).map((d) => eggSubject(p, d.id)));
  e.warm = e.warm.filter((w) => !(done.has(w?.subject) && !live.has(w?.subject)));
}

// クエストの パーツ → 教科（kanji / english / math と、範囲の 教科）
export function questSubject(part) {
  if (!part) return null;
  const core = part.core;
  if (core === 'kanji') return '国語';
  if (core === 'english') return '英語';
  if (core === 'math') return '算数・数学';
  return typeof part.x?.subject === 'string' ? part.x.subject : null;
}
// '算数・数学' は 子どもの 教科名に あわせる（教科の名前を かえていない子は そのまま）
export function questSubjectFor(p, part, subjects) {
  const s = questSubject(part);
  if (!s) return null;
  if (!Array.isArray(subjects) || subjects.includes(s)) return s;
  const egg = EGGS.find((d) => d.subject === s);
  return egg ? eggSubject(p, egg.id, subjects) : s;
}

// ---- まんなかの す（巣）の 場所。town.js が 草や 木を よけるのに 使う ----
export const NEST = { x: -0.9, z: -3.5, r: 1.2 };
// たねを うえられる はんい
export const PLANT = { r: 1.5, max: 23 };
