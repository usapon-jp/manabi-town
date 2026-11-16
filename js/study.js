// 「テスト勉強をする」（テスト期間でないときは「勉強をする」）。
// フミオさん 2026-11-15「入口が あっちこっちに あって 別の名前だと わかりにくい。テスト勉強をする→国語・数学・理科… と
// 教科を えらぶだけに」「タイマーを セットしてから 何やろうかなと なる」「小6は きょうの算数が どこか わからない」
// → ホーム・やること・タイマー（せってい と 計っている とき）・ひよこ から、ぜんぶ この 1まいを ひらく。
//   上: きょうの分（デイリーの パーツ。漢字・計算…）、下: 教科（テスト範囲の 進みバーつき）
import { h, toast, daysLabel } from './ui.js';
import { today, daysUntil } from './store.js';
import { icon } from './icons.js';
import { isAdult } from './adult.js';
import { subjectNames, subjectColor } from './subjects.js';
import { rangeProgress, isKanjiRange, poolKey } from './coach.js';
import { startRangeRun } from './more.js';
import { practice } from './challenge.js';
import { startArtSymbolQuiz } from './art-quiz.js';

const SOON = 14;   // テストの 何日前から「テスト勉強」に するか（自動の 範囲問題と 同じ）
const EXTRA = ['音楽', '美術', '保健体育', '技術家庭'];

// きょうの分（デイリー）は main.js が もっているので、ここに つないでもらう
let hooks = { parts: () => [], done: () => ({}), start: () => {} };
export function setStudyHooks(h2) { hooks = { ...hooks, ...h2 }; }

// テストの 教科名（subject が「その他」のときは タイトルから）
function testName(p, i) {
  if (i.subject && i.subject !== 'その他') return i.subject;
  const names = [...subjectNames(p), ...EXTRA, '保健', '体育', '技術', '家庭'];
  return names.find((n) => i.title.includes(n)) || i.title;
}
const mathy = (s) => /数学|算数/.test(s);
const canonPractice = (s) => (mathy(s) ? '算数・数学' : s);

// 2週間いないの テスト（教科ごとに いちばん近い日）
export function testSoon(p) {
  if (isAdult(p)) return [];
  const map = new Map();
  p.items.filter((i) => i.type === 'test' && !i.done && daysUntil(i.date) >= 0 && daysUntil(i.date) <= SOON)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((i) => { const n = testName(p, i); if (!map.has(n)) map.set(n, { name: n, days: daysUntil(i.date), item: i }); });
  return [...map.values()];
}
export const studyLabel = (p) => (testSoon(p).length || rangeProgress(p).length ? 'テスト勉強をする' : '勉強をする');

// 範囲の行が その教科の テストを うけもつか
const covers = (r, name) => (isKanjiRange(r.x) ? name === '国語' : r.x.subject === name || (mathy(r.x.subject) && mathy(name)) || String(r.x.subject).includes(name) || name.includes(String(r.x.subject)));

function rows(p) {
  const ranges = rangeProgress(p).sort((a, b) => (a.days ?? 99) - (b.days ?? 99));
  const tests = testSoon(p);
  // テストは あるけれど 範囲の問題が まだ ない教科（ピヨ先生が テストを ヒントに 作る）
  const bare = tests.filter((t) => !ranges.some((r) => covers(r, t.name)));
  const used = new Set([...tests.map((t) => t.name), ...ranges.map((r) => r.x.subject)]);
  const others = subjectNames(p).filter((s) => s !== 'その他' && !used.has(s) && !(mathy(s) && [...used].some(mathy)));
  return { ranges, bare, others };
}

// 計っている タイマーの 上に 問題を 出す
const overTimer = (on) => document.getElementById('runner')?.classList.toggle('over', !!on);

