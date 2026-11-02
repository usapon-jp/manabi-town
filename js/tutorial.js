// はじめてのチュートリアル。説明は短く、タップする場所を指と光る輪で見せる。
// まわりを暗くして、光っている所だけ本当にタップできる。
import { h } from './ui.js';

const STEPS = [
  { text: 'スティックで ピヨを動かそう', target: () => document.getElementById('joy'), tap: 'any', pad: 8 },
  { text: 'ジャンプと ダッシュ', target: () => padButtons(), tap: 'any', pad: 8 },
  { text: 'テストや宿題を 入れよう', target: () => tab('todo'), tap: 'target', open: 'todo' },
  { text: 'ざっくりでOK。毎日の分に わけるよ', target: () => document.querySelector('form.card'), tap: 'any', pad: 6 },
  { text: 'ホームに もどろう', target: () => tab('home'), tap: 'target', open: 'home' },
  { text: 'つぎにやることは ここ', target: () => document.querySelector('.go'), tap: 'any', pad: 6 },
  { text: '毎日つづけて 🔥をのばそう', target: () => document.querySelector('.hud .stats'), tap: 'any', pad: 6 },
  { text: 'もっと⭐がほしいときは 🎁', target: () => document.querySelector('.bonus-btn'), tap: 'any', pad: 6 },
  { text: '毎日のクエストは ここ', target: () => tab('quest'), tap: 'target', open: 'quest' },
  { text: 'タイマーで 勉強を計ろう', target: () => tab('timer'), tap: 'target', open: 'timer' },
];

const tab = (name) => document.querySelector(`.tabs button[data-tab="${name}"]`);

// ジャンプとダッシュのボタンをまとめて光らせる
function padButtons() {
  const a = document.getElementById('btnJump');
  const b = document.getElementById('btnDash');
  if (!a || !b) return null;
  return { getBoundingClientRect: () => {
    const r1 = a.getBoundingClientRect(); const r2 = b.getBoundingClientRect();
    const left = Math.min(r1.left, r2.left); const top = Math.min(r1.top, r2.top);
    return { left, top, width: Math.max(r1.right, r2.right) - left, height: Math.max(r1.bottom, r2.bottom) - top };
  } };
}

export function startTutorial({ show, onDone }) {
  document.querySelector('.tour')?.remove();
  let i = 0;
  const blocks = [0, 1, 2, 3].map(() => h('div', { class: 'tour-dim' }));
  const ring = h('div', { class: 'tour-ring' });
  const hand = h('div', { class: 'tour-hand', 'aria-hidden': 'true' }, '👆');
  const label = h('div', { class: 'tour-label' });
  const count = h('span', { class: 'tour-count' });
  const skip = h('button', { class: 'tour-skip', onclick: () => finish() }, 'とばす');
  const root = h('div', { class: 'tour' }, blocks, ring, hand, label, h('div', { class: 'tour-top' }, count, skip));
  document.body.append(root);

  let rect = null;
  let moving = false; // 次へ進むとちゅうは、タップを数えない
  const onResize = () => place();
  window.addEventListener('resize', onResize);

  function place() {
    const step = STEPS[i];
    document.body.classList.toggle('touring', step.tap === 'target'); // 横向きでもタブを出す
    const el = step.target();
    if (!el) { next(); return; }
    if (el.scrollIntoView && step.tap === 'any') el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const pad = step.pad ?? 4;
    rect = { left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
    const W = window.innerWidth;
    const H = window.innerHeight;
    const right = rect.left + rect.width;
    const bottom = rect.top + rect.height;
    // まわりの4まいで暗くする（光っている所はあいている）
    Object.assign(blocks[0].style, { left: '0', top: '0', width: `${W}px`, height: `${Math.max(0, rect.top)}px` });
    Object.assign(blocks[1].style, { left: '0', top: `${bottom}px`, width: `${W}px`, height: `${Math.max(0, H - bottom)}px` });
    Object.assign(blocks[2].style, { left: '0', top: `${rect.top}px`, width: `${Math.max(0, rect.left)}px`, height: `${rect.height}px` });
    Object.assign(blocks[3].style, { left: `${right}px`, top: `${rect.top}px`, width: `${Math.max(0, W - right)}px`, height: `${rect.height}px` });
    Object.assign(ring.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });

    // 指は下半分の目標なら上から、上半分なら下から
    const below = rect.top + rect.height / 2 < H * 0.5;
    const cx = rect.left + rect.width / 2;
    hand.textContent = below ? '👆' : '👇';
    hand.classList.toggle('from-top', !below);
    Object.assign(hand.style, { left: `${cx - 28}px`, top: below ? `${bottom + 4}px` : `${rect.top - 64}px` });
    label.textContent = step.text;
    const lw = Math.min(W - 32, 300);
    const lx = Math.min(Math.max(16, cx - lw / 2), W - lw - 16);
    Object.assign(label.style, { left: `${lx}px`, width: `${lw}px`, top: below ? `${bottom + 68}px` : 'auto', bottom: below ? 'auto' : `${H - rect.top + 68}px` });
    count.textContent = `${i + 1} / ${STEPS.length}`;
    // 光る所が上のバーにあるときは「とばす」を下に動かして、まちがえて押さないように
    root.classList.toggle('skip-low', rect.top < 90);
  }

  function go(n) {
    i = n;
    rect = null;
    setTimeout(() => { moving = false; }, 450);
    if (i >= STEPS.length) { finish(); return; }
    const step = STEPS[i];
    root.classList.toggle('any', step.tap === 'any');
    setTimeout(place, 120);
    // 画面が切りかわったあとに位置を合わせ直す
    setTimeout(place, 450);
    setTimeout(place, 800);
  }

  function next() { go(i + 1); }

  // 光っている所のタップはそのまま下の画面に届く。届いたあとで次へ
  function onTap(e) {
    if (!rect || moving) return;
    if (e.target === skip) return;
    const step = STEPS[i];
    const x = e.clientX;
    const y = e.clientY;
    const inside = x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height;
    if (step.tap === 'any' || inside) {
      if (step.tap === 'any') { e.preventDefault(); e.stopPropagation(); }
      moving = true;
      setTimeout(() => {
        if (step.open) show(step.open);
        next();
      }, 60);
    } else {
      hand.classList.remove('nudge');
      void hand.offsetWidth;
      hand.classList.add('nudge');
    }
  }
  document.addEventListener('click', onTap, true);
  // スティックやボタンは click ではなく pointer でうごくので、こちらも見る
  const onPointer = (e) => { if (STEPS[i]?.tap === 'any' && rect) onTap(e); };
  document.addEventListener('pointerup', onPointer, true);

  function finish() {
    document.body.classList.remove('touring');
    document.removeEventListener('click', onTap, true);
    document.removeEventListener('pointerup', onPointer, true);
    window.removeEventListener('resize', onResize);
    root.remove();
    show('home');
    onDone?.();
  }

  show('home');
  go(0);
}
