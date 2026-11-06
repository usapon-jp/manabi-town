// きょうの ふりかえり: 自動まとめ ＋ スタンプ1タップ ＋ 一言（なくてもOK）
// きろくは p.diary = { 'YYYY-MM-DD': { stamp, note } }（30日分だけ のこす）。ポイントや れんぞくには 関係しない。
import { h } from './ui.js';
import { today, toISO, save } from './store.js';
import { icon } from './icons.js';

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
export function diaryCard(p, stats, { render, kids }) {
  const cur = diaryOn(p) || {};
  const input = h('input', { class: 'mine-input', type: 'text', maxlength: 40, value: cur.note || '', placeholder: kids ? 'ひとこと（なくてもOK）' : 'ひとこと（なくてもOK）', enterkeyhint: 'done' });
  const saveNote = () => { if ((cur.note || '') !== input.value.trim()) { put(p, { note: input.value.trim().slice(0, 40) }); } };
  input.addEventListener('change', saveNote);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); input.blur(); } });
  return h('div', { class: 'card quest diary-card' },
    h('h3', {}, icon('notebook-pen'), ' きょうの ふりかえり'),
    h('p', { class: 'diary-sum' }, summary(stats)),
    h('div', { class: 'stamps-pick' }, STAMPS.map((s) => h('button', {
      class: `stamp-btn ${cur.stamp === s.id ? 'on' : ''}`, 'aria-pressed': String(cur.stamp === s.id),
      onclick: () => { saveNote(); put(p, { stamp: cur.stamp === s.id ? '' : s.id }); render(); },
    }, icon(s.ic), h('small', {}, s.label)))),
    input);
}

// 進み具合に出す: さいきん7日の スタンプ
export function diaryWeek(p) {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = toISO(d);
    const e = diaryOn(p, key);
    out.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, e, s: STAMPS.find((x) => x.id === e?.stamp) });
  }
  if (!out.some((x) => x.e)) return null;
  return h('div', { class: 'card diary-week' },
    h('h3', {}, 'ふりかえり（7日）'),
    h('div', { class: 'dw-row' }, out.map((x) => h('div', { class: `dw ${x.s ? 'has' : ''}`, title: x.e?.note || '' }, x.s ? icon(x.s.ic) : h('span', { class: 'dw-dot' }), h('small', {}, x.label)))),
    out.filter((x) => x.e?.note).slice(-2).map((x) => h('p', { class: 'dw-note' }, `${x.label} ${x.e.note}`)));
}
