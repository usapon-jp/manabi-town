// 問題を1問ずつ出して答え合わせをする画面（クエストと小テストで共通）
// 画面いっぱいに出して、問題・答えるところ・つぎへ、をはっきり分ける。
import { h } from './ui.js';
import { createInkPad } from './ink/pad.js';
import { icon } from './icons.js';
import { askAI, aiErrorText, aiLeft } from './ai.js';
import { currentProfile, gradeLabel } from './store.js';

const PRAISE = ['せいかい！', 'すごい！', 'やったね！', 'ばっちり！'];
export const KYOKASHO = '"UD Digi Kyokasho N-R", "UD デジタル 教科書体 N-R", YuKyokasho, "Klee One", "Hiragino Mincho ProN", serif';

// opts.deadline: この時刻（ms）になったら おわる（クイズチャレンジ）。問題の数は あとから ふえてもいい
// opts.onClose: とじたとき
export function runQuestions(title, questions, onFinish, opts = {}) {
  const layer = document.getElementById('runner');
  const timed = !!opts.deadline;
  let clockTimer = 0;
  let finished = false;
  let index = 0;
  let score = 0;
  let pads = [];
  const results = []; // [{ q, ok }]（まちがえた問題を、あとで やりなおしに出すため）

  function cleanup() { pads.forEach((p) => p.destroy()); pads = []; }

  function close() {
    clearInterval(clockTimer);
    if (timed && !finished) finish();   // とちゅうで とじても、できた分は 記録する
    cleanup();
    layer.hidden = true;
    layer.replaceChildren();
    document.body.classList.remove('running');
    opts.onClose?.();
  }

  function render() {
    cleanup();
    const q = questions[index];
    const feedback = h('div', { class: 'feedback', role: 'status' });
    const next = h('button', { class: 'btn primary next', hidden: true, onclick: () => {
      index += 1;
      if (timed && Date.now() >= opts.deadline) { finish(); return; }
      if (index < questions.length) render(); else finish();
    } }, timed || index + 1 < questions.length ? 'つぎへ' : 'けっかを見る');

    function judge(ok, answerText) {
      react(ok);
      results.push({ q, ok });
      if (ok) score += 1;
      feedback.className = `feedback ${ok ? 'ok' : 'ng'}`;
      feedback.textContent = ok
        ? `ピヨ先生「${PRAISE[index % PRAISE.length]}」`
        : `ピヨ先生「おしい！こたえは ${answerText} だよ」`;
      next.hidden = false;
      next.scrollIntoView?.({ block: 'nearest' });
    }

    let answerArea;
    let kind = q.kind;
    if (kind === 'choice') {
      const buttons = q.options.map((opt, i) => h('button', { class: 'option', style: `--i:${i}`, onclick: () => {
        buttons.forEach((b) => { b.disabled = true; });
        buttons[q.answer].classList.add('correct');
        if (i !== q.answer) buttons[i].classList.add('wrong');
        judge(i === q.answer, q.options[q.answer]);
      } }, opt));
      answerArea = h('div', { class: 'options' }, buttons);
    } else if (kind === 'write') {
      answerArea = writeArea(q, (ok) => {
        react(ok);
        results.push({ q, ok });
        if (ok) score += 1;
        feedback.className = `feedback ${ok ? 'ok' : 'ng'}`;
        feedback.textContent = ok ? `ピヨ先生「${PRAISE[index % PRAISE.length]}」` : 'ピヨ先生「お手本を見て、ノートに3回書いてみよう」';
        next.hidden = false;
      });
    } else {
      kind = 'number';
      answerArea = h('div', { class: 'math-area' },
        memoArea(pads),
        numberPad((value) => judge(Math.abs(value - q.answer) < 1e-9, String(q.answer).replace('-', '−')), q.answer));
    }

    const dots = timed
      ? h('b', { class: 'quiz-clock', 'aria-label': 'のこり時間' }, clockText())
      : h('div', { class: 'dots', 'aria-hidden': 'true' },
        questions.map((_, i) => h('i', { class: i < index ? 'done' : i === index ? 'now' : '' })));

    // 正解ははずんで星が飛ぶ、まちがいはぷるっとゆれる
    function react(ok) {
      const box = layer.querySelector('.q-box');
      if (!box) return;
      box.classList.remove('hop', 'shake');
      void box.offsetWidth;
      box.classList.add(ok ? 'hop' : 'shake');
      if (ok) burst(box);
    }

    layer.replaceChildren(h('div', { class: `runner-card kind-${kind}` },
      h('div', { class: 'runner-top' },
        h('span', { class: 'chip' }, q.subject),
        dots,
        h('span', { class: 'progress' }, timed ? `${index + 1}もんめ・${score}せいかい` : `${index + 1} / ${questions.length}`),
        h('button', { class: 'close', 'aria-label': 'とじる', onclick: close }, '×'),
      ),
      h('div', { class: 'q-box' },
        h('p', { class: 'prompt' }, q.prompt),
        q.big ? h('p', { class: `big ${kind === 'write' ? 'reading' : ''}` }, q.big) : null,
        q.context ? contextLine(q.context, q.big) : null,
        hintArea(q, () => !next.hidden),
      ),
      answerArea,
      h('div', { class: 'runner-foot' }, feedback, next),
    ));
  }

  function clockText() {
    const left = Math.max(0, Math.ceil((opts.deadline - Date.now()) / 1000));
    return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  }

  function finish() {
    if (finished) return;
    finished = true;
    clearInterval(clockTimer);
    cleanup();
    setTimeout(() => { const b = layer.querySelector('.q-box'); if (b) burst(b, 14); }, 250);
    const total = timed ? results.length : questions.length;
    const perfect = total > 0 && score === total;
    const extra = onFinish(score, total, results);
    layer.replaceChildren(h('div', { class: 'runner-card result' },
      h('div', { class: 'q-box' },
        h('p', { class: 'big' }, perfect ? 'ぜんもんせいかい！' : `${score} / ${total} もん せいかい`),
        h('p', { class: 'prompt' }, perfect ? 'ピヨ先生「かんぺき！あしたもいっしょにがんばろう」' : 'ピヨ先生「まちがえたところは、またやってみようね」'),
        extra ? h('p', { class: 'reward' }, extra) : null,
      ),
      h('button', { class: 'btn primary next', onclick: close }, 'もどる'),
    ));
  }

  document.body.classList.add('running');
  layer.hidden = false;
  render();
  if (timed) {
    clockTimer = setInterval(() => {
      const c = layer.querySelector('.quiz-clock');
      if (c) c.textContent = clockText();
      opts.onTick?.(index);
      if (Date.now() >= opts.deadline) finish();
    }, 1000);
  }
}

