import { h } from '../ui.js';

// ---- 答えを えらぶ ゲームの 共通部品 ----
// puzzle: { figure: svg文字, options: [svg文字 or 文字], answer: 番号, reveal?: 答えたあとの svg, cols?: 2 }
export function choiceMount(el, puzzle, done) {
  const fig = h('div', { class: 'q-box bz-fig', html: puzzle.figure });
  let answered = false;
  const buttons = puzzle.options.map((o, k) => {
    const b = h('button', { type: 'button', class: `option bz-opt${typeof o === 'string' && o.startsWith('<svg') ? ' pic' : ''}`, style: `--i:${k}`, onclick: () => {
      if (answered) return;
      answered = true;
      const ok = k === puzzle.answer;
      buttons.forEach((x, j) => { x.disabled = true; if (j === puzzle.answer) x.classList.add('correct'); });
      if (!ok) b.classList.add('wrong');
      if (puzzle.reveal) fig.innerHTML = puzzle.reveal;
      if (puzzle.note) fig.append(h('p', { class: 'bz-note' }, puzzle.note));
      done(ok);
    } });
    if (typeof o === 'string' && o.startsWith('<svg')) b.innerHTML = o; else b.textContent = o;
    return b;
  });
  el.append(fig, ...(puzzle.tip ? [h('p', { class: 'bz-tip' }, puzzle.tip)] : []), h('div', { class: `options bz-opts cols-${puzzle.cols || (buttons.length === 4 ? 2 : buttons.length)}` }, buttons));
}
