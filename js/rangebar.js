// テスト範囲の すすみバー。いちばん近いテスト（同じ週のテストはまとめて）の範囲のうち、
// どこまで できたかを バーで見せる。タップで 教科ごとの バーと、ステップの チェック一覧。
import { h, daysLabel } from './ui.js';
import { daysUntil } from './store.js';
import { buildSteps } from './planner.js';
import { subjectColor } from './subjects.js';
import { icon } from './icons.js';
import { isAdult } from './adult.js';

const pct = (done, total) => (total ? Math.round((done / total) * 100) : 0);

// 1つのテストの すすみ
export function itemProgress(item) {
  const steps = buildSteps(item);
  const done = Math.min(item.stepsDone || 0, steps.length);
  return { item, steps, done, total: steps.length };
}

// いちばん近いテストと、その日から6日いないの テスト（期末テストの3日間など）をまとめる
export function nextTestGroup(p) {
  const tests = p.items
    .filter((i) => i.type === 'test' && !i.done && daysUntil(i.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.subject).localeCompare(String(b.subject)));
  if (!tests.length) return null;
  const first = daysUntil(tests[0].date);
  const list = tests.filter((i) => daysUntil(i.date) - first <= 6).map(itemProgress);
  const done = list.reduce((n, x) => n + x.done, 0);
  const total = list.reduce((n, x) => n + x.total, 0);
  return { title: groupTitle(p, list.map((x) => x.item.title)), days: first, list, done, total };
}

// 「2学期末 数学」「2学期末 理科」→「2学期末テスト」
function groupTitle(p, titles) {
  const word = isAdult(p) ? '試験' : 'テスト';
  if (titles.length === 1) return titles[0];
  let pre = titles[0];
  for (const t of titles) while (!t.startsWith(pre)) pre = pre.slice(0, -1);
  pre = pre.trim().replace(/[・、/／-]$/, '').trim();
  if (pre.length < 2) return `${word}の はんい`;
  return /テスト|試験|検定$/.test(pre) ? pre : `${pre}${word}`;
}

// バー（色つき）。done/total と 色
export function rangeBar(done, total, color) {
  return h('span', { class: 'rbar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': done },
    h('i', { style: `width:${pct(done, total)}%${color ? `;background:${color}` : ''}` }));
}

// ホームの「きょうのカード」にのせる 1行
export function homeRangeBar(p, deps) {
  const g = nextTestGroup(p);
  if (!g || !g.total) return null;
  const all = g.done >= g.total;
  return h('button', { class: `range-home ${all ? 'clear' : ''}`, onclick: () => openRangeSheet(p, deps) },
    h('span', { class: 'range-top' },
      icon('target'),
      h('b', {}, g.title),
      h('small', {}, daysLabel(g.days)),
      h('span', { class: 'range-pct' }, all ? 'ぜんぶ できた！' : `${pct(g.done, g.total)}%`)),
    rangeBar(g.done, g.total));
}

// やることタブの カードに入れる バー
export function itemRangeBar(p, item) {
  const x = itemProgress(item);
  if (!x.total) return null;
  return h('div', { class: 'range-item' },
    rangeBar(x.done, x.total, subjectColor(p, item.subject)),
    h('small', {}, x.done >= x.total ? 'ぜんぶ できた！' : `${x.done} / ${x.total}`));
}

