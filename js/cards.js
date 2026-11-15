// まちがえた問題を まとめて 見て、A4 片面に 印刷する「チェック表」。
// 集める場所: やりなおし(p.review)・見直しワーク(p.coach.misses)・きょうのやりなおし(p.retry)。
// 4列（問題|答え|問題|答え）。上から じゅんに、答えの列を 紙で かくして 答えあわせ（家庭用プリンターの 片面印刷）。
import { h } from './ui.js';
import { icon } from './icons.js';
import { isAdult } from './adult.js';
import { currentProfile, save, today } from './store.js';

const keyOf = (q) => [q.kind, q.prompt, q.big || '', q.kind === 'choice' ? q.options?.[q.answer] : q.answerText ?? q.answer].join('|');

// 答えの文字
export function answerOf(q) {
  if (q.kind === 'choice') return q.options?.[q.answer] ?? '';
  if (q.kind === 'write') return q.answerText ?? '';
  return String(q.answer ?? '');
}

// ---- のこしておく もの（p.cards）----------------------------------------------
// miss: まちがえて まだ なおせていない問題 / todo: 解ききれなかった（まだ答えていない）問題
// 問題を 解いている あいだに すぐ のこす（途中で アプリが とじても 消えない）。正解したら はずす。
function box(p) {
  if (!p.cards || typeof p.cards !== 'object') p.cards = {};
  if (!Array.isArray(p.cards.miss)) p.cards.miss = [];
  if (!Array.isArray(p.cards.todo)) p.cards.todo = [];
  return p.cards;
}
const pack = (q) => JSON.parse(JSON.stringify(q));
const ok = (q) => q && q.prompt && !(q.kind === 'number' && !Number.isFinite(Number(q.answer))) && answerOf(q);
function cardsProfile() { const p = currentProfile(); return p && !isAdult(p) ? p : null; }
export function stockWrong(q) {
  try {
    const p = cardsProfile(); if (!p || !ok(q)) return;
    const b = box(p), k = keyOf(q);
    if (b.fixed?.keys) b.fixed.keys = b.fixed.keys.filter((x) => x !== k);
    b.todo = b.todo.filter((m) => keyOf(m.q) !== k);
    const f = b.miss.find((m) => keyOf(m.q) === k);
    if (f) { f.n = (f.n || 1) + 1; f.at = today(); } else b.miss.push({ q: pack(q), n: 1, at: today() });
    if (b.miss.length > 300) b.miss.splice(0, b.miss.length - 300);
    save();
  } catch (e) { console.log('cards', e); }
}
export function stockSolved(q) {
  try {
    const p = cardsProfile(); if (!p || !q) return;
    const b = box(p), k = keyOf(q);
    if (!b.fixed || b.fixed.day !== today()) b.fixed = { day: today(), keys: [] };
    if (!b.fixed.keys.includes(k)) { b.fixed.keys.push(k); if (b.fixed.keys.length > 400) b.fixed.keys.shift(); }
    b.miss = b.miss.filter((m) => keyOf(m.q) !== k);
    b.todo = b.todo.filter((m) => keyOf(m.q) !== k);
    save();
  } catch (e) { console.log('cards', e); }
}
export function stockRest(qs) {
  try {
    const p = cardsProfile(); if (!p) return;
    const b = box(p), seen = new Set([...b.miss, ...b.todo].map((m) => keyOf(m.q)));
    qs.filter(ok).forEach((q) => { if (!seen.has(keyOf(q)) && seen.add(keyOf(q))) b.todo.push({ q: pack(q), n: 0, at: today() }); });
    if (b.todo.length > 300) b.todo.splice(0, b.todo.length - 300);
    save();
  } catch (e) { console.log('cards', e); }
}

// 印刷に 出す 問題: まちがえた(なおせていない) → 解ききれなかった の じゅん。きょうの やりなおしの のこりも ふくむ
export function collectMisses(p) {
  const b = box(p), map = new Map();
  const add = (q, n, at) => { if (ok(q) && !map.has(keyOf(q))) map.set(keyOf(q), { q, n, at: at || '' }); };
  [...b.miss].sort((x, y) => (y.at || '').localeCompare(x.at || '')).forEach((m) => add(m.q, m.n || 1, m.at));
  if (p.retry?.day === today() && Array.isArray(p.retry.qs)) p.retry.qs.forEach((q) => add(q, 1, p.retry.day));
  // きょう(公開まえ)の まちがい: やりなおし(p.review)・見直しワーク(p.coach.misses) から。きょう なおせた ものは のぞく
  const fixed = new Set(b.fixed?.day === today() ? b.fixed.keys : []);
  const old = (q) => !fixed.has(keyOf(q));
  (p.review || []).filter((i) => i.added === today()).forEach((i) => old(i.q) && add(i.q, i.misses || 1, i.added));
  (p.coach?.misses || []).filter((m) => m.at === today()).forEach((m) => old(m.q) && add(m.q, m.n || 1, m.at));
  b.todo.forEach((m) => add(m.q, 0, m.at));
  return [...map.values()];
}
export const missCount = (p) => (isAdult(p) ? 0 : collectMisses(p).length);

