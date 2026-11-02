// 実力テスト（学校のテスト）の点数を入れて、ボーナスと「にがてクエスト」につなげる。
// - 点数を入れると ボーナス（30 + 点数の半分。前の同じ教科より上がったら +20）
// - まちがえた問題（にがて）を書いておくと、ピヨ先生（AI）が にた問題を3もん作る
import { h, toast } from './ui.js';
import { today, save, gradeLabel } from './store.js';
import { runQuestions } from './runner.js';
import { askAI, aiErrorText } from './ai.js';
import { recordResults } from './review.js';
import { icon } from './icons.js';

export const SUBJECTS = ['国語', '算数', '理科', '社会', '英語'];
const UP_BONUS = 20;
export const WEAK_PER_CORRECT = 10;
export const WEAK_CLEAR = 15;

const tests = (p) => (Array.isArray(p.tests) ? p.tests : (p.tests = []));
export const weakList = (p) => (Array.isArray(p.weak) ? p.weak : (p.weak = []));
export const openWeak = (p) => weakList(p).filter((w) => !w.done);

export function testBonus(p, subject, pct) {
  const prev = tests(p).filter((t) => t.subject === subject).at(-1);
  const up = prev && pct > Math.round((prev.score / prev.total) * 100);
  return { pts: 30 + Math.round(pct / 2) + (up ? UP_BONUS : 0), up };
}

function sheet(...kids) {
  const close = () => el.remove();
  const el = h('div', { class: 'sheet', onclick: (e) => { if (e.target === el) close(); } },
    h('div', { class: 'sheet-card test-card' }, ...kids, h('button', { class: 'link', onclick: close }, 'とじる')));
  document.body.append(el);
  return { el, close };
}

// 点数を入れる画面
export function openTestEntry(p, deps) {
  let subject = SUBJECTS[1];
  const subj = h('div', { class: 'picks subjects' }, SUBJECTS.map((s) => h('button', { type: 'button', class: `pick ${s === subject ? 'on' : ''}`,
    onclick: (e) => { subject = s; subj.querySelectorAll('.pick').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); } }, s)));
  const score = h('input', { type: 'number', inputmode: 'numeric', min: 0, max: 1000, placeholder: '85' });
  const total = h('input', { type: 'number', inputmode: 'numeric', min: 1, max: 1000, value: 100 });
  const name = h('input', { type: 'text', maxlength: 30, placeholder: '2学期 実力テスト' });
  const weak = h('textarea', { rows: 3, placeholder: 'まちがえた問題（1行に1つ）\n例: 分数のわり算\n例: 円の面積' });

  const s = sheet(
    h('p', { class: 'sheet-title' }, icon('trophy'), ' 実力テストの点'),
    h('form', { class: 'form test-form', onsubmit: (e) => {
      e.preventDefault();
      const sc = Number(score.value); const tot = Number(total.value) || 100;
      if (!score.value || sc < 0 || sc > tot) { toast('点数を 入れてね'); return; }
      const pct = Math.round((sc / tot) * 100);
      const { pts, up } = testBonus(p, subject, pct);
      const topics = weak.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 10);
      tests(p).push({ date: today(), subject, name: name.value.trim() || '実力テスト', score: sc, total: tot, weak: topics });
      topics.forEach((topic) => weakList(p).push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, subject, topic, added: today(), done: false }));
      deps.gain(p, pts, `実力テスト（${subject}）`);
      s.close();
      deps.render();
      toast(`+${pts} ポイント！${up ? ' 前より 上がったね！' : ''}${topics.length ? ` にがてクエストが ${topics.length}こ できたよ` : ''}`);
    } },
      h('p', { class: 'label' }, 'きょうか'), subj,
      h('div', { class: 'score-row' }, h('label', {}, '点数', score), h('span', { class: 'slash' }, '/'), h('label', {}, '満点', total)),
      h('label', {}, 'テストの名前（なくてもOK）', name),
      h('label', {}, 'まちがえた問題（なくてもOK）', weak),
      h('button', { class: 'btn primary', type: 'submit' }, 'ほぞんして ポイントをもらう')),
  );
}

// にがてクエスト: ピヨ先生（AI）がにた問題を3もん作る
export async function startWeak(p, w, deps, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'ピヨ先生が 問題を作り中…'; }
  try {
    const r = await askAI({ action: 'quiz', subject: w.subject, grade: gradeLabel(p), topic: w.topic, count: 3 });
    const qs = (r.questions || []).filter((q) => q && q.q && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)
      .map((q) => ({ kind: 'choice', subject: w.subject, prompt: String(q.q), options: q.options.map(String), answer: q.answer }));
    if (!qs.length) throw new Error('empty');
    runQuestions(`にがてクエスト: ${w.topic}`, qs, (score, total, results) => {
      recordResults(p, results, `にがて: ${w.topic}`);
      const pts = score * WEAK_PER_CORRECT + (score === total ? WEAK_CLEAR : 0);
      w.tries = (w.tries || 0) + 1;
      if (score === total) w.clears = (w.clears || 0) + 1;
      if ((w.clears || 0) >= 2) w.done = true; // 2回ぜんもん正解で「にがて」卒業
      if (pts > 0) deps.gain(p, pts, `にがてクエスト: ${w.topic}`); else save();
      deps.render();
      return `+${pts} ポイント！${w.done ? '（にがて こくふく！）' : ''}`;
    });
  } catch (e) {
    toast(e.message === 'empty' ? 'うまく問題が作れなかった…もういちど おしてね' : aiErrorText(e));
  }
  if (btn) { btn.disabled = false; btn.textContent = 'やってみる'; }
}

export function testHistory(p) { return tests(p).slice(-5).reverse(); }
