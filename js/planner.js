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
    return Array.from({ length: days }, () => `「${item.title}」を15分`);
  }
  if (item.type === 'test') {
    const pages = parsePages(`${item.range} ${item.title}`);
    const learn = pages.length
      ? chunkPages(pages, 4).map(([a, b]) => `${pageLabel(a, b)} を読んで問題をとく`)
      : ['はんいをざっと読む', '大事なところをノートにまとめる', '問題をとく'];
    return [...learn, 'まちがえた問題をとき直す', 'さいごにぜんぶ見直す'];
  }
  // 宿題
  const pages = parsePages(`${item.title} ${item.range}`);
  if (pages.length) return chunkPages(pages, 3).map(([a, b]) => `${pageLabel(a, b)} をやる`);
  return [`${item.title} をおわらせる`];
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