export function openStudy(p, deps, ctx = {}) {
  document.querySelector('.study-sheet')?.remove();
  const close = () => sheet.remove();
  const go = (fn) => () => { close(); overTimer(ctx.fromTimer); fn(); };
  const label = studyLabel(p);
  const test = label === 'テスト勉強をする';
  const parts = isAdult(p) ? [] : hooks.parts(p);
  const done = parts.length ? hooks.done(p) : {};
  const { ranges, bare, others } = rows(p);
  // テストの 教科は 1教科1行に まとめる: きょうの分（デイリーの パーツ）が まだなら それ、おわったら 範囲の つづき
  const taken = new Set();
  const partFor = (match) => { const t = parts.find((x) => x.x && !taken.has(x.id) && match(x)); if (t) taken.add(t.id); return t; };
  const subjRows = [
    ...ranges.map((r) => ({ r, name: r.label, days: r.days, color: isKanjiRange(r.x) ? '国語' : r.x.subject, part: partFor((t) => poolKey(t.x) === r.key) })),
    ...bare.map((t) => ({ t, name: t.name, days: t.days, color: t.name, part: partFor((x) => covers({ x: x.x }, t.name)) })),
  ].sort((a, b) => (a.days ?? 99) - (b.days ?? 99));
  const plain = parts.filter((t) => !taken.has(t.id));   // 範囲の ない きょうの分（漢字・英単語・計算）
  const left = parts.filter((t) => !done[t.id]);
  const firstTodo = subjRows.find((x) => x.part && !done[x.part.id]) || null;
  const firstPlain = firstTodo ? null : plain.find((t) => !done[t.id]);

  const partRow = (t) => {
    const r = done[t.id];
    return h('button', { type: 'button', class: `st-row ${r ? 'done' : ''} ${firstPlain === t ? 'ready' : ''}`, onclick: go(() => hooks.start(p, t)) },
      h('span', { class: 'st-ic' }, icon(t.core === 'kanji' ? 'pen-line' : t.core === 'english' ? 'languages' : t.core === 'math' ? 'calculator' : 'book-open')),
      h('span', { class: 'st-main' }, h('b', {}, t.label), h('small', {}, r ? `${r.score} / ${r.total} せいかい` : `${t.n}もん`)),
      r ? h('span', { class: 'st-done' }, icon('check')) : h('span', { class: 'st-go' }, 'やる'));
  };
  const subjRow = (row) => {
    const { r, part } = row;
    const todo = part && !done[part.id];
    const pc = r ? Math.round((r.done / r.total) * 100) : 0;
    const all = r && r.done >= r.total;
    const run = todo ? () => hooks.start(p, part) : r ? () => startRangeRun(p, r.x, deps)
      : p.grade === 'j2' && row.name === '美術' ? () => startArtSymbolQuiz(p, deps)
        : () => practice(p, deps, canonPractice(row.name), !!ctx.fromTimer);
    const status = [part ? (done[part.id] ? 'きょうの分 クリア' : `きょうの分 ${part.n}もん`) : '',
      r ? (all ? `ぜんぶ といた！ ○ ${r.ok} / ${r.total}` : `といた ${r.done} / ${r.total}`) : (part ? '' : 'テストに あわせて 5もん')].filter(Boolean).join('・');
    return h('button', { type: 'button', class: `st-row subj ${firstTodo === row ? 'ready' : ''} ${part && !todo && all ? 'done' : ''}`, style: `--c:${subjectColor(p, row.color)}`, onclick: go(run) },
      h('span', { class: 'st-dot' }),
      h('span', { class: 'st-main' },
        h('b', {}, row.name, row.days != null ? h('small', { class: 'st-days' }, ` ${daysLabel(row.days)}`) : null),
        r ? h('span', { class: 'rbar' }, h('i', { style: `width:${pc}%` })) : null,
        h('small', {}, status)),
      h('span', { class: 'st-go' }, todo ? 'きょうの分' : r ? (all ? 'もう1周' : 'つづき') : 'やる'));
  };

  const sheet = h('div', { class: 'sheet study-sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card' },
      h('div', { class: 'coach' }, h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 40, height: 40 }),
        h('p', {}, left.length ? `まずは きょうの分！ あと${left.length}つ。光っている ところから やろう` : parts.length ? 'きょうの分は クリア！ つづきを やる？' : test ? 'どの教科を やる？' : 'なにを 勉強する？')),
      h('h3', { class: 'st-title' }, icon('book-open'), ` ${label}`),
      subjRows.length ? h('p', { class: 'st-sec' }, 'テストの 教科（近い じゅん）') : null,
      subjRows.length ? h('div', { class: 'st-list' }, subjRows.map(subjRow)) : null,
      p.grade === 'j2' && !subjRows.some((r) => /美術/.test(r.name))
        ? h('div', { class: 'st-list' },
          h('button', { type: 'button', class: 'st-row subj', style: '--c:#9c86c4',
            onclick: go(() => startArtSymbolQuiz(p, deps)) },
            h('span', { class: 'st-dot' }),
            h('span', { class: 'st-main' },
              h('b', {}, '中2美術｜シンボルマーク'),
              h('small', {}, '教科書 P94〜95・地域のマーク優先40問')),
            h('span', { class: 'st-go' }, 'やる'))) : null,
      plain.length ? h('p', { class: 'st-sec' }, plain.some((t) => !done[t.id]) ? 'きょうの分' : 'きょうの分 クリア！') : null,
      plain.length ? h('div', { class: 'st-list' }, plain.map(partRow)) : null,
      others.length ? h('p', { class: 'st-sec' }, subjRows.length ? 'ほかの 教科' : '教科を えらんで 5もん') : null,
      others.length ? h('div', { class: 'st-chips' }, others.map((s) => h('button', { type: 'button', class: 'pick', style: `--c:${subjectColor(p, s)}`,
        onclick: go(() => practice(p, deps, canonPractice(s), !!ctx.fromTimer)) }, s))) : null,
      ranges.length ? h('p', { class: 'st-note' }, '範囲の問題は どこで といても バーに たまるよ') : null,
      h('button', { class: 'link', type: 'button', onclick: close }, 'とじる')));
  document.body.append(sheet);
}

// どの画面にも おく 大きな ボタン（下に ひとこと: きょうの分の のこり・いちばん近い テスト）
export function studyButton(p, deps, ctx = {}) {
  if (isAdult(p)) return null;
  const parts = hooks.parts(p);
  const done = parts.length ? hooks.done(p) : {};
  const left = parts.filter((t) => !done[t.id]).length;
  const near = testSoon(p)[0];
  const sub = [left ? `きょうの分 あと${left}` : parts.length ? 'きょうの分 クリア' : '', near ? `${near.name}テスト ${daysLabel(near.days)}` : ''].filter(Boolean).join('・') || '教科を えらんで 5もん';
  return h('button', { type: 'button', class: `study-go ${ctx.small ? 'small' : ''}`, onclick: () => openStudy(p, deps, ctx) },
    h('span', { class: 'sg-ic' }, icon('book-open')),
    h('span', { class: 'sg-main' }, h('b', {}, studyLabel(p)), h('small', {}, sub)),
    icon('chevron-right'));
}