// 星がはじけて飛ぶ
function burst(box, count = 8) {
  for (let i = 0; i < count; i += 1) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const d = 70 + Math.random() * 60;
    const star = h('span', { class: 'star-pop', 'aria-hidden': 'true', style: `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 30}px;--r:${Math.round(Math.random() * 180 - 90)}deg` }, icon(i % 3 ? 'star' : 'sparkles'));
    box.append(star);
    setTimeout(() => star.remove(), 800);
  }
}

// ---- 漢字を書く ----------------------------------------------------------------
// いまはノートに書いて自分で答え合わせ。「こたえを見る」でお手本が出て、書けた／書けなかったを押す。
// （Claude で自動判定できるようになったら、ここを指で書く形にもどす）

function writeArea(q, onJudge) {
  const chars = [...q.answerText];
  const boxes = h('div', { class: 'model', 'aria-hidden': 'true' },
    chars.map((c) => h('span', { class: 'cell' }, h('b', {}, c))));
  const reveal = h('button', { class: 'btn primary' }, 'こたえを見る');
  const judgeRow = h('div', { class: 'self-judge', hidden: true },
    h('button', { class: 'judge ok', onclick: () => done(true) }, h('b', {}, '○'), '書けた！'),
    h('button', { class: 'judge ng', onclick: () => done(false) }, h('b', {}, '×'), '書けなかった'));
  const note = h('div', { class: 'notebook' },
    h('span', { class: 'note-ic', 'aria-hidden': 'true' }, icon('notebook-pen')),
    h('p', {}, 'ノートに 書いてみよう'));

  reveal.addEventListener('click', () => {
    reveal.hidden = true;
    note.hidden = true;
    boxes.classList.add('show');
    judgeRow.hidden = false;
  });
  function done(ok) {
    judgeRow.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    judgeRow.classList.add(ok ? 'picked-ok' : 'picked-ng');
    onJudge(ok);
  }
  return h('div', { class: 'write-area' }, note, boxes, reveal, judgeRow);
}

