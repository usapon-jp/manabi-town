// じぶんで 書く「きょう やること」。ホームの きょうのリストに まざって出る。
// チェックで 少しだけポイント（1こ MINE_POINTS、1日 MINE_DAY_CAP まで）。もどすと そのぶん へる。
// きろくは p.myTodos = { 'YYYY-MM-DD': [{ id, text, done, pts }] }（14日分だけ のこす）
import { h, toast } from './ui.js';
import { today, toISO, save } from './store.js';
import { icon } from './icons.js';

export const MINE_POINTS = 3;
export const MINE_DAY_CAP = 15;
const KEEP_DAYS = 14;

function days(p) {
  if (!p.myTodos || typeof p.myTodos !== 'object') p.myTodos = {};
  return p.myTodos;
}

export function mineToday(p) {
  return days(p)[today()] || [];
}

const earnedToday = (p) => mineToday(p).reduce((s, t) => s + (t.done ? t.pts || 0 : 0), 0);

export function addMine(p, text) {
  text = String(text || '').trim().slice(0, 40);
  if (!text) return false;
  // 同じ文字が もう あるときは 足さない
  if (mineToday(p).some((x) => x.text === text)) { toast('もう 入っているよ'); return false; }
  const all = days(p);
  const key = today();
  // ふるい日は けす
  const cut = new Date(); cut.setDate(cut.getDate() - KEEP_DAYS);
  Object.keys(all).forEach((k) => { if (k < toISO(cut)) delete all[k]; });
  all[key] = [...(all[key] || []), { id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, text, done: false, pts: 0 }];
  save();
  return true;
}

export function removeMine(p, id, addPoints) {
  const key = today();
  const list = days(p)[key] || [];
  const t = list.find((x) => x.id === id);
  if (t?.done && t.pts) addPoints(p, -t.pts, `とりけし: ${t.text}`);
  days(p)[key] = list.filter((x) => x.id !== id);
  save();
}

// チェック・もどす。もらったポイントを かえす（上限いっぱいなら 0）
export function toggleMine(p, id, { gain, addPoints }) {
  const t = mineToday(p).find((x) => x.id === id);
  if (!t) return 0;
  if (t.done) {
    if (t.pts) addPoints(p, -t.pts, `とりけし: ${t.text}`);
    t.done = false; t.pts = 0;
    save();
    return 0;
  }
  const pts = Math.max(0, Math.min(MINE_POINTS, MINE_DAY_CAP - earnedToday(p)));
  t.done = true; t.pts = pts;
  if (pts > 0) gain(p, pts, `やること: ${t.text}`); else save();
  return pts;
}

// きのう まで にできなかったもの（同じ文字は1つ）
export function leftovers(p) {
  const all = days(p);
  const key = today();
  const now = new Set(mineToday(p).map((t) => t.text));
  const seen = new Set();
  return Object.keys(all).filter((k) => k < key).sort().reverse()
    .flatMap((k) => all[k].filter((t) => !t.done))
    .filter((t) => !now.has(t.text) && !seen.has(t.text) && seen.add(t.text))
    .slice(0, 5);
}

// まえに 書いたもの（すぐ 入れられるように）
function recent(p, kids) {
  const all = days(p);
  const now = new Set(mineToday(p).map((t) => t.text));
  const seen = new Set();
  const out = Object.keys(all).sort().reverse().flatMap((k) => all[k].map((t) => t.text))
    .filter((s) => !now.has(s) && !seen.has(s) && seen.add(s));
  const presets = kids ? ['音読', 'あしたの じゅんび', '本を 読む', 'プリントを 出す'] : ['ストレッチ', 'メールの へんじ', '買いもの', '本を 読む'];
  presets.forEach((s) => { if (!now.has(s) && !seen.has(s)) { seen.add(s); out.push(s); } });
  return out.slice(0, 6);
}

// きょうのリストの下に出す「書いて たす」ところ
export function mineAdder(p, { render, kids }) {
  const input = h('input', { class: 'mine-input', type: 'text', maxlength: 40, placeholder: kids ? 'やることを 書く（れい: 音読）' : 'やることを 書く', enterkeyhint: 'done' });
  const add = (text) => { if (addMine(p, text ?? input.value)) render({ keepAdder: true }); else input.focus(); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); add(); } });
  const left = leftovers(p);
  const chips = recent(p, kids).filter((s) => !left.some((t) => t.text === s));
  const done = mineToday(p).filter((t) => t.done).length;
  const capped = earnedToday(p) >= MINE_DAY_CAP;
  return h('div', { class: 'mine-add' },
    h('div', { class: 'mine-row' },
      input,
      h('button', { class: 'btn small primary mine-btn', 'aria-label': 'たす', onclick: () => add() }, icon('plus'))),
    left.length ? h('div', { class: 'mine-chips' },
      h('small', {}, 'きのうの のこり'),
      left.map((t) => h('button', { class: 'mine-chip left', onclick: () => add(t.text) }, icon('repeat'), ` ${t.text}`))) : null,
    chips.length ? h('div', { class: 'mine-chips' }, chips.map((s) => h('button', { class: 'mine-chip', onclick: () => add(s) }, `＋ ${s}`))) : null,
    h('p', { class: 'mine-note' }, capped
      ? `${done}こ できた！ ポイントは きょうの分 いっぱい`
      : `できたら 1こ +${MINE_POINTS}（1日 ${MINE_DAY_CAP}まで）`));
}