const ICON = ['ア', 'イ', 'ウ', 'エ', 'オ'];
const PAGE_MM = 260;   // 1ページの 1列に のせる 高さ(mm)。ヘッダー・余白を ひいた 目安（あまめに とる）
const PX = 96 / 25.4;   // 1mm = 何px

function cell(q, n) {
  const opts = q.kind === 'choice' ? (q.options || []).map((o, i) => `${ICON[i] || i + 1} ${o}`).join('　') : '';
  const ctx = typeof q.context === 'string' ? q.context : '';
  const ans = answerOf(q);
  return h('div', { class: 'ms-r' },
    h('span', { class: 'ms-no' }, n),
    h('div', { class: 'ms-q' },
      h('p', {}, q.prompt, q.big ? h('b', {}, ` ${q.big}`) : null),
      ctx ? h('small', {}, ctx) : null,
      opts ? h('small', {}, opts) : null),
    h('div', { class: 'ms-a' }, ans, q.kind === 'write' && q.big ? h('small', {}, q.big) : null));
}

// 行の 高さは 文字が 折り返した あとの 本当の 高さを はかる（きれて しまわないように）。
// 1まい(A4 片面)に 左の 組（問題|答え）→ 右の 組 の じゅんで つめる。ぜんぶ 上から 下へ 番号どおり
export function buildSheet(cards, title) {
  const rows = cards.map((c, i) => cell(c.q, i + 1));
  const meas = h('div', { class: 'ms-page ms-meas' }, h('div', { class: 'ms-2' }, h('div', { class: 'ms-grp' }, h('div', { class: 'ms-body' }, rows))));
  document.body.append(meas);
  const hs = rows.map((r) => r.getBoundingClientRect().height / PX);
  meas.remove();
  const pages = [];
  let cur = null, col = 0, used = 0;
  const newPage = () => { cur = [[], []]; pages.push(cur); col = 0; used = 0; };
  newPage();
  rows.forEach((r, i) => {
    if (used + hs[i] > PAGE_MM && used > 0) {
      if (col === 0) { col = 1; used = 0; } else { newPage(); }
    }
    cur[col].push(r);
    used += hs[i];
  });
  return pages.map((pg, k) => h('section', { class: 'ms-page' },
    h('div', { class: 'ms-head' }, h('b', {}, `${title} ${k + 1}/${pages.length}`), h('span', {}, 'なまえ：　　　　　　　　日づけ：　　月　　日')),
    h('div', { class: 'ms-2' }, pg.map((colRows) => h('div', { class: 'ms-grp' },
      h('div', { class: 'ms-cols' }, h('span', {}), h('span', {}, '問題'), h('span', {}, '答え')),
      h('div', { class: 'ms-body' }, colRows))))));
}

export function openCards(p) {
  const all = collectMisses(p);
  let subj = '';
  const layer = h('div', { class: 'ms-layer', role: 'dialog', 'aria-label': 'まちがえた問題' });
  const close = () => { layer.remove(); document.body.classList.remove('ms-open'); document.documentElement.classList.remove('ms-open'); };
  const body = h('div', { class: 'ms-pages' });
  const top = h('div', { class: 'ms-top' });

  function draw() {
    const subjects = [...new Set(all.map((c) => c.q.subject).filter(Boolean))];
    const cards = all.filter((c) => !subj || c.q.subject === subj).slice(0, 150);
    top.replaceChildren(
      h('div', { class: 'ms-bar' }, h('b', {}, 'まちがえた問題'), h('button', { class: 'close', 'aria-label': 'とじる', onclick: close }, '×')),
      h('div', { class: 'ms-chips' },
        h('button', { class: `chip ${subj ? '' : 'on'}`, onclick: () => { subj = ''; draw(); } }, `ぜんぶ ${all.length}`),
        subjects.map((s) => h('button', { class: `chip ${subj === s ? 'on' : ''}`, onclick: () => { subj = s; draw(); } }, `${s} ${all.filter((c) => c.q.subject === s).length}`))),
      h('p', { class: 'hint' }, '下の プレビューを 見て 印刷してね。まんなかの 線で 半分に おって、答えの 列を カードで かくして 上から じゅんに。教科は 上で えらべるよ'),
      h('button', { class: 'btn primary', disabled: !cards.length, onclick: () => {
        window.print();   // 印刷用の ようすは、この画面が ひらいている あいだ いつも 効く（スマホは 印刷の じゅんびが あとから 始まるため）
      } }, icon('printer'), ` 印刷する（${cards.length}もん）`));
    body.replaceChildren(...(cards.length ? buildSheet(cards, `まちがえた問題${subj ? `（${subj}）` : ''}`) : [h('p', { class: 'empty' }, 'まちがえた問題は まだ ないよ')]));
  }
  layer.append(top, body);
  document.body.append(layer);
  document.body.classList.add('ms-open'); document.documentElement.classList.add('ms-open');
  draw();
}

export function cardsButton(p) {
  const n = missCount(p);
  if (!n) return null;
  return h('button', { class: 'btn', onclick: () => openCards(p) }, icon('printer'), ` まちがえた・のこりの問題 ${n}もんを 印刷`);
}
