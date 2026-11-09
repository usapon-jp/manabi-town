// ピヨちゃんと 勉強する: きょうのクエストが おわっても、もっと 問題を とける。
// - 漢字・英単語・算数: アプリの中の問題を 5もんずつ。毎回 ちがう組みあわせ
// - テスト範囲の一問一答: 作戦会議で 作った問題（p.coach.pools）から 5もん
// - ピヨ先生が作る: テスト範囲をヒントに Haiku が 5もん（AI の回数にカウント）
// ポイントは ひかえめ（1もん2ポイント、1日 MORE_DAY_CAP まで）。レベル・ガチャが ふくらみすぎないように。
// きろくは p.bonus.days[きょう].more = { rounds, pts, n }
import { h, toast } from './ui.js';
import { today, save, gradeBucket } from './store.js';
import { buildDrill, shuffle, seededRandom } from './quests.js';
import { runQuestions } from './runner.js';
import { recordResults } from './review.js';
import { isAdult } from './adult.js';
import { icon } from './icons.js';
import { activeExtras, ensurePools, poolOf, rangeQ, isKanjiRange, rangeFor, rangeDrill, kanjiWriteOnly } from './coach.js';

export const MORE_PER_CORRECT = 2;
export const MORE_DAY_CAP = 40;
const ROUND = 5;
let pending = false;   // 問題を 作っている とちゅう

function dayLog(p) {
  if (!p.bonus) p.bonus = { days: {}, weeks: {} };
  if (!p.bonus.days) p.bonus.days = {};
  const d = (p.bonus.days[today()] ||= {});
  if (!d.more) d.more = { rounds: 0, pts: 0, n: 0 };
  return d.more;
}

// れんしゅうの ポイント（上限つき）。challenge.js の「れんしゅう もんだい」も ここを通す
export function practicePoints(p, score, total, label, deps) {
  const log = dayLog(p);
  log.rounds += 1;
  log.n += total;
  const pts = Math.max(0, Math.min(score * MORE_PER_CORRECT, MORE_DAY_CAP - log.pts));
  log.pts += pts;
  if (pts > 0) deps.gain(p, pts, label); else save();
  if (pts > 0) return `+${pts} ポイント！`;
  return score ? 'きょうの ポイントは いっぱい。ここからは 力だめしだよ' : 'またやってみよう';
}

export const moreStats = (p) => ({ ...dayLog(p), left: Math.max(0, MORE_DAY_CAP - dayLog(p).pts) });

// 範囲の問題（同じ ことばは 1回・書きとりだけの 人には 読みを のぞいた もの）
function poolQuestions(p, x, rand) {
  return shuffle(poolOf(p, x).filter((q) => q && q.q && Array.isArray(q.options)), rand).slice(0, ROUND)
    .map((q) => ({ ...rangeQ(x, q), test: true }));
}

const mathLabel = (p) => (gradeBucket(p) === 'j' ? '数学' : '算数');

