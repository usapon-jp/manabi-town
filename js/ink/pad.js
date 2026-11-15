// 指やペンで書ける板。うさぽんメモの手書きエンジン（input.js / stroke.js）を使う。
// - ペンがあればペン優先、手のひらは無視
// - 2本指でトンとたたくと1つもどす
// - 線は CSS ピクセルで持ち、表示のときに画面の細かさに合わせて描く
// - 指でも すぐ反応するように: 書きはじめに全部を描きなおさない・指の線のおくれを小さく・
//   長おしで文字えらび（iPad）が出て線が消えないように touch の既定の動きを止める
import { InputSession } from './input.js';
import { StrokeBuilder } from './stroke.js';

// 指の線を なめらかにする時間（ms）。うさぽんメモの 28 だと線が指からおくれて「反応が悪い」感じになる
const TOUCH_SMOOTHING_MS = 10;

const radius = (s, pressure) => (s.size / 2) * (0.25 + pressure * 0.75);

function paintSegment(ctx, s, a, b) {
  ctx.fillStyle = s.color;
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(d / Math.max(0.4, Math.min(radius(s, a[2]), radius(s, b[2])) * 0.5)));
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    ctx.beginPath();
    ctx.arc(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, radius(s, a[2] + (b[2] - a[2]) * t), 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintStroke(ctx, s) {
  s.points.forEach((p, i) => paintSegment(ctx, s, s.points[Math.max(0, i - 1)], p));
}

// canvas に書ける板をつくる。{ el, clear, undo, isEmpty, strokes, redraw, onChange }
export function createInkPad({ className = '', color = '#3b3a36', size = 7, drawBackground = null } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = `ink ${className}`;
  canvas.style.touchAction = 'none';
  canvas.style.webkitUserSelect = 'none';
  canvas.style.userSelect = 'none';
  canvas.style.webkitTouchCallout = 'none';
  const ctx = canvas.getContext('2d');
  const strokes = [];
  let builder = null;
  let w = 0; let h = 0; let dpr = 1;
  let changed = () => {};

  function fit() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    redraw();
  }

  function redraw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawBackground?.(ctx, w, h);
    strokes.forEach((s) => paintStroke(ctx, s));
    if (builder) paintStroke(ctx, builder.stroke);
  }

  let rect = null;
  const rectOf = () => rect || canvas.getBoundingClientRect();
  const toLocal = (p) => { const r = rectOf(); return { ...p, x: p.x - r.left, y: p.y - r.top }; };

  const input = new InputSession({
    begin(p) {
      builder = new StrokeBuilder({ tool: 'pen', input: p.type, color, size, time: p.time });
      if (p.type === 'touch') builder.stroke.smoothingMs = TOUCH_SMOOTHING_MS;
      rect = canvas.getBoundingClientRect();   // 1本の線のあいだは 同じ位置（毎回はかると おそくなる）
      builder.sample(toLocal(p));
      // 全部を描きなおさず、さいしょの点だけ描く（線が多くても 指をおいた瞬間に出る）
      const pts = builder.stroke.points;
      if (pts.length) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); paintSegment(ctx, builder.stroke, pts[0], pts[0]); }
    },
    append(p) {
      if (!builder) return;
      const pts = builder.stroke.points;
      const before = pts.length;
      if (builder.sample(toLocal(p)) && pts.length > before) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        paintSegment(ctx, builder.stroke, pts[Math.max(0, pts.length - 2)], pts[pts.length - 1]);
      }
    },
    finish() {
      // 線は もう描いてあるので、描きなおさない（指をはなした瞬間に つぎが書ける）
      if (builder?.stroke.points.length) {
        const s = builder.stroke;
        const last = builder.lastInput;
        const end = s.points[s.points.length - 1];
        // なめらかにした分 指より手前で止まっているので、はなした所まで のばす
        if (last && Math.hypot(last.x - end[0], last.y - end[1]) > 0.5) {
          const tail = [last.x, last.y, end[2], end[3]];
          s.points.push(tail);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          paintSegment(ctx, s, end, tail);
        }
        strokes.push(s);
      }
      builder = null;
      rect = null;
      changed();
    },
    cancel() { builder = null; rect = null; redraw(); },
    undo() { if (strokes.pop()) { redraw(); changed(); } },
  });

  const point = (e) => ({
    id: e.pointerId,
    type: ['pen', 'touch'].includes(e.pointerType) ? e.pointerType : 'mouse',
    x: e.clientX, y: e.clientY, time: e.timeStamp, pressure: e.pressure, buttons: e.buttons,
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* なくても書ける */ }
    input.down(point(e));
  });
  canvas.addEventListener('pointermove', (e) => {
    e.preventDefault();
    const samples = e.getCoalescedEvents?.() || [];
    (samples.length ? samples : [e]).forEach((s) => {
      const p = point(s);
      if (e.pointerType === 'pen') p.buttons = e.buttons;
      input.move(p);
    });
  });
  canvas.addEventListener('pointerup', (e) => { e.preventDefault(); input.up(point(e)); });
  canvas.addEventListener('pointercancel', (e) => input.up(point(e), true));
  canvas.addEventListener('lostpointercapture', (e) => { if (input.pointers.has(e.pointerId)) input.lostCapture(point(e)); });

  // iPad の Safari は pointer だけ止めても、長おしの文字えらび・虫めがねで pointercancel を出して
  // 指の線を消すことがある。touch の既定の動き（スクロール・ズーム・えらぶ）も ここで止める
  const stopTouch = (e) => { if (e.cancelable) e.preventDefault(); };
  canvas.addEventListener('touchstart', stopTouch, { passive: false });
  canvas.addEventListener('touchmove', stopTouch, { passive: false });
  canvas.addEventListener('contextmenu', stopTouch);
  canvas.addEventListener('selectstart', stopTouch);

  const ro = new ResizeObserver(fit);
  ro.observe(canvas);

  return {
    el: canvas,
    clear() { input.cancelAll(); strokes.length = 0; builder = null; redraw(); changed(); },
    undo() { if (strokes.pop()) { redraw(); changed(); } },
    isEmpty: () => strokes.length === 0,
    redraw,
    onChange(fn) { changed = fn; },
    destroy() { ro.disconnect(); input.cancelAll(); },
  };
}
