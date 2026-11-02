// ひよこマーク（ピヨ先生）: タイマーから「しつもん」と「れんしゅう もんだい」をえらぶ。
// れんしゅう もんだい = 1教科5もん / クイズチャレンジ = 20分間で 3・5・9教科をまわる。
// 国語（漢字）・英語（たんご）・数学（けいさん）はアプリの中の問題、
// ほかの教科は テスト範囲をヒントに Haiku が作る（きょうの回数にカウント）。
import { h, toast } from './ui.js';
import { today, toISO, save, gradeBucket, gradeLabel } from './store.js';
import { buildDrill, POINTS_PER_CORRECT, shuffle, seededRandom } from './quests.js';
import { runQuestions } from './runner.js';
import { recordResults } from './review.js';
import { askAI, aiErrorText, aiLeft } from './ai.js';
import { openAsk } from './ask.js';
import { sessions } from './timer.js';
import { icon } from './icons.js';

export const CHALLENGE_MIN = 20;
const CORE = ['国語', '算数・数学', '理科', '社会', '英語'];
const ALL9 = [...CORE, '音楽', '美術', '保健体育', '技術家庭'];
const SETS = { 3: ['国語', '算数・数学', '英語'], 5: CORE, 9: ALL9 };
const PER = { 1: 5, 3: 5, 5: 4, 9: 3 };   // 1教科あたりの問題数
const DRILL_LABEL = { '漢字': '国語', '英単語': '英語', '算数': '算数・数学' };   // アプリ内ドリルの教科名
const canon = (s) => { const c = DRILL_LABEL[s] || s; return CORE.includes(c) ? c : 'その他'; };
const LOCAL = ['国語', '英語', '算数・数学'];

const piyo = () => h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 28, height: 28 });

// ---- ひよこメニュー ------------------------------------------------------------
// ctx: { subject, fromTimer }  fromTimer のときは 20分チャレンジは出さない（タイマーが動いているから）
export function openPiyo(p, deps, ctx = {}) {
  const close = () => sheet.remove();
  const subj = ctx.subject || '国語';
  const big = (ic, title, sub, onclick) => h('button', { type: 'button', class: 'piyo-opt', onclick: () => { close(); onclick(); } },
    h('span', { class: 'piyo-ic' }, icon(ic)), h('b', {}, title), h('small', {}, sub));
  const sheet = h('div', { class: 'sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card piyo-menu' },
      h('div', { class: 'coach' }, h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 40, height: 40 }), h('p', {}, 'ピヨ先生と なにする？')),
      big('message-circle', 'しつもん', 'わからないことを きく（写真もOK）', () => openAsk(p, { subject: subj })),
      big('pencil', `れんしゅう もんだい（${subj}）`, '5もん やってみる', () => practice(p, deps, subj, !!ctx.fromTimer)),
      ctx.fromTimer ? null : big('timer', `クイズチャレンジ（${CHALLENGE_MIN}分）`, '3・5・9教科を まわって 力だめし', () => openChallenge(p, deps)),
      h('button', { class: 'link', type: 'button', onclick: close }, 'とじる')));
  document.body.append(sheet);
}

// ---- 問題づくり ----------------------------------------------------------------

// その教科の いちばん近いテストの範囲（Haiku へのヒント）
function topicFor(p, subject) {
  const t = p.items.filter((i) => i.type === 'test' && !i.done && i.date >= today() && (i.subject === subject || i.title.includes(subject)))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return t ? `${t.title} ${t.range || ''}`.slice(0, 80) : '';
}

async function makeFor(p, subject, n, seed) {
  const bucket = gradeBucket(p);
  const rand = seededRandom(`chal:${subject}:${seed}`);
  if (subject === '国語') return shuffle(buildDrill('kanji', bucket, seed, rand), rand).slice(0, n);
  if (subject === '英語') return buildDrill('english', bucket, seed, rand).slice(0, n);
  if (subject === '算数・数学') return buildDrill('math', bucket, seed, rand).slice(0, n);
  const r = await askAI({ action: 'quiz', subject, grade: gradeLabel(p), topic: topicFor(p, subject), count: Math.min(5, n) }, { timeout: 30000 });
  return (r.questions || []).filter((q) => q && q.q && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)
    .slice(0, n).map((q) => ({ kind: 'choice', subject, prompt: String(q.q), options: q.options.map(String), answer: q.answer }));
}

// 教科ごとの問題を ひとつずつ まぜる（時間で切れても 教科がかたよらない）
function interleave(lists) {
  const out = [];
  for (let i = 0; lists.some((l) => i < l.length); i += 1) lists.forEach((l) => { if (i < l.length) out.push(l[i]); });
  return out;
}

let making = false;
async function build(p, subjects, n) {
  const seed = `${p.id}:${today()}:${Date.now() % 100000}`;
  // AI は きょうの のこり回数ぶんだけ（ならべて送ると 上限を こえるので、先にけずる）
  let left = aiLeft();
  const use = subjects.filter((s) => LOCAL.includes(s) || left-- > 0);
  if (use.length < subjects.length) toast('きょうの AI の回数が たりないから、ある教科だけ');
  const lists = await Promise.all(use.map((s) => makeFor(p, s, n, seed).catch((e) => { toast(`${s}: ${aiErrorText(e)}`); return []; })));
  return interleave(lists);
}

