// 積み上がりを見せるための計算: レベル（けいけんち）、れんぞく日数、1週間のスタンプ。
import { today, toISO } from './store.js';

// レベル n から n+1 に上がるのに必要なけいけんち（もとの曲線。Lv9まではどの学年もこれ）
const baseNeed = (lv) => 60 + (lv - 1) * 30;

// 学年ごとの むずかしさ（フミオさん 2026-11-05「中2はレベル10から上がりにくく」）。
// from のレベルから、1つ上がるごとに 必要なけいけんちが step ずつ ふえる（0.25 なら Lv10で1.25倍、Lv13で2倍）。
// 学年の id（js/store.js の GRADES）で決める。ここにない学年は もとの曲線のまま。
export const CURVES = {
  j1: { from: 10, step: 0.25 },
  j2: { from: 10, step: 0.25 },
  j3: { from: 10, step: 0.25 },
};

// grade は学年の id（p.grade）
export function needFor(lv, grade) {
  const c = CURVES[grade];
  const k = c && lv >= c.from ? 1 + (lv - c.from + 1) * c.step : 1;
  return Math.round((baseNeed(lv) * k) / 10) * 10;
}

function walk(lv, rest, need) {
  while (rest >= need(lv)) { rest -= need(lv); lv += 1; }
  return { lv, into: rest, need: need(lv), left: need(lv) - rest };
}

// p をわたすと、その学年の曲線で数える。
// いまのレベルが下がらないように、そのレベルと はじまりの けいけんち・学年を p.lvKeep に とっておき、
// そこから先だけ 学年の曲線で数える。学年をかえたときも、その時点のレベルを とっておいて から先だけ かえる。
function fromKeep(xp, k) {
  if (xp < k.base) return walk(1, xp, baseNeed); // とりけしで へったとき
  return walk(k.lv, xp - k.base, (lv) => needFor(lv, k.g));
}

export function levelInfo(xp, p) {
  xp = Math.max(0, xp || 0);
  if (!p) return walk(1, xp, baseNeed);
  let k = p.lvKeep;
  if (!k || typeof k.lv !== 'number' || typeof k.base !== 'number') {
    const old = walk(1, xp, baseNeed);
    k = p.lvKeep = { lv: old.lv, base: xp - old.into, g: p.grade };
  } else if (k.g !== p.grade) {
    const now = fromKeep(xp, k);
    k = p.lvKeep = { lv: now.lv, base: xp - now.into, g: p.grade };
  }
  return fromKeep(xp, k);
}

export const levelOf = (p) => levelInfo(totalXp(p), p);

// 勉強した日（ポイントをもらった日）
export function activeDays(p) {
  if (!p.activeDays) {
    p.activeDays = {};
    (p.log || []).forEach((e) => { if (e.n > 0) p.activeDays[toISO(new Date(e.at))] = true; });
  }
  return p.activeDays;
}

export function totalXp(p) {
  if (typeof p.xp !== 'number') p.xp = (p.log || []).reduce((n, e) => n + Math.max(0, e.n), 0);
  return p.xp;
}

const shift = (iso, d) => { const [y, m, dd] = iso.split('-').map(Number); return toISO(new Date(y, m - 1, dd + d)); };

// れんぞく日数。きょうまだでも、きのうまで続いていれば数える（きょうやれば +1）
export function streak(p) {
  const days = activeDays(p);
  let d = today();
  const doneToday = !!days[d];
  if (!doneToday) d = shift(d, -1);
  let n = 0;
  while (days[d]) { n += 1; d = shift(d, -1); }
  return { n, doneToday };
}

// 今週（月〜日）のスタンプ
export function week(p) {
  const days = activeDays(p);
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const t = today();
  return ['月', '火', '水', '木', '金', '土', '日'].map((label, i) => {
    const iso = toISO(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
    return { label, done: !!days[iso], today: iso === t, future: iso > t };
  });
}
