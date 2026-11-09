// 教科（おとなは「ジャンル」）の並び。プロフィールごとに ついか・なまえ・ならびかえ・けす ができる。
// - なおしていない人は、はじめの並び（子ども=五教科＋その他、おとな=資格・勉強など）
// - なおしたら p.subjects = [{ id, name, color }] にしまう（id があるので端末間でも まとまる）
// - なまえを かえたら、これまでの記録（タイマー・やること・小テスト）の教科名も いっしょに かえる
// - けしても記録は のこる（色は グレー）
import { h, toast } from './ui.js';
import { SUBJECTS, save } from './store.js';
import { icon } from './icons.js';
import { kanjiWriteOnly, setKanjiStyle, kanjiPickWrite, setKanjiPick, bookFor } from './coach.js';

export const ADULT_DEFAULT = ['資格・勉強', '仕事', '健康', 'くらし', 'しゅみ', 'その他'];
const KNOWN = {
  '国語': '#d78b9f', '算数・数学': '#7f985e', '理科': '#d8b85a', '社会': '#c98766', '英語': '#7aa6bd', 'その他': '#9aa897',
};
export const PALETTE = ['#d78b9f', '#7f985e', '#d8b85a', '#c98766', '#7aa6bd', '#9c86c4', '#e0a35c', '#6fae9f', '#c58fb3', '#8d9fc9', '#b5a46a', '#9aa897'];
const GRAY = '#9aa897';
const MAX = 16;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const isAdult = (p) => p?.grade === 'adult';
const defaults = (p) => {
  const names = isAdult(p) ? ADULT_DEFAULT : SUBJECTS;
  return names.map((name, i) => ({ id: `d${i}`, name, color: KNOWN[name] || PALETTE[(i + 5) % PALETTE.length] }));
};
const edited = (p) => Array.isArray(p?.subjects) && p.subjects.some((s) => s && s.name);

export function subjectList(p) {
  if (!edited(p)) return defaults(p);
  return p.subjects.filter((s) => s && typeof s.name === 'string' && s.name.trim());
}
export const subjectNames = (p) => subjectList(p).map((s) => s.name);
export function subjectColor(p, name) {
  return subjectList(p).find((s) => s.name === name)?.color || KNOWN[name] || GRAY;
}

// 手でなおすときだけ、いまの並びを書きだす
function own(p) {
  if (!edited(p)) p.subjects = defaults(p);
  return p.subjects;
}

function renameRecords(p, from, to) {
  const fix = (arr) => (Array.isArray(arr) ? arr : []).forEach((x) => { if (x && x.subject === from) x.subject = to; });
  fix(p.sessions); fix(p.items); fix(p.quizzes);
  if (p.timerPrefs?.subject === from) p.timerPrefs.subject = to;
}

// ---- へんしゅうの画面 ----------------------------------------------------------

export function editSubjectsLink(p, onChange) {
  return h('button', { type: 'button', class: 'link subj-edit', onclick: () => openSubjectEditor(p, onChange) }, icon('pencil'), ' へんしゅう');
}

// 漢字の 問題の 出し方（テストが 書きとりだけなら 読みを 出さない）。作戦会議で 言っても かわる
function kanjiStyleRow(p) {
  const seg = h('div', { class: 'seg' });
  const draw = () => {
    const w = kanjiWriteOnly(p);
    seg.replaceChildren(
      h('button', { type: 'button', class: w ? '' : 'on', onclick: () => { setKanjiStyle(p, 'both'); draw(); } }, '書きとりと 読み'),
      h('button', { type: 'button', class: w ? 'on' : '', onclick: () => { setKanjiStyle(p, 'write'); draw(); toast('漢字は 書きとりだけ に したよ'); } }, '書きとりだけ'));
  };
  draw();
  // 漢字ワークに 同音異義語などが あるときは それを えらぶ か 書く か
  const book = bookFor(p);
  let pickRow = null;
  if (book?.choiceFrom) {
    const seg2 = h('div', { class: 'seg' });
    const draw2 = () => {
      const w = kanjiPickWrite(p);
      seg2.replaceChildren(
        h('button', { type: 'button', class: w ? '' : 'on', onclick: () => { setKanjiPick(p, 'pick'); draw2(); } }, 'えらぶ'),
        h('button', { type: 'button', class: w ? 'on' : '', onclick: () => { setKanjiPick(p, 'write'); draw2(); toast('同音異義語も 書きとりに したよ'); } }, '書く'));
    };
    draw2();
    pickRow = [h('p', {}, ' 同音異義語・同訓異字'), seg2];
  }
  return h('div', { class: 'subj-kanji' }, h('p', {}, icon('pen-line'), ' 漢字の 問題'), seg, ...(pickRow || []));
}