// ---- れんしゅう もんだい（1教科5もん）-----------------------------------------
async function practice(p, deps, subject, over) {
  if (making) return;
  making = true;
  toast('ピヨ先生が 問題を作り中…', 5000);
  const qs = await build(p, [subject], PER[1]).finally(() => { making = false; });
  if (!qs.length) { toast('うまく問題が作れなかった…あとで もういちど'); return; }
  document.getElementById('runner')?.classList.toggle('over', over);
  runQuestions(`${subject} れんしゅう`, qs, (score, total, results) => {
    recordResults(p, results, 'れんしゅう');
    const pts = score * POINTS_PER_CORRECT;
    if (pts > 0) deps.gain(p, pts, `れんしゅう（${subject}）`); else save();
    return `+${pts} ポイント！`;
  });
}

// ---- クイズチャレンジ（20分）---------------------------------------------------
export function openChallenge(p, deps) {
  let picked = new Set(SETS[5]);
  let cancelled = false;
  const close = () => { cancelled = true; sheet.remove(); };
  const chips = h('div', { class: 'picks subjects' });
  const info = h('p', { class: 'sheet-sub' });
  const go = h('button', { class: 'btn primary', type: 'button' }, icon('play'), ` スタート（${CHALLENGE_MIN}分）`);
  const presets = h('div', { class: 'picks' });
  const draw = () => {
    chips.replaceChildren(...ALL9.map((s) => h('button', { type: 'button', class: `pick ${picked.has(s) ? 'on' : ''}`,
      onclick: () => { if (picked.has(s)) picked.delete(s); else picked.add(s); draw(); } }, s)));
    presets.replaceChildren(...[3, 5, 9].map((n) => h('button', { type: 'button', class: `pick ${picked.size === n && SETS[n].every((s) => picked.has(s)) ? 'on' : ''}`,
      onclick: () => { picked = new Set(SETS[n]); draw(); } }, `${n}教科`)));
    const n = picked.size;
    const ai = [...picked].filter((s) => !LOCAL.includes(s)).length;
    info.textContent = n ? `${n}教科を ${CHALLENGE_MIN}分で まわるよ。時間が来たら そのもんだいで おしまい。${ai ? `（${ai}教科は AIが 問題を作るよ）` : ''}` : '教科を えらんでね';
    go.disabled = !n;
  };
  go.addEventListener('click', async () => {
    if (making || !picked.size) return;
    making = true; go.disabled = true; go.textContent = 'ピヨ先生が 問題を作り中…';
    const subjects = ALL9.filter((s) => picked.has(s));
    const qs = await build(p, subjects, PER[picked.size <= 3 ? 3 : picked.size <= 5 ? 5 : 9]).finally(() => { making = false; });
    if (cancelled) return;   // 問題を作っている間に やめた
    if (!qs.length) { toast('うまく問題が作れなかった…あとで もういちど'); draw(); go.replaceChildren(icon('play'), ` スタート（${CHALLENGE_MIN}分）`); return; }
    cancelled = true; sheet.remove();
    startChallenge(p, deps, subjects, qs);
  });
  const sheet = h('div', { class: 'sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card piyo-menu' },
      h('p', { class: 'sheet-title' }, piyo(), ` クイズチャレンジ ${CHALLENGE_MIN}分`),
      presets, chips, info, go,
      h('button', { class: 'link', type: 'button', onclick: close }, 'やめる')));
  draw();
  document.body.append(sheet);
}

function startChallenge(p, deps, subjects, qs) {
  const startedAt = Date.now();
  document.getElementById('runner')?.classList.remove('over');
  runQuestions('クイズチャレンジ', qs, (score, total, results) => {
    recordResults(p, results, 'クイズチャレンジ');
    const minutes = Math.max(1, Math.min(CHALLENGE_MIN + 5, Math.round((Date.now() - startedAt) / 60000)));
    // いちばん たくさん やった教科で 記録（タイマーの記録に のる）
    const count = {};
    results.forEach((r) => { count[r.q.subject] = (count[r.q.subject] || 0) + 1; });
    const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || subjects[0];
    const pts = score * POINTS_PER_CORRECT + minutes;
    sessions(p).push({ id: `${Date.now().toString(36)}c`, date: toISO(new Date(startedAt)), start: startedAt, minutes, kind: 'testprep', subject: canon(top), points: minutes });
    deps.gain(p, pts, `クイズチャレンジ ${minutes}分`);
    return `${subjects.length}教科 ${minutes}分！ +${pts} ポイント`;
  }, { minutes: CHALLENGE_MIN });
}

export const piyoButton = (p, deps, ctx) => h('button', { type: 'button', class: 'piyo-btn', 'aria-label': 'ピヨ先生（しつもん・れんしゅう）', onclick: () => openPiyo(p, deps, ctx) }, piyo());
