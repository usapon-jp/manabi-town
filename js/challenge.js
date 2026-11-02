// 20分 クイズチャレンジ: 3教科・5教科・9教科を じゅんばんに、時間いっぱい といていく。
// - 国語（漢字の読み）・算数/数学（計算）・英語（英単語）は アプリの中の問題で すぐ出す
// - 理科・社会・音楽など ほかの教科は ピヨ先生（Haiku, action: quiz）が 5もんずつ作る
// - せいかい1もん3ポイント ＋ といた分数（タイマーの記録にも入る）。まちがいは やりなおしクエストへ
// タイマーの「ピヨ」ボタンの「れんしゅう問題」（その教科を5もん）も ここ。
import { h, toast } from './ui.js';
import { save, gradeBucket, gradeLabel, toISO, daysUntil } from './store.js';
import { buildDrill } from './quests.js';
import { runQuestions } from './runner.js';
import { recordResults } from './review.js';
import { askAI, aiErrorText } from './ai.js';
import { sessions } from './timer.js';
import { icon } from './icons.js';

export const CHALLENGE_MIN = 20;
const PER_CORRECT = 3;
const FULL_BONUS = 20;   // 20分 さいごまで やった

// 教科のならび（小学生と中学生で 名前がちがう）
function subjectSet(p, n) {
  const j = gradeBucket(p) === 'j';
  const three = ['国語', j ? '数学' : '算数', '英語'];
  const five = [...three, '理科', '社会'];
  const nine = [...five, '音楽', j ? '美術' : '図工', j ? '保健体育' : '体育', j ? '技術・家庭' : '家庭'];
  return n === 9 ? nine : n === 5 ? five : three;
}
export const SETS = [3, 5, 9];

// アプリの中に問題がある教科
const LOCAL = { '国語': 'kanji', '算数': 'math', '数学': 'math', '英語': 'english' };

let seedN = 0;
function localBatch(p, subject) {
  const id = LOCAL[subject];
  // 書きとり（ノートに書く）は 時間がかかるので、チャレンジでは 読み・えらぶ・計算だけ
  const qs = [];
  for (let i = 0; i < 3 && qs.length < 3; i += 1) {
    seedN += 1;
    buildDrill(id, gradeBucket(p), `challenge:${Date.now()}:${seedN}`).forEach((q) => { if (q.kind !== 'write') qs.push(q); });
  }
  return qs.slice(0, 3).map((q) => ({ ...q, subject }));
}

// その教科で いま がんばっている所（テストのはんい など）。なければ 学年の復習
function topicFor(p, subject, hint) {
  if (hint) return hint;
  const key = subject.slice(0, 2);
  const item = p.items.filter((i) => !i.done && daysUntil(i.date) >= 0 && String(i.subject).includes(key))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (item) return `${item.title} ${item.range || ''}`.trim();
  return 'これまでに習ったところの ふくしゅう（基本の問題）';
}

async function aiBatch(p, subject, hint) {
  const r = await askAI({ action: 'quiz', subject, grade: gradeLabel(p), topic: topicFor(p, subject, hint), count: 5 }, { timeout: 30000 });
  return (r.questions || [])
    .filter((q) => q && q.q && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)
    .map((q) => ({ kind: 'choice', subject, prompt: String(q.q), options: q.options.map(String), answer: q.answer }));
}

// ---- タイマーのタブに出すカード --------------------------------------------------

export function challengeCard(p, deps) {
  const pick = p.challengeSet && SETS.includes(p.challengeSet) ? p.challengeSet : 3;
  const best = p.challengeBest || {};
  return h('div', { class: 'card setup challenge' },
    h('p', { class: 'label' }, icon('trophy'), ` ${CHALLENGE_MIN}分 クイズチャレンジ`),
    h('p', { class: 'hint' }, 'ピヨ先生と いっしょに、教科を じゅんばんに とこう'),
    h('div', { class: 'picks times' }, SETS.map((n) => h('button', { class: `pick ${pick === n ? 'on' : ''}`, onclick: () => { p.challengeSet = n; save(); deps.render(); } },
      `${n}教科`, best[n] ? h('small', {}, ` さいこう${best[n]}`) : null))),
    h('p', { class: 'hint' }, subjectSet(p, pick).join('・')),
    h('button', { class: 'btn primary start', onclick: () => startChallenge(p, pick, deps) }, icon('play'), ' チャレンジ スタート'));
}