// くわしく: 教科ごとの バーと、ステップの チェック一覧（どこにでも おける要素をかえす）
// deps.finish(item) があれば テストの日に「おわった！」ボタン。deps.startStep(item, label) があれば「つぎを タイマーで はじめる」ボタンを出す。deps.onStart はその前に呼ぶ
export function rangePanel(p, deps = {}) {
  const g = nextTestGroup(p);
  if (!g) return null;
  const rows = g.list.map((x) => {
    const next = x.steps[x.done];
    const color = subjectColor(p, x.item.subject);
    return h('li', {},
      h('details', {},
        h('summary', {},
          h('span', { class: 'prog-head' },
            h('span', { class: 'chip soft' }, x.item.subject),
            h('b', {}, x.item.title),
            h('small', {}, daysLabel(daysUntil(x.item.date)))),
          h('span', { class: 'q-prog' }, rangeBar(x.done, x.total, color), h('small', {}, x.done >= x.total ? 'ぜんぶ！' : `${x.done} / ${x.total}`)),
          next ? h('small', { class: 'range-next' }, `つぎ: ${next}`) : null),
        h('ol', { class: 'range-steps' }, x.steps.map((s, i) => h('li', { class: i < x.done ? 'on' : i === x.done ? 'now' : '' },
          h('span', { class: 'mark', style: i < x.done ? `background:${color};border-color:${color}` : '' }, i < x.done ? icon('check') : String(i + 1)),
          h('span', {}, s)))),
        deps.finish && daysUntil(x.item.date) <= 0 ? h('button', { class: 'btn small primary', onclick: () => deps.finish(x.item) }, 'おわった！') : null,
        next && deps.startStep ? h('button', { class: 'btn small', onclick: () => { deps.onStart?.(); deps.startStep(x.item, next); } },
          icon('clock-3'), ' つぎを タイマーで はじめる') : null));
  });
  return h('div', { class: 'range-panel' },
    h('p', { class: 'range-name' }, icon('target'), ` ${g.title}`),
    h('div', { class: 'range-big' },
      h('b', {}, `${pct(g.done, g.total)}%`),
      h('small', {}, `${daysLabel(g.days)}・${g.done} / ${g.total} できた`)),
    rangeBar(g.done, g.total),
    rangeNeedsRow(p, deps),
    h('ul', { class: 'prog-items' }, rows));
}

// 範囲が まだ とどいていない テスト（2週間いない）。「テスト範囲を 入れてね」と 教える
// - 範囲が 空 → 範囲を 入れてね
// - 漢字の範囲が ページ番号だけで 写真が ない → 漢字の ページを 見せてね（中身が わからないと 範囲外の 漢字が 出る）
const NEED_DAYS = 14;
const hasPhotos = (p, i) => (p.photos || []).some((m) => m.folder === i.id)
  || (p.coach?.daily?.extra || []).some((x) => (x.photos || []).length && (x.until === i.date || x.subject === i.subject) && /漢字|国語/.test(`${x.subject}${x.topic}`));
export function rangeNeeds(p) {
  if (isAdult(p)) return [];
  return (p.items || []).filter((i) => i.type === 'test' && !i.done && daysUntil(i.date) >= 0 && daysUntil(i.date) <= NEED_DAYS)
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((i) => {
      const name = i.subject && i.subject !== 'その他' ? i.subject : i.title;
      if (!String(i.range || '').trim()) return [{ item: i, kind: 'range', text: `${name}の テスト範囲を 入れてね`, ask: `${name}の テスト範囲を 入れたい` }];
      if (/国語|漢字/.test(`${i.subject}${i.title}`) && /漢字/.test(i.range) && /[PpＰｐ]\s*\d|ページ/.test(i.range) && !hasPhotos(p, i)) {
        return [{ item: i, kind: 'photo', text: `${name}の 漢字の ページを 写真で 見せてね`, ask: `${name}の 漢字の範囲の ページの 写真を 見せるね` }];
      }
      return [];
    });
}
// deps.openPlan(ask) で 作戦会議を ひらく
export function rangeNeedsRow(p, deps = {}) {
  const needs = rangeNeeds(p);
  if (!needs.length || !deps.openPlan) return null;
  return h('div', { class: 'range-needs' }, needs.slice(0, 4).map((n) => h('button', { type: 'button', class: `range-need ${n.kind}`, onclick: () => deps.openPlan(n.ask) },
    icon(n.kind === 'photo' ? 'camera' : 'pencil'), h('span', {}, n.text))));
}

export function openRangeSheet(p, deps = {}) {
  const close = () => el.remove();
  const body = rangePanel(p, { ...deps, onStart: close });
  if (!body) return;
  const el = h('div', { class: 'sheet', onclick: (e) => { if (e.target === el) close(); } },
    h('div', { class: 'sheet-card prog-card range-card' }, body, h('button', { class: 'link', onclick: close }, 'とじる')));
  document.body.append(el);
}
