// テスト・宿題・目標を、毎日の「きょうやること」に割り振る。
// 1つの予定は「ステップ」の列。のこりのステップを、しめきりまでの日数で割って
// きょうの分を決める。サボった日があっても、次の日に自動で配り直される。
import { today, daysUntil } from './store.js';

// 「p.40〜52」「40-52ページ」「P12~15」などからページの範囲をとり出す
const RANGE = /(?:p\.?\s*(\d{1,4})\s*[〜~～\-－ー–]\s*p?\.?\s*(\d{1,4}))|(?:(\d{1,4})\s*[〜~～\-－ー–]\s*(\d{1,4})\s*(?:ページ|頁|p))/gi;

export function parsePages(text) {
  const out = [];
  for (const m of String(text || '').matchAll(RANGE)) {
    const a = Number(m[1] ?? m[3]);
    const b = Number(m[2] ?? m[4]);
    if (a > 0 && b >= a && b - a < 300) out.push([a, b]);
  }
  return out;
}

const pageLabel = (a, b) => (a === b ? `p.${a}` : `p.${a}〜${b}`);

// ページの範囲を、だいたい size ページずつに分ける
function chunkPages(ranges, size) {
  const chunks = [];
  for (const [a, b] of ranges) {
    const n = b - a + 1;
    const parts = Math.max(1, Math.round(n / size));
    const per = Math.ceil(n / parts);
    for (let s = a; s <= b; s += per) chunks.push([s, Math.min(b, s + per - 1)]);
  }
  return chunks;
}

export function buildSteps(item) {
  if (item.type === 'goal') {
    // 目標は毎日コツコツ。しめきりまで1日1回
    // 入れた日からしめきりまでの日数でステップ数を決める（日がたっても数がかわらないように）
    const from = item.createdOn ? daysUntil(item.createdOn) : 0;
    const days = Math.max(1, Math.min(60, daysUntil(item.date) - from + 1));
    return Array.from({ length: days }, () => `「${item.title}」を${item.minutes || 15}分`);
  }
  if (item.type === 'test') {
    const pages = parsePages(`${item.range} ${item.title}`);
    const learn = pages.length
      ? chunkPages(pages, 4).map(([a, b]) => `${pageLabel(a, b)} を読んで問題をとく`)
      : ['はんいをざっと読む', '大事なところをノートにまとめる', '問題をとく'];
    return [...learn, 'まちがえた問題をとき直す', 'さいごにぜんぶ見直す'];
  }
  // 宿題は1ページずつ（マス目に1ページ1マスでスタンプをおす）
  const pages = parsePages(`${item.title} ${item.range}`);
  if (pages.length) return homeworkPages(item).map((n) => `p.${n} をやる`);
  return [`${item.title} をおわらせる`];
}

// 宿題のページ番号の列（p.102〜107 → [102,103,...,107]）
export function homeworkPages(item) {
  const out = [];
  for (const [a, b] of parsePages(`${item.title} ${item.range}`)) for (let n = a; n <= b; n += 1) out.push(n);
  return out;
}

// むかしの宿題は3ページで1ステップだった。ページ単位に数え直す（1回だけ）
export function migrateHomework(item) {
  if (item.type !== 'homework' || item.perPage) return false;
  item.perPage = true;
  const ranges = parsePages(`${item.title} ${item.range}`);
  if (!ranges.length || !item.stepsDone) return true;
  const sizes = chunkPages(ranges, 3).map(([a, b]) => b - a + 1);
  const pagesFor = (n) => sizes.slice(0, n).reduce((x, y) => x + y, 0);
  const total = sizes.length;
  const doneSteps = Math.min(total, item.stepsDone);
  // 日ごとの記録も、古い順にページ数へ
  const log = item.doneLog || {};
  const days = Object.keys(log).sort();
  let before = doneSteps - days.reduce((n, d) => n + (log[d] || 0), 0);
  const next = {};
  for (const d of days) {
    const after = Math.min(total, Math.max(0, before) + (log[d] || 0));
    next[d] = pagesFor(after) - pagesFor(Math.max(0, before));
    before = after;
  }
  item.stepsDone = pagesFor(doneSteps);
  item.doneLog = next;
  return true;
}

// いそぎの宿題（きょう・あした提出、または すぎている）。ページのマス目に使う
export function urgentHomework(items) {
  return items
    .filter((i) => i.type === 'homework' && !i.done && daysUntil(i.date) <= 1)
    .map((item) => {
      const pages = homeworkPages(item);
      const steps = buildSteps(item);
      const done = Math.min(item.stepsDone || 0, steps.length);
      const doneToday = (item.doneLog || {})[today()] || 0;
      return { item, pages, total: steps.length, done, doneToday, days: daysUntil(item.date) };
    })
    // ぜんぶできても「だした！」を押すまでは出しておく（出しわすれ防止）
    .sort((a, b) => a.item.date.localeCompare(b.item.date));
}

// しめきりまでに使える日数（きょうをふくむ）。テストと宿題は前の日までに終える
function daysLeft(item) {
  const d = daysUntil(item.date);
  return item.type === 'goal' ? d + 1 : d;
}

// きょうの分。{ item, steps: [{ index, label, done }] } をかえす
export function todayPlan(item) {
  if (item.done) return null;
  const steps = buildSteps(item);
  const done = Math.min(item.stepsDone || 0, steps.length);
  const doneToday = (item.doneLog || {})[today()] || 0;
  const startIdx = Math.max(0, done - doneToday);
  const remainingAtStart = steps.length - startIdx;
  if (remainingAtStart <= 0) return null;
  const left = daysLeft(item);
  // テストの日・目標の日をすぎたら出さない。宿題はおくれていても、のこりを全部きょうに
  if (left <= 0 && item.type !== 'homework') return null;
  const quota = Math.ceil(remainingAtStart / Math.max(1, left));
  const list = [];
  for (let i = startIdx; i < Math.min(steps.length, startIdx + quota); i += 1) {
    list.push({ index: i, label: steps[i], done: i < done });
  }
  return { item, steps: list, total: steps.length, done };
}

// 全部の予定から、きょうやることをしめきりの近い順に
export function todayTasks(items) {
  return items
    .filter((i) => !i.done)
    .map(todayPlan)
    .filter(Boolean)
    .sort((a, b) => a.item.date.localeCompare(b.item.date));
}

// ステップを1つ終えた（チェックした）
export function completeStep(item) {
  const key = today();
  item.stepsDone = (item.stepsDone || 0) + 1;
  item.doneLog = { ...(item.doneLog || {}), [key]: ((item.doneLog || {})[key] || 0) + 1 };
}

// チェックを1つもどす（きょうの分だけ）
export function undoStep(item) {
  const key = today();
  const n = (item.doneLog || {})[key] || 0;
  if (n <= 0) return false;
  item.stepsDone = Math.max(0, (item.stepsDone || 0) - 1);
  item.doneLog = { ...item.doneLog, [key]: n - 1 };
  return true;
}
