// 問題を1問ずつ出して答え合わせをする画面（クエストと小テストで共通）
// 画面いっぱいに出して、問題・答えるところ・つぎへ、をはっきり分ける。
import { h } from './ui.js';
import { createInkPad } from './ink/pad.js';
import { icon } from './icons.js';

const PRAISE = ['せいかい！', 'すごい！', 'やったね！', 'ばっちり！'];
export const KYOKASHO = '"UD Digi Kyokasho N-R", "UD デジタル 教科書体 N-R", YuKyokasho, "Klee One", "Hiragino Mincho ProN", serif';

export function runQuestions(title, questions, onFinish) {
  const layer = document.getElementById('runner');
  let index = 0;
  let score = 0;
  let pads = [];

  function cleanup() { pads.forEach((p) => p.destroy()); pads = []; }

  function close() {
    cleanup();
    layer.hidden = true;
    layer.replaceChildren();
    document.body.classList.remove('running');
  }

  function render() {
    cleanup();
    const q = questions[index];
    const feedback = h('div', { class: 'feedback', role: 'status' });
    const next = h('button', { class: 'btn primary next', hidden: true, onclick: () => {
      index += 1;
      if (index < questions.length) render(); else finish();
    } }, index + 1 < questions.length ? 'つぎへ' : 'けっかを見る');

    function judge(ok, answerText) {
      react(ok);
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
        if (ok) score += 1;
        feedback.className = `feedback ${ok ? 'ok' : 'ng'}`;
        feedback.textContent = ok ? `ピヨ先生「${PRAISE[index % PRAISE.length]}」` : 'ピヨ先生「お手本を見て、ノートに3回書いてみよう」';
        next.hidden = false;
      });
    } else {
      kind = 'number';
      answerArea = h('div', { class: 'math-area' },
        memoArea(pads),
        numberPad((value) => judge(value === q.answer, String(q.answer).replace('-', '−'))));
    }

    const dots = h('div', { class: 'dots', 'aria-hidden': 'true' },
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
        h('span', { class: 'progress' }, `${index + 1} / ${questions.length}`),
        h('button', { class: 'close', 'aria-label': 'とじる', onclick: close }, '×'),
      ),
      h('div', { class: 'q-box' },
        h('p', { class: 'prompt' }, q.prompt),
        q.big ? h('p', { class: `big ${kind === 'write' ? 'reading' : ''}` }, q.big) : null,
        q.context ? contextLine(q.context, q.big) : null,
      ),
      answerArea,
      h('div', { class: 'runner-foot' }, feedback, next),
    ));
  }

  function finish() {
    cleanup();
    setTimeout(() => { const b = layer.querySelector('.q-box'); if (b) burst(b, 14); }, 250);
    const perfect = score === questions.length;
    const extra = onFinish(score, questions.length);
    layer.replaceChildren(h('div', { class: 'runner-card result' },
      h('div', { class: 'q-box' },
        h('p', { class: 'big' }, perfect ? 'ぜんもんせいかい！' : `${score} / ${questions.length} もん せいかい`),
        h('p', { class: 'prompt' }, perfect ? 'ピヨ先生「かんぺき！あしたもいっしょにがんばろう」' : 'ピヨ先生「まちがえたところは、またやってみようね」'),
        extra ? h('p', { class: 'reward' }, extra) : null,
      ),
      h('button', { class: 'btn primary next', onclick: close }, 'もどる'),
    ));
  }

  document.body.classList.add('running');
  layer.hidden = false;
  render();
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

function numberPad(onSubmit) {
  let text = '';
  const display = h('div', { class: 'pad-display' }, '　');
  const ok = h('button', { class: 'btn primary pad-ok', disabled: true }, 'こたえる');
  const keys = ['7', '8', '9', '⌫', '4', '5', '6', '−', '1', '2', '3', '0'];
  let locked = false;

  function update() {
    display.textContent = text || '　';
    ok.disabled = !/\d/.test(text);
  }

  const pad = h('div', { class: 'pad' }, keys.map((k) => h('button', { class: `key ${/\d/.test(k) ? '' : 'fn'}`, onclick: () => {
    if (locked) return;
    if (k === '⌫') text = text.slice(0, -1);
    else if (k === '−') text = text.startsWith('−') ? text.slice(1) : `−${text}`;
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