export function openSubjectEditor(p, onClose) {
  const word = isAdult(p) ? 'ジャンル' : 'きょうか';
  const close = () => { sheet.remove(); onClose?.(); };
  const again = () => { sheet.remove(); openSubjectEditor(p, onClose); };
  const list = subjectList(p);
  const taken = (name, except) => list.some((s) => s.name === name && s !== except);

  const row = (s, i) => {
    const name = h('input', { type: 'text', maxlength: 10, value: s.name, 'aria-label': `${word}の なまえ` });
    name.onchange = () => {
      const v = name.value.trim();
      if (!v || v === s.name) { name.value = s.name; return; }
      if (taken(v, s)) { toast('おなじ なまえが あるよ'); name.value = s.name; return; }
      const mine = own(p).find((x) => x.id === s.id);
      renameRecords(p, s.name, v);
      mine.name = v; s.name = v;
      save();
    };
    return h('li', {},
      h('button', { type: 'button', class: 'subj-dot', style: `background:${s.color}`, 'aria-label': 'いろを かえる', onclick: () => {
        const mine = own(p).find((x) => x.id === s.id);
        mine.color = PALETTE[(PALETTE.indexOf(mine.color) + 1) % PALETTE.length];
        save(); again();
      } }),
      name,
      h('button', { type: 'button', class: 'subj-btn', 'aria-label': 'うえへ', disabled: i === 0 || null, onclick: () => move(i, -1) }, icon('chevron-up')),
      h('button', { type: 'button', class: 'subj-btn', 'aria-label': 'したへ', disabled: i === list.length - 1 || null, onclick: () => move(i, 1) }, icon('chevron-down')),
      h('button', { type: 'button', class: 'subj-btn', 'aria-label': 'けす', disabled: list.length <= 1 || null, onclick: () => {
        if (!confirm(`「${s.name}」を けす？（これまでの記録は のこるよ）`)) return;
        p.subjects = own(p).filter((x) => x.id !== s.id);
        save(); again();
      } }, icon('x')));
  };
  function move(i, d) {
    const arr = own(p);
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    save(); again();
  }

  const add = h('input', { type: 'text', maxlength: 10, placeholder: isAdult(p) ? 'れい: 簿記' : 'れい: 音楽', 'aria-label': `あたらしい${word}` });
  const doAdd = () => {
    const v = add.value.trim();
    if (!v) { add.focus(); return; }
    if (taken(v)) { toast('おなじ なまえが あるよ'); return; }
    if (list.length >= MAX) { toast(`${MAX}こまでだよ`); return; }
    const arr = own(p);
    const used = new Set(arr.map((x) => x.color));
    arr.push({ id: uid(), name: v, color: PALETTE.find((c) => !used.has(c)) || PALETTE[arr.length % PALETTE.length] });
    save(); again();
  };
  add.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } };

  const sheet = h('div', { class: 'sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card subj-card' },
      h('p', { class: 'sheet-title' }, icon('pencil'), ` ${word}`),
      h('ul', { class: 'subj-list' }, list.map(row)),
      h('div', { class: 'subj-add' }, add, h('button', { type: 'button', class: 'btn small primary', onclick: doAdd }, icon('plus'), ' ついか')),
      isAdult(p) ? null : kanjiStyleRow(p),
      h('button', { class: 'btn primary', onclick: () => { document.activeElement?.blur?.(); close(); } }, 'できた'),
      edited(p) ? h('button', { class: 'link', onclick: () => {
        if (!confirm('はじめの ならびに もどす？')) return;
        delete p.subjects; save(); again();
      } }, 'はじめの ならびに もどす') : null));
  document.body.append(sheet);
}
