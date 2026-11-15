// 時計塔の 時計: 針を まわすと 町の 空が かわる（Lv10 の 時計塔を タップすると ひらく）。
// 草原は 見えたまま（.sheet に しない）で、下に 小さな カードを 出す。空が かわるのを 見ながら まわせる。
import { h } from './ui.js';
import { DAY_MIN, JUMP, PHASES, phaseOf, wrap } from './daytime.js';

const SIZE = 210;
const C = SIZE / 2;
const R = 82;
// 分 → 角度（度）。昼の まんなか（20分）が 真上、時計まわりに 夕焼け → 夜 → 朝焼け
const angleOf = (m) => ((m - 20) / DAY_MIN) * 360;
const minuteOf = (deg) => wrap(20 + (deg / 360) * DAY_MIN);
const pt = (deg, r) => { const a = (deg * Math.PI) / 180; return [C + Math.sin(a) * r, C - Math.cos(a) * r]; };
const ARC = { asa: '#e9a6c8', hiru: '#9fd3f2', yugata: '#ffab6b', yoru: '#3e4a8a' };

function arcPath(m0, m1, r) {
  const [x0, y0] = pt(angleOf(m0), r); const [x1, y1] = pt(angleOf(m1), r);
  const large = ((m1 - m0) / DAY_MIN) * 360 > 180 ? 1 : 0;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// world: createWorld の かえりち（clock を つかう）
export function openClockDial(world) {
  if (!world?.clock || document.querySelector('.clock-dial')) return;
  const clock = world.clock;
  let done = false;
  let anim = 0;

  const svg = svgEl('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, width: SIZE, height: SIZE, class: 'cd-face', role: 'slider', 'aria-label': '町の 時計' });
  svg.append(svgEl('circle', { cx: C, cy: C, r: R + 18, fill: '#fffaf0', stroke: '#c7a6ff', 'stroke-width': 6 }));
  for (const p of PHASES) svg.append(svgEl('path', { d: arcPath(p.from, p.to, R), fill: 'none', stroke: ARC[p.id], 'stroke-width': 22 }));
  // 太陽と 月の しるし
  const [sx, sy] = pt(angleOf(20), R - 38);
  svg.append(svgEl('circle', { cx: sx, cy: sy, r: 11, fill: '#ffc94a' }));
  for (let i = 0; i < 8; i++) { const a = i * 45; const [x0, y0] = [sx + Math.sin(a * Math.PI / 180) * 15, sy - Math.cos(a * Math.PI / 180) * 15]; const [x1, y1] = [sx + Math.sin(a * Math.PI / 180) * 19, sy - Math.cos(a * Math.PI / 180) * 19]; svg.append(svgEl('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: '#ffc94a', 'stroke-width': 3, 'stroke-linecap': 'round' })); }
  const [mx, my] = pt(angleOf(52), R - 38);
  svg.append(svgEl('circle', { cx: mx, cy: my, r: 11, fill: '#f6e7a8' }), svgEl('circle', { cx: mx + 5, cy: my - 4, r: 10, fill: '#fffaf0' }));
  const hand = svgEl('g', {});
  hand.append(svgEl('line', { x1: C, y1: C, x2: C, y2: C - R + 4, stroke: '#5a4a7a', 'stroke-width': 6, 'stroke-linecap': 'round' }),
    svgEl('circle', { cx: C, cy: C - R, r: 15, fill: '#ffd45c', stroke: '#fff', 'stroke-width': 4, class: 'cd-knob' }));
  svg.append(hand, svgEl('circle', { cx: C, cy: C, r: 8, fill: '#5a4a7a' }));

  const say = h('p', { class: 'an-say' }, '針を まわすと 空が かわるよ');
  const now = h('b', { class: 'cd-now' });
  const btns = PHASES.map((p) => h('button', { type: 'button', class: `cd-jump ${p.id}`, onclick: () => goTo(JUMP[p.id]) }, p.name));

  function show(m) {
    hand.setAttribute('transform', `rotate(${angleOf(m).toFixed(2)} ${C} ${C})`);
    const ph = phaseOf(m);
    now.textContent = ph.name;
    svg.setAttribute('aria-valuetext', ph.name);
    btns.forEach((b, i) => b.classList.toggle('on', PHASES[i].id === ph.id));
  }
  // ボタン: 時間が 進むように 前へ くるっと（空が 流れて かわるのが 見える）
  function goTo(target) {
    cancelAnimationFrame(anim);
    const from = clock.minute();
    let d = wrap(target - from);
    if (d < 0.2) d = 0;
    const ms = 500 + d * 22;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      const e = 1 - (1 - k) * (1 - k);
      const m = wrap(from + d * e);
      clock.set(m, k >= 1);
      show(m);
      if (k < 1 && !done) anim = requestAnimationFrame(step);
    };
    step();
  }

  // 指で まわす
  let dragging = false;
  const fromPointer = (e) => {
    const r = svg.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2); const dy = e.clientY - (r.top + r.height / 2);
    return minuteOf((Math.atan2(dx, -dy) * 180) / Math.PI);
  };
  svg.addEventListener('pointerdown', (e) => {
    cancelAnimationFrame(anim);
    dragging = true;
    try { svg.setPointerCapture(e.pointerId); } catch (_) { /* 古い端末 */ }
    const m = fromPointer(e); clock.set(m, false); show(m);
  });
  svg.addEventListener('pointermove', (e) => { if (!dragging) return; const m = fromPointer(e); clock.set(m, false); show(m); });
  const end = () => { if (!dragging) return; dragging = false; clock.save(); };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);

  function close() {
    if (done) return;
    done = true;
    cancelAnimationFrame(anim);
    clock.save();
    root.classList.add('gone');
    setTimeout(() => root.remove(), 300);
  }
  const card = h('div', { class: 'an-card cd-card' },
    h('div', { class: 'an-coach' }, h('img', { src: 'assets/icons/icon-192.png', alt: 'ピヨ先生', width: 44, height: 44 }), say),
    h('div', { class: 'cd-body' }, svg, h('div', { class: 'cd-side' }, now, h('div', { class: 'cd-jumps' }, btns))),
    h('button', { type: 'button', class: 'btn cd-close', onclick: close }, 'とじる'));
  const root = h('div', { class: 'clock-dial' }, card);
  show(clock.minute());
  document.body.append(root);
  return { close };
}
