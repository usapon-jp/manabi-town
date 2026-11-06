// きょうの ふりかえり: 自動まとめ ＋ スタンプ1タップ ＋ 一言（なくてもOK）
// きろくは p.diary = { 'YYYY-MM-DD': { stamp, note } }（30日分だけ のこす）。ポイントや れんぞくには 関係しない。
import { h } from './ui.js';
import { today, toISO, save } from './store.js';
import { icon } from './icons.js';
import { activeDays } from './progress.js';
import { minutesOn } from './timer.js';

export const STAMPS = [
  { id: 'great', ic: 'sparkles', label: 'がんばった' },
  { id: 'ok', ic: 'smile', label: 'ふつう' },
  { id: 'low', ic: 'cloud', label: 'やる気なし' },
  { id: 'rest', ic: 'moon', label: 'おやすみ' },
];
const KEEP = 30;

const days = (p) => (p.diary && typeof p.diary === 'object' ? p.diary : (p.diary = {}));
export const diaryOn = (p, key = today()) => days(p)[key] || null;

function put(p, patch) {
  const all = days(p);
  const cut = new Date(); cut.setDate(cut.getDate() - KEEP);
  Object.keys(all).forEach((k) => { if (k < toISO(cut)) delete all[k]; });
  const cur = all[today()] || {};
  const next = { ...cur, ...patch };
  if (!next.stamp && !next.note) delete all[today()]; else all[today()] = next;
  save();
}

// 自動まとめ（できた数・勉強の分・ポイント）
function summary({ done, total, minutes }) {
  const bits = [`${done} / ${total} こ できた`];
  if (minutes) bits.push(`勉強 ${minutes}分`);
  return bits.join('・');
}

// やることタブの 下に出す小さなカード
export function diaryCard(p, stats, { render, kids, plain }) {
  const cur = diaryOn(p) || {};
  const input = h('input', { class: 'mine-input', type: 'text', maxlength: 40, value: cur.note || '', placeholder: kids ? 'ひとこと（なくてもOK）' : 'ひとこと（なくてもOK）', enterkeyhint: 'done' });
  const saveNote = () => { if ((cur.note || '') !== input.value.trim()) { put(p, { note: input.value.trim().slice(0, 40) }); } };
  input.addEventListener('change', saveNote);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); input.blur(); } });
  return h('div', { class: `${plain ? '' : 'card quest '}diary-card` },
    h('h3', {}, icon('notebook-pen'), ' きょうの ふりかえり'),
    h('p', { class: 'diary-sum' }, summary(stats)),
    h('div', { class: 'stamps-pick' }, STAMPS.map((s) => h('button', {
      class: `stamp-btn ${cur.stamp === s.id ? 'on' : ''}`, 'aria-pressed': String(cur.stamp === s.id),
      onclick: () => { saveNote(); put(p, { stamp: cur.stamp === s.id ? '' : s.id }); render(); },
    }, icon(s.ic), h('small', {}, s.label)))),
    input);
}

const isoOf = (y, m, d) => toISO(new Date(y, m, d));
const gainOn = (p, key) => (p.log || []).reduce((n, e) => (e.n > 0 && toISO(new Date(e.at)) === key ? n + e.n : n), 0);

// 期間のまとめ（勉強した日・分・ポイント・スタンプ）
function totals(p, keys) {
  const act = activeDays(p);
  const stamps = {};
  keys.forEach((k) => { const s = diaryOn(p, k)?.stamp; if (s) stamps[s] = (stamps[s] || 0) + 1; });
  return {
    days: keys.filter((k) => act[k]).length,
    minutes: keys.reduce((n, k) => n + minutesOn(p, k), 0),
    points: keys.reduce((n, k) => n + gainOn(p, k), 0),
    stamps,
  };
}