// ---- 20分チャレンジ ------------------------------------------------------------

export function startChallenge(p, n, deps) {
  const subjects = subjectSet(p, n);
  const pools = Object.fromEntries(subjects.map((s) => [s, []]));
  const busy = new Set();
  const dead = new Set();   // 問題を作れなかった教科（今回は とばす）
  const questions = [];
  let turn = 0;
  const started = Date.now();

  function refill(s) {
    if (dead.has(s) || busy.has(s) || pools[s].length >= 3) return;
    if (LOCAL[s]) { pools[s].push(...localBatch(p, s)); return; }
    busy.add(s);
    aiBatch(p, s).then((qs) => { if (qs.length) pools[s].push(...qs); else dead.add(s); })
      .catch((e) => { dead.add(s); if (String(e?.message) === 'limit') toast(aiErrorText(e)); })
      .finally(() => busy.delete(s));
  }

  // つぎの問題を たす: 教科を じゅんばんに 1もんずつ。まだ作っている教科は とばして あとで
  function topUp(index) {
    subjects.forEach(refill);
    let guard = 0;
    while (questions.length - index < 4 && guard < subjects.length * 2) {
      const s = subjects[turn % subjects.length];
      turn += 1;
      guard += 1;
      if (pools[s].length) questions.push(pools[s].shift());
    }
  }
  topUp(0);
  if (!questions.length) { toast('問題を じゅんび できなかった…'); return; }

  runQuestions(`${n}教科 クイズチャレンジ`, questions, (score, total, results) => {
    recordResults(p, results, 'クイズチャレンジ');
    const minutes = Math.min(CHALLENGE_MIN, Math.floor((Date.now() - started) / 60000));
    const full = minutes >= CHALLENGE_MIN;
    const pts = score * PER_CORRECT + minutes + (full ? FULL_BONUS : 0);
    if (minutes >= 1) sessions(p).push({ id: `c${Date.now().toString(36)}`, date: toISO(new Date(started)), start: started, minutes, kind: 'challenge', subject: 'その他', points: minutes });
    p.challengeBest = { ...(p.challengeBest || {}), [n]: Math.max(score, (p.challengeBest || {})[n] || 0) };
    if (pts > 0) deps.gain(p, pts, `${n}教科 クイズチャレンジ`); else save();
    return `+${pts} ポイント！${full ? `（${CHALLENGE_MIN}分 やりきり +${FULL_BONUS}）` : ''}`;
  }, { deadline: started + CHALLENGE_MIN * 60000, onTick: topUp, onClose: () => deps.render() });
}

// ---- タイマー中の「れんしゅう問題」（その教科を5もん） -----------------------------

let practicing = false;
export async function startPractice(p, subject, hint) {
  if (practicing) return;
  practicing = true;
  const s = subject === '算数・数学' ? (gradeBucket(p) === 'j' ? '数学' : '算数') : subject;
  let qs = [];
  try {
    if (LOCAL[s] && !hint) qs = [...localBatch(p, s), ...localBatch(p, s)].slice(0, 5);
    else { toast('ピヨ先生が 問題を作り中…', 6000); qs = await aiBatch(p, s === 'その他' ? '総合' : s, hint); }
  } catch (e) {
    toast(aiErrorText(e).replace('ヒント', '問題'));
  }
  practicing = false;
  if (!qs.length) { toast('問題を 作れなかった…'); return; }
  runQuestions(`${s}の れんしゅう`, qs, (score, total, results) => {
    recordResults(p, results, `${s}の れんしゅう`);
    save();
    return score === total ? 'ぜんぶ できた！ タイマーに もどろう' : 'まちがえた問題は やりなおしクエストに 入れたよ';
  });
}