// ---- 算数のメモ ----------------------------------------------------------------

function memoArea(pads) {
  const pad = createInkPad({
    className: 'memo-pad',
    size: 5,
    color: '#5e4a35',
    drawBackground(ctx, w, hgt) {
      ctx.fillStyle = '#fffef9';
      ctx.fillRect(0, 0, w, hgt);
      ctx.strokeStyle = '#efe3cc';
      ctx.lineWidth = 1;
      for (let x = 20; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, hgt); ctx.stroke(); }
      for (let y = 20; y < hgt; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    },
  });
  pads.push(pad);
  return h('div', { class: 'memo' },
    h('div', { class: 'memo-head' },
      h('span', {}, icon('pencil'), ' メモ（指で書けるよ）'),
      h('button', { class: 'link', onclick: () => pad.undo() }, 'もどす'),
      h('button', { class: 'link', onclick: () => pad.clear() }, 'けす')),
    pad.el);
}

function numberPad(onSubmit, answer = 0) {
  let text = '';
  const display = h('div', { class: 'pad-display' }, '　');
  const ok = h('button', { class: 'btn primary pad-ok', disabled: true }, 'こたえる');
  // 答えが小数の問題（とりこんだ小テストなど）は、−のかわりに 小数点 を出す
  const decimal = !Number.isInteger(Number(answer)) && Number(answer) >= 0;
  const keys = ['7', '8', '9', '⌫', '4', '5', '6', decimal ? '.' : '−', '1', '2', '3', '0'];
  let locked = false;

  function update() {
    display.textContent = text || '　';
    ok.disabled = !/\d/.test(text);
  }

  const pad = h('div', { class: 'pad' }, keys.map((k) => h('button', { class: `key ${/\d/.test(k) ? '' : 'fn'}`, onclick: () => {
    if (locked) return;
    if (k === '⌫') text = text.slice(0, -1);
    else if (k === '−') text = text.startsWith('−') ? text.slice(1) : `−${text}`;
    else if (k === '.') { if (!text.includes('.')) text = `${text || '0'}.`; }
    else if (text.replace('−', '').length < 7) text += k;
    update();
  } }, k)));

  ok.addEventListener('click', () => {
    if (locked) return;
    locked = true;
    ok.disabled = true;
    onSubmit(Number(text.replace('−', '-')));
  });

  return h('div', { class: 'number-answer' }, h('div', { class: 'answer-row' }, display, ok), pad);
}

// れいぶん: 「＿」のところに 問題のことばを 線つきで入れる（例: ふるさとの［きょうど］りょうりを 食べる）
function contextLine(sentence, word) {
  const [before, after = ''] = sentence.split('＿');
  return h('p', { class: 'context' }, before, h('span', { class: 'context-word' }, word), after);
}

// ピヨ先生のヒント（AI）。押すたびに 1→2→3 と少しずつ答えに近づく。答えは言わない
function hintArea(q, answered) {
  let level = 0;
  const text = h('p', { class: 'hint-text', hidden: true, role: 'status' });
  const btn = h('button', { class: 'hint-btn', type: 'button' }, icon('lightbulb'), h('span', {}, 'ヒント'));
  btn.onclick = async () => {
    if (answered() || level >= 3 || btn.disabled) return;
    btn.disabled = true;
    text.hidden = false;
    text.classList.add('loading');
    text.textContent = 'ピヨ先生が かんがえ中…';
    const p = currentProfile();
    const answer = q.kind === 'choice' ? q.options[q.answer] : q.kind === 'write' ? q.answerText : String(q.answer);
    try {
      const r = await askAI({ action: 'hint', level: level + 1, subject: q.subject, grade: p ? gradeLabel(p) : '',
        question: [q.prompt, q.big].filter(Boolean).join(' '), context: q.context || '', answer });
      level += 1;
      text.textContent = r.text;
    } catch (e) {
      text.textContent = aiErrorText(e);
    }
    text.classList.remove('loading');
    btn.disabled = level >= 3 || aiLeft() <= 0;
    btn.querySelector('span').textContent = level === 0 ? 'ヒント' : level < 3 ? 'もうすこし ヒント' : 'ヒントは ここまで';
  };
  return h('div', { class: 'hint' }, btn, text);
}
