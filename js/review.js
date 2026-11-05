// やりなおし（ふりかえり）クエスト。
// クエスト・ドリル・小テストでまちがえた問題を覚えておき、
// 次の日 → 3日後 → 1週間後 と間をあけてもう一度出す（間をあけるほど忘れにくくなる）。
// 3回つづけて正解したら「おぼえた！」で卒業。まちがえたら次の日からやりなおし。
import { today, toISO, save } from './store.js';
import { runQuestions } from './runner.js';

const GAPS = [1, 3, 7];       // 何日あけて出すか（だんかいごと）
const MAX_ITEMS = 60;         // 覚えておく数の上限
export const REVIEW_MAX = 5;  // 1回で出す数
export const REVIEW_PER_CORRECT = 8;
export const REVIEW_CLEAR = 15;

const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISO(d); };
const keyOf = (q) => [q.kind, q.prompt, q.big, q.kind === 'choice' ? q.options?.[q.answer] : q.answerText ?? q.answer].join('|');
// 保存するのは問題の中身だけ（関数などは入れない）
const pack = (q) => JSON.parse(JSON.stringify(q));

function list(p) { if (!Array.isArray(p.review)) p.review = []; return p.review; }

// クエストなどの結果から、まちがえた問題を入れる（正解した やりなおし問題は先へ進める）
export function recordResults(p, results = [], from = '') {
  const items = list(p);
  results.forEach(({ q, ok }) => {
    if (!q || q.kind === 'number' && !Number.isFinite(Number(q.answer))) return;
    const key = keyOf(q);
    const found = items.find((i) => i.key === key);
    if (!ok) {
      if (found) { found.stage = 0; found.due = addDays(GAPS[0]); found.misses = (found.misses || 1) + 1; }
      else items.push({ key, q: pack(q), from, stage: 0, due: addDays(GAPS[0]), misses: 1, added: today() });
    }
  });
  if (items.length > MAX_ITEMS) items.splice(0, items.length - MAX_ITEMS);
  save();
}

export function dueReview(p) {
  const t = today();
  return list(p).filter((i) => i.due <= t);
}

// デイリーに まぜる やりなおし（作戦会議で足した範囲の 一問一答だけ。きのう まちがえたもの など）
export function dueForTopics(p, topics) {
  const set = new Set(topics);
  return dueReview(p).filter((i) => i.q?.topic && set.has(i.q.topic)).map((i) => i.q);
}

// やりなおしの結果を すすめる（正解→つぎの だんかい、3回で卒業。まちがい→あしたから やりなおし）。卒業した数を返す
export function settleReview(p, results) {
  const t = today();
  let mastered = 0;
  results.forEach(({ q, ok }) => {
    const item = list(p).find((i) => i.key === keyOf(q));
    if (!item || item.due > t) return;
    if (ok) {
      item.stage += 1;
      if (item.stage >= GAPS.length) { p.review = list(p).filter((i) => i !== item); mastered += 1; }
      else item.due = addDays(GAPS[item.stage]);
    } else {
      item.stage = 0;
      item.due = addDays(GAPS[0]);
      item.misses = (item.misses || 1) + 1;
    }
  });
  p.reviewMastered = (p.reviewMastered || 0) + mastered;
  return mastered;
}

export function reviewStats(p) {
  const items = list(p);
  return { waiting: items.length, due: dueReview(p).length, mastered: p.reviewMastered || 0 };
}

// やりなおしをはじめる。deps.gain でポイント
export function startReview(p, deps) {
  const todo = dueReview(p).slice(0, REVIEW_MAX);
  if (!todo.length) return false;
  runQuestions('やりなおしクエスト', todo.map((i) => i.q), (score, total, results) => {
    const mastered = settleReview(p, results);
    const pts = score * REVIEW_PER_CORRECT + (score === total ? REVIEW_CLEAR : 0);
    if (pts > 0) deps.gain(p, pts, 'やりなおしクエスト'); else save();
    deps.render();
    return `+${pts} ポイント！${mastered ? `（${mastered}もん おぼえた！）` : ''}`;
  });
  return true;
}
