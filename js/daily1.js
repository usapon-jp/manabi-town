// 小6の「きょうの1もん」。アプリを ひらくたびに、きょうの分が まだなら ポップアップで 出す。
// 問題は js/data/okazaki6.js を 上から じゅんに 1日1もん。答えたら「とき方」が 出る。
// まちがえた問題は やりなおし（js/review.js）に 入るので、次の日・3日後・1週間後に もう一度 出る。
//
// 保存（プロフィールの p.daily1）:
//   day:  'YYYY-MM-DD'  きょうの問題を きめた日
//   id:   きょうの問題
//   done: その日に 答えたか
//   log:  { [問題id]: { at: 'YYYY-MM-DD', ok } }  いちど 答えた問題（つぎの日は その つぎを 出す）
import { h } from './ui.js';
import { save, today } from './store.js';
import { icon } from './icons.js';
import { runQuestions } from './runner.js';
import { recordResults } from './review.js';
import { OKAZAKI6 } from './data/okazaki6.js';

export const DAILY1_OK = 20;     // せいかい
export const DAILY1_TRY = 5;     // まちがえても、ちょうせんした分
const SHOW_GAP = 60 * 60 * 1000; // アプリに もどってきたとき、1時間あいていたら また出す

export const hasDaily1 = (p) => !!p && p.grade === 'e6';

function st(p) {
  if (!p.daily1 || typeof p.daily1 !== 'object') p.daily1 = {};
  const s = p.daily1;
  if (!s.log || typeof s.log !== 'object') s.log = {};
  return s;
}

// きょうの問題（日が かわったら つぎの問題に すすむ）
export function todayProblem(p) {
  const s = st(p);
  const t = today();
  if (s.day !== t || !OKAZAKI6.some((x) => x.id === s.id)) {
    // まだ 答えていない いちばん 上の問題。ぜんぶ おわったら、まちがえた問題 → いちばん むかしに やった問題
    const fresh = OKAZAKI6.find((x) => !s.log[x.id]);
    const again = () => [...OKAZAKI6].sort((a, b) => (s.log[a.id].ok - s.log[b.id].ok) || String(s.log[a.id].at).localeCompare(String(s.log[b.id].at)))[0];
    s.day = t;
    s.id = (fresh || again()).id;
    s.done = false;
    save();
  }
  return OKAZAKI6.find((x) => x.id === s.id);
}

export const daily1Done = (p) => hasDaily1(p) && st(p).day === today() && !!st(p).done;
const left = (p) => OKAZAKI6.filter((x) => !st(p).log[x.id]).length;

function question(prob) {
  return { kind: prob.options ? 'choice' : 'number', subject: `算数・${prob.unit}`, prompt: prob.prompt, big: prob.big,
    options: prob.options, answer: prob.answer, explain: prob.explain };
}

// 問題を とく（ポップアップからも ボーナスからも）
export function startDaily1(p, deps) {
  const prob = todayProblem(p);
  runQuestions('きょうの1もん', [question(prob)], (score, total, results) => {
    recordResults(p, results, 'きょうの1もん');
    const s = st(p);
    const first = !s.done;
    const ok = score === total;
    s.done = true;
    if (!s.log[prob.id] || first) s.log[prob.id] = { at: today(), ok };
    if (!first) { save(); deps.render(); return 'きょうの分は もう もらったよ'; }
    const pts = ok ? DAILY1_OK : DAILY1_TRY;
    deps.gain(p, pts, `きょうの1もん（${prob.unit}）`);
    return ok ? `+${pts} ポイント！ あしたも 1もん！` : `ちょうせん +${pts}。まちがえた問題は あした「やりなおし」に 出るよ`;
  });
}

// ポップアップ
export function openDaily1(p, deps) {
  if (!hasDaily1(p) || document.querySelector('.daily1-sheet')) return;
  const prob = todayProblem(p);
  const s = st(p);
  lastShown = Date.now();
  const n = Object.keys(s.log).length;
  const close = () => el.remove();
  const el = h('div', { class: 'sheet daily1-sheet', onclick: (e) => { if (e.target === el) close(); } },
    h('div', { class: 'sheet-card daily1-card' },
      h('p', { class: 'sheet-title' }, icon('calculator'), ' きょうの 1もん'),
      h('p', { class: 'sheet-sub' }, `じゅけん たいさく・${n + 1}もんめ（のこり ${left(p)}もん）`),
      h('div', { class: 'd1-q' },
        h('span', { class: 'chip' }, prob.unit),
        h('p', {}, prob.big ? `${prob.big}` : prob.prompt)),
      h('button', { class: 'btn primary', onclick: () => { close(); startDaily1(p, deps); } },
        `とく（せいかいで +${DAILY1_OK}）`),
      h('button', { class: 'link', onclick: close }, 'あとで')));
  document.body.append(el);
}

// アプリを ひらいたとき（いつも）・もどってきたとき（1時間あいていたら）に よぶ
let lastShown = 0;
export function maybeDaily1(p, deps, { resume = false } = {}) {
  if (!hasDaily1(p) || daily1Done(p)) return;
  if (resume && Date.now() - lastShown < SHOW_GAP) return;
  // 問題をといている間・ほかのシートや つかいかたが 出ている間は じゃましない
  if (document.body.classList.contains('running') || document.querySelector('.sheet, .tour-ring, .timer-run')) return;
  openDaily1(p, deps);
}
