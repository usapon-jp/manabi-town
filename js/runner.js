// 問題を1問ずつ出して答え合わせをする画面（クエストと小テストで共通）
import { h } from './ui.js';

const PRAISE = ['せいかい！', 'すごい！', 'やったね！', 'ばっちり！'];

export function runQuestions(title, questions, onFinish) {
  const layer = document.getElementById('runner');
  let index = 0;
  let score = 0;

  function close() {
    layer.hidden = true;
    layer.replaceChildren();
  }

  function render() {
    const q = questions[index];
    const feedback = h('div', { class: 'feedback' });
    const next = h('button', { class: 'btn primary', hidden: true, onclick: () => {
      index += 1;
      if (index < questions.length) render(); else finish();
    } }, index + 1 < questions.length ? 'つぎへ' : 'けっかを見る');

    function judge(ok, answerText) {
      if (ok) score += 1;
      feedback.className = `feedback ${ok ? 'ok' : 'ng'}`;
      feedback.textContent = ok
        ? `ピヨ先生「${PRAISE[index % PRAISE.length]}」`
        : `ピヨ先生「おしい！こたえは ${answerText} だよ」`;
      next.hidden = false;
    }

    let answerArea;
    if (q.kind === 'choice') {
      const buttons = q.options.map((opt, i) => h('button', { class: 'option', onclick: () => {
        buttons.forEach((b) => { b.disabled = true; });
        buttons[q.answer].classList.add('correct');
        if (i !== q.answer) buttons[i].classList.add('wrong');
        judge(i === q.answer, q.options[q.answer]);
      } }, opt));
      answerArea = h('div', { class: 'options' }, buttons);
    } else {
      answerArea = numberPad((value) => judge(value === q.answer, String(q.answer).replace('-', '−')));
    }

    layer.replaceChildren(h('div', { class: 'runner-card' },
      h('div', { class: 'runner-top' },
        h('span', { class: 'chip' }, q.subject),
        h('span', { class: 'progress' }, `${index + 1} / ${questions.length}`),
        h('button', { class: 'close', 'aria-label': 'とじる', onclick: close }, '×'),
      ),
      h('p', { class: 'prompt' }, q.prompt),
      q.big ? h('p', { class: 'big' }, q.big) : null,
      answerArea,
      feedback,
      next,
    ));
  }

  function finish() {
    const perfect = score === questions.length;
    const extra = onFinish(score, questions.length);
    layer.replaceChildren(h('div', { class: 'runner-card result' },
      h('p', { class: 'big' }, perfect ? 'ぜんもんせいかい！' : `${score} / ${questions.length} もん せいかい`),
      h('p', { class: 'prompt' }, perfect ? 'ピヨ先生「かんぺき！あしたもいっしょにがんばろう」' : 'ピヨ先生「まちがえたところは、またやってみようね」'),
      extra ? h('p', { class: 'reward' }, extra) : null,
      h('button', { class: 'btn primary', onclick: close }, 'もどる'),
    ));
  }

  layer.hidden = false;
  render();
}

function numberPad(onSubmit) {
  let text = '';
  const display = h('div', { class: 'pad-display' }, '　');
  const ok = h('button', { class: 'btn primary pad-ok', disabled: true }, 'こたえる');
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '−', '0', '⌫'];
  let locked = false;

  function update() {
    display.textContent = text || '　';
    ok.disabled = !/\d/.test(text);
  }

  const pad = h('div', { class: 'pad' }, keys.map((k) => h('button', { class: 'key', onclick: () => {
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

  return h('div', { class: 'number-answer' }, display, pad, ok);
}