// deps: { gain, render, makeAI(p, subject, n) → Promise<questions>, aiSubjects(p) → 教科の一覧 }
export function openMore(p, deps) {
  document.querySelector('.sheet.more-sheet')?.remove();
  const close = () => sheet.remove();
  const st = moreStats(p);
  const cleared = !!p.daily?.[today()];
  const start = (title, make) => {
    close();
    // AI で作っている あいだは ほかを はじめない。できたときに 別の問題を とちゅうなら すてる
    if (pending) { toast('ピヨ先生が 問題を作り中…ちょっと まってね'); return; }
    pending = true;
    Promise.resolve(make()).catch(() => []).finally(() => { pending = false; }).then((qs) => {
      if (!qs || !qs.length) { toast('うまく 問題が 作れなかった…あとで もういちど'); return; }
      if (document.getElementById('runner')?.hidden === false) return;
      runQuestions(title, qs, (score, total, results) => {
        recordResults(p, results, 'ピヨちゃんと 勉強');
        const msg = practicePoints(p, score, total, `ピヨちゃんと 勉強（${title}）`, deps);
        deps.render();
        return msg;
      }, { again: { label: 'もう1回', onClick: () => start(title, make) } });
    });
  };
  const seed = () => `${p.id}:${today()}:more:${dayLog(p).rounds}:${Date.now() % 100000}`;
  // テスト前は 漢字・英単語・計算も テスト範囲から（範囲が ない教科だけ 学年の問題）
  const local = (id) => () => { const x = rangeFor(p, id); return x ? rangeDrill(p, x, ROUND, seed()) : buildDrill(id, gradeBucket(p), seed(), undefined, { writeOnly: kanjiWriteOnly(p) }); };
  const tileSub = (id, sub) => (rangeFor(p, id) ? 'テスト範囲' : sub);

  const opt = (ic, title, sub, onclick, cls = '') => h('button', { type: 'button', class: `piyo-opt ${cls}`, onclick },
    h('span', { class: 'piyo-ic' }, icon(ic)), h('b', {}, title), h('small', {}, sub));

  // テスト範囲（いま有効な 範囲だけ。問題が まだ なければ ここで 作る）を いちばん上に
  const ranges = activeExtras(p);
  const rangeQs = (x) => async () => {
    if (!poolOf(p, x).length) { toast('ピヨ先生が 範囲の問題を作り中…', 8000); await ensurePools(p); }
    return poolQuestions(p, x, seededRandom(seed()));
  };
  const aiSubjects = deps.aiSubjects ? deps.aiSubjects(p) : [];
  const aiPick = h('select', { class: 'more-subj', 'aria-label': '教科' }, aiSubjects.map((s) => h('option', { value: s }, s)));

  const sheet = h('div', { class: 'sheet more-sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card piyo-menu' },
      h('div', { class: 'coach' }, h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 48, height: 48 }),
        h('p', {}, cleared ? 'きょうの分 クリア！ もっと やる？' : 'なにを 勉強する？')),
      ranges.length ? h('p', { class: 'more-sec' }, icon('target'), ' テスト範囲') : null,
      ...ranges.map((x) => opt('target', isKanjiRange(x) ? '漢字・国語' : `${x.subject}`, x.topic, () => start(`${x.subject} テスト範囲`, rangeQs(x)), 'range')),
      ranges.length ? h('p', { class: 'more-sec' }, 'ふだんの れんしゅう') : null,
      h('div', { class: 'more-grid' },
        opt('pen-line', '漢字', tileSub('kanji', kanjiWriteOnly(p) ? '書きとり' : '書く・読む'), () => start('漢字', local('kanji'))),
        opt('languages', '英単語', tileSub('english', 'つづり・いみ'), () => start('英単語', local('english'))),
        opt('calculator', mathLabel(p), tileSub('math', 'けいさん'), () => start(mathLabel(p), local('math')))),

      deps.makeAI && aiSubjects.length ? h('div', { class: 'piyo-opt more-ai' },
        h('span', { class: 'piyo-ic' }, icon('sparkles')),
        h('b', {}, 'ピヨ先生が 作る'),
        h('small', {}, 'テスト範囲から 5もん'),
        h('div', { class: 'more-ai-row' }, aiPick,
          h('button', { type: 'button', class: 'btn small primary', onclick: () => {
            const s = aiPick.value;
            toast('ピヨ先生が 問題を作り中…', 6000);
            start(`${s} れんしゅう`, () => deps.makeAI(p, s, ROUND));
          } }, 'つくって！'))) : null,
      h('p', { class: 'more-meter' }, st.rounds
        ? `きょう ${st.rounds}回・${st.n}もん とけたよ！ ${st.left ? `あと ${st.left}ポイント もらえる` : 'ポイントは いっぱい（力だめしは つづけられるよ）'}`
        : `1もん ${MORE_PER_CORRECT}ポイント（1日 ${MORE_DAY_CAP}ポイントまで）`),
      h('button', { class: 'link', type: 'button', onclick: close }, 'とじる')));
  document.body.append(sheet);
}

// クエストの画面の カード
export function moreCard(p, deps) {
  if (isAdult(p)) return null;
  const cleared = !!p.daily?.[today()];
  const st = moreStats(p);
  return h('div', { class: `card quest more-card${cleared ? ' ready' : ''}` },
    h('div', { class: 'more-head' },
      h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 44, height: 44 }),
      h('div', {},
        h('h3', {}, 'ピヨちゃんと 勉強する'),
        h('p', {}, cleared ? 'きょうの分は クリア！ もっと やってみよう' : 'テスト範囲・漢字・英単語・計算を すきなだけ'))),
    st.rounds ? h('p', { class: 'more-meter' }, `きょう ${st.rounds}回・${st.n}もん`) : null,
    h('button', { class: `btn ${cleared ? 'primary' : ''}`, onclick: () => openMore(p, deps) }, icon('sparkles'), cleared ? ' もっと やる！' : ' えらぶ'));
}
