// 積み上がりを見せるための計算: レベル（けいけんち）、れんぞく日数、1週間のスタンプ。
import { today, toISO } from './store.js';

// レベル n から n+1 に上がるのに必要なけいけんち
const need = (lv) => 60 + (lv - 1) * 30;

export function levelInfo(xp) {
  let lv = 1;
  let rest = Math.max(0, xp || 0);
  while (rest >= need(lv)) { rest -= need(lv); lv += 1; }
  return { lv, into: rest, need: need(lv), left: need(lv) - rest };
}

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