function totalsRow(label, t) {
  return h('div', { class: 'cal-sum' },
    h('b', {}, label),
    h('span', {}, `${t.days}日 やった`), h('span', {}, `${t.minutes}分`), h('span', {}, `+${t.points}pt`),
    STAMPS.filter((s) => t.stamps[s.id]).map((s) => h('span', { class: 'cal-st' }, icon(s.ic), `×${t.stamps[s.id]}`)));
}

// ふりかえりの 小さな画面: きょうの スタンプ ＋ 月カレンダー
export function openDiary(p, statsFn, { render, kids }) {
  const now = new Date();
  let y = now.getFullYear(); let m = now.getMonth();
  let sel = today();
  const body = h('div', { class: 'diary-body' });
  const sheet = h('div', { class: 'sheet diary-sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card' }, body));
  const close = () => { sheet.remove(); render(); };
  const paint = () => {
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7;
    const n = new Date(y, m + 1, 0).getDate();
    const act = activeDays(p);
    const t = today();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(h('i', { class: 'cal-empty' }));
    for (let d = 1; d <= n; d++) {
      const key = isoOf(y, m, d);
      const e = diaryOn(p, key);
      const st = STAMPS.find((x) => x.id === e?.stamp);
      cells.push(h('button', { class: `cal-day ${key === t ? 'today' : ''} ${key === sel ? 'sel' : ''} ${act[key] ? 'act' : ''} ${key > t ? 'future' : ''}`, onclick: () => { sel = key; paint(); } },
        h('small', {}, String(d)), st ? icon(st.ic) : act[key] ? h('span', { class: 'cal-dot' }) : null));
    }
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const weekKeys = Array.from({ length: 7 }, (_, i) => toISO(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
    const monthKeys = Array.from({ length: n }, (_, i) => isoOf(y, m, i + 1));
    const e = diaryOn(p, sel) || {};
    const st = STAMPS.find((x) => x.id === e.stamp);
    body.replaceChildren(...[
      sel === today() ? diaryCard(p, statsFn(), { render: paint, kids, plain: true }) : null,
      h('div', { class: 'cal-head' },
        h('button', { class: 'cal-nav', 'aria-label': 'まえの月', onclick: () => { m -= 1; if (m < 0) { m = 11; y -= 1; } paint(); } }, icon('chevron-left')),
        h('b', {}, `${y}年 ${m + 1}月`),
        h('button', { class: 'cal-nav', 'aria-label': 'つぎの月', onclick: () => { m += 1; if (m > 11) { m = 0; y += 1; } paint(); } }, icon('chevron-right'))),
      h('div', { class: 'cal-grid cal-wd' }, ['月', '火', '水', '木', '金', '土', '日'].map((w) => h('small', {}, w))),
      h('div', { class: 'cal-grid' }, cells),
      sel !== today() ? h('div', { class: 'cal-detail' },
        h('b', {}, `${Number(sel.slice(5, 7))}/${Number(sel.slice(8))}`),
        h('span', {}, `${minutesOn(p, sel)}分・+${gainOn(p, sel)}pt`),
        st ? h('span', { class: 'cal-st' }, icon(st.ic), st.label) : null,
        e.note ? h('p', {}, e.note) : null) : null,
      totalsRow('今週', totals(p, weekKeys)),
      totalsRow(`${m + 1}月`, totals(p, monthKeys)),
      h('button', { class: 'link', onclick: close }, 'とじる')].filter(Boolean));
  };
  paint();
  document.body.append(sheet);
}

// 下に 固定する ふりかえりボタン（ホーム以外）。きょうの スタンプが あれば それを 見せる
export function diaryFab(onclick) {
  const b = h('button', { class: 'diary-fab', type: 'button', hidden: true, 'aria-label': 'きょうの ふりかえり', onclick });
  b.paint = (p) => {
    const st = STAMPS.find((x) => x.id === diaryOn(p)?.stamp);
    b.replaceChildren(icon(st ? st.ic : 'calendar-days'), h('small', {}, st ? st.label : 'ふりかえり'));
    b.classList.toggle('set', !!st);
  };
  return b;
}
