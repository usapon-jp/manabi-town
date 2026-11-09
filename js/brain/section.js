// 立体の 切り口: 立方体を 赤い 3つの 点を 通る 平面で 切ると、切り口は どんな形？
// 点は 頂点と 辺の まん中から えらぶ。切り口は 平面と 12本の 辺の 交わりから 計算する。
// 答えたあと 切り口を 色で 見せる。えらぶのは 切り口の ほんとうの 形（4つの 図から）。小学生は 角の数が ちがう 形から、中学生は 似た 形からも えらぶ。
import * as THREE from 'three';
import { h } from '../ui.js';
import { choiceMount } from './choice.js';

const INK = '#5e4a35';
const V = []; for (let i = 0; i < 8; i++) V.push([i & 1, (i >> 1) & 1, (i >> 2) & 1]);
const E = []; for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) { const d = V[a].reduce((n, v, i) => n + Math.abs(v - V[b][i]), 0); if (d === 1) E.push([a, b]); }
const CAND = [...V, ...E.map(([a, b]) => V[a].map((v, i) => (v + V[b][i]) / 2))];

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
const eq = (a, b) => Math.abs(a - b) < 1e-6;

function cut(p) {
  const n = cross(sub(p[1], p[0]), sub(p[2], p[0]));
  if (len(n) < 1e-6) return null;
  const d = dot(n, p[0]);
  const s = V.map((v) => dot(n, v) - d);
  const pts = [];
  const add = (q) => { if (!pts.some((x) => len(sub(x, q)) < 1e-6)) pts.push(q); };
  V.forEach((v, i) => { if (Math.abs(s[i]) < 1e-9) add(v); });
  E.forEach(([a, b]) => { if (s[a] * s[b] < -1e-12) { const t = s[a] / (s[a] - s[b]); add(V[a].map((v, i) => v + (V[b][i] - v) * t)); } });
  if (pts.length < 3) return null;
  // 面と 同じ（ぜんぶ 同じ面の上）なら 切っていない
  for (let ax = 0; ax < 3; ax++) for (const c of [0, 1]) if (pts.every((q) => eq(q[ax], c))) return null;
  const c = pts.reduce((a, q) => a.map((v, i) => v + q[i] / pts.length), [0, 0, 0]);
  const u = sub(pts[0], c); const w = cross(n, u);
  pts.sort((A, B) => Math.atan2(dot(sub(A, c), w), dot(sub(A, c), u)) - Math.atan2(dot(sub(B, c), w), dot(sub(B, c), u)));
  return pts;
}

const BASIC = { 3: '三角形', 4: '四角形', 5: '五角形', 6: '六角形' };
function classify(pts) {
  const k = pts.length;
  const side = pts.map((q, i) => len(sub(pts[(i + 1) % k], q)));
  const allEq = side.every((v) => eq(v, side[0]));
  if (k === 3) return allEq ? '正三角形' : (eq(side[0], side[1]) || eq(side[1], side[2]) || eq(side[0], side[2])) ? '二等辺三角形' : '三角形';
  if (k === 4) {
    const d1 = len(sub(pts[2], pts[0])); const d2 = len(sub(pts[3], pts[1]));
    const par = (i) => { const a = sub(pts[(i + 1) % 4], pts[i]); const b = sub(pts[(i + 3) % 4], pts[(i + 2) % 4]); return len(cross(a, b)) < 1e-6; };
    if (allEq && eq(d1, d2)) return '正方形';
    if (allEq) return 'ひし形';
    if (eq(side[0], side[2]) && eq(side[1], side[3])) return eq(d1, d2) ? '長方形' : '平行四辺形';
    if (par(0) || par(1)) return '台形';
    return '四角形';
  }
  if (k === 6 && allEq) return '正六角形';
  return BASIC[k];
}

// ななめから 見た 立方体（x 右・y おく・z 上）
const S = 120; const OX = 16; const OY = 16 + S * 1.36;
const P = (q) => [OX + S * q[0] + S * 0.5 * q[1], OY - S * q[2] - S * 0.36 * q[1]];
function cubeSvg(points, poly) {
  let s = '';
  if (poly) s += `<polygon points="${poly.map((q) => P(q).map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="#9cc3dc" fill-opacity="0.75" stroke="#4f86a8" stroke-width="2.5" stroke-linejoin="round"/>`;
  const hidden = 2;   // (0,1,0) は うしろの 下の 左。ここに つながる 辺は 見えない
  E.forEach(([a, b]) => {
    const [x1, y1] = P(V[a]); const [x2, y2] = P(V[b]);
    const hid = a === hidden || b === hidden;
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="${hid ? 1.5 : 2.2}" ${hid ? 'stroke-dasharray="5 5" opacity="0.6"' : ''} stroke-linecap="round"/>`;
  });
  if (!poly && points.length === 3) s += `<polygon points="${points.map((q) => P(q).map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="#e06b5a" fill-opacity="0.12" stroke="#e06b5a" stroke-width="2" stroke-dasharray="4 4" stroke-linejoin="round"/>`;
  points.forEach((q) => { const [x, y] = P(q); s += `<circle cx="${x}" cy="${y}" r="7" fill="#e06b5a" stroke="#fff" stroke-width="2"/>`; });
  const w = OX * 2 + S * 1.5; const hgt = OY + 16;
  return `<svg viewBox="0 0 ${w} ${hgt}" width="100%" style="max-width:280px">${s}</svg>`;
}

// すべての 3点の 組みあわせで 切り口を 先に 作っておく（20点から 3つ = 1140とおり）
let POOL = null;
function pool() {
  if (POOL) return POOL;
  POOL = [];
  for (let a = 0; a < CAND.length; a++) for (let b = a + 1; b < CAND.length; b++) for (let c = b + 1; c < CAND.length; c++) {
    const pts = [CAND[a], CAND[b], CAND[c]];
    const poly = cut(pts); if (!poly) continue;
    const n = cross(sub(poly[1], poly[0]), sub(poly[2], poly[0])).map(Math.abs).sort((x, y) => y - x);
    const r = n.map((v) => Math.round((v / n[0]) * 100) / 100).join();
    POOL.push({ pts, poly, name: classify(poly), k: poly.length, easy: r === '1,0,0' || r === '1,1,0' || r === '1,1,1' });
  }
  return POOL;
}

// 切り口の ほんとうの 形（まっすぐ 見た形）。いちばん 長い 辺を 下に して わくに おさめる
function shapeSvg(poly) {
  const k = poly.length;
  const n = cross(sub(poly[1], poly[0]), sub(poly[2], poly[0]));
  let bi = 0; let bl = 0;
  poly.forEach((q, i) => { const l = len(sub(poly[(i + 1) % k], q)); if (l > bl + 1e-6) { bl = l; bi = i; } });
  const o = poly[bi];
  const u = sub(poly[(bi + 1) % k], o).map((v) => v / bl);
  const nn = n.map((v) => v / len(n));
  const w = cross(nn, u);
  let pts = poly.map((q) => [dot(sub(q, o), u), dot(sub(q, o), w)]);
  if (pts.some(([, y]) => y < -1e-6)) pts = pts.map(([x, y]) => [x, -y]);
  const xs = pts.map((q) => q[0]); const ys = pts.map((q) => q[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const maxY = Math.max(...ys);
  const sc = 70 / Math.max(maxX - minX, maxY, 0.01);
  const ox = 45 - ((maxX + minX) / 2) * sc; const oy = 45 + (maxY / 2) * sc;
  const d = pts.map(([x, y]) => `${(ox + x * sc).toFixed(1)},${(oy - y * sc).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 90 90" width="100%"><polygon points="${d}" fill="#cfe3ec" stroke="#4f86a8" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
}


// ---- くるくる 回せる 3D ----
let live = null;
const T = (q) => new THREE.Vector3(q[0] - 0.5, q[2] - 0.5, -(q[1] - 0.5));
function view3d(box, puzzle) {
  if (live) { live.dispose(); live = null; }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return null; }
  renderer.localClippingEnabled = true;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const W = 280; renderer.setSize(W, 250);
  const cv = renderer.domElement; cv.style.cssText = 'width:100%;max-width:280px;height:auto;touch-action:none;display:block;margin:0 auto;cursor:grab';
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(36, W / 250, 0.1, 20);
  let th = -0.55; let ph = 0.5;
  const place = () => { const r = 4.3; cam.position.set(r * Math.cos(ph) * Math.sin(th), r * Math.sin(ph), r * Math.cos(ph) * Math.cos(th)); cam.lookAt(0, 0, 0); };
  const pts = puzzle.pts; const poly = puzzle.poly;
  const nD = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
  const n = T([nD[0] + 0.5, nD[1] + 0.5, nD[2] + 0.5]).sub(T([0.5, 0.5, 0.5])).normalize();
  const p0 = T(pts[0]);
  const pc = n.dot(p0);
  const mkPiece = (sign) => {
    const g = new THREE.Group();
    const plane = new THREE.Plane(n.clone().multiplyScalar(-sign), sign * pc);
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: sign < 0 ? 0xfff1d6 : 0xeaf3df, transparent: true, opacity: 0.45, side: THREE.DoubleSide, clippingPlanes: [plane], depthWrite: false }));
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0x5e4a35, clippingPlanes: [plane] }));
    g.add(m, l); scene.add(g);
    return { g, plane, sign };
  };
  const full = new THREE.Group();
  full.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })));
  full.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0x5e4a35 })));
  scene.add(full);
  const A = mkPiece(1); const B = mkPiece(-1); A.g.visible = B.g.visible = false;
  const dots = new THREE.Group();
  pts.forEach((q) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe06b5a, depthTest: false })); d.position.copy(T(q)); d.renderOrder = 5; dots.add(d); });
  const tri = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.map(T)), new THREE.LineDashedMaterial({ color: 0xe06b5a, dashSize: 0.05, gapSize: 0.04, depthTest: false }));
  tri.computeLineDistances(); tri.renderOrder = 4; dots.add(tri);
  scene.add(dots);
  const face = (shift) => {
    const v = poly.map(T); const c = v.reduce((a, q) => a.add(q), new THREE.Vector3()).divideScalar(v.length);
    const pos = []; v.forEach((q, i) => { const r = v[(i + 1) % v.length]; pos.push(c.x, c.y, c.z, q.x, q.y, q.z, r.x, r.y, r.z); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x6fb0d6, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false })));
    grp.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(v), new THREE.LineBasicMaterial({ color: 0x2f6f95, depthTest: false })));
    grp.renderOrder = 3; grp.children.forEach((o) => { o.renderOrder = 3; });
    return grp;
  };
  const faceA = face(); const faceB = face(); faceA.visible = faceB.visible = false; scene.add(faceA, faceB);
  let t = 0; let goal = 0; let busy = false;
  const apply = () => {
    const k = 0.42 * t;
    const on = t > 0.001;
    full.visible = !on; A.g.visible = B.g.visible = on; faceA.visible = on; faceB.visible = on; tri.visible = !on || t < 0.5;
    B.g.position.copy(n).multiplyScalar(k); faceB.position.copy(n).multiplyScalar(k);
    A.plane.constant = pc; B.plane.constant = -(pc + k);
    A.plane.normal.copy(n).multiplyScalar(-1); B.plane.normal.copy(n);
    A.plane.constant = pc; 
  };
  const draw = () => { place(); renderer.render(scene, cam); };
  const tick = () => { const d = goal - t; if (Math.abs(d) < 0.01) { t = goal; busy = false; } else { t += d * 0.14; requestAnimationFrame(tick); } apply(); draw(); };
  const go = (g) => { goal = g; if (!busy) { busy = true; requestAnimationFrame(tick); } };
  let down = null;
  cv.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
  cv.addEventListener('pointermove', (e) => { if (!down) return; th -= (e.clientX - down[0]) * 0.012; ph = Math.max(-1.3, Math.min(1.3, ph + (e.clientY - down[1]) * 0.012)); down = [e.clientX, e.clientY]; draw(); });
  const up = () => { down = null; cv.style.cursor = 'grab'; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  apply(); draw();
  box.append(cv);
  live = { go, dispose: () => { renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) { /* */ } } };
  return live;
}

function mountSection(el, puzzle, done) {
  let v = null; let fig3 = null;
  choiceMount(el, puzzle, (ok) => { if (v) { v.go(1); if (fig3) fig3.append(h('p', { class: 'bz-note' }, puzzle.note)); } done(ok); });
  const figEl = el.querySelector('.bz-fig');
  if (puzzle.src) {
    const box = h('div', { class: 'q-box bz-fig bz-3d' });
    v = view3d(box, puzzle.src);
    if (v) {
      fig3 = box; figEl.replaceWith(box);
      const btn = h('button', { type: 'button', class: 'bz-cutbtn' }, 'きって みる');
      let cutOn = false;
      btn.onclick = () => { cutOn = !cutOn; v.go(cutOn ? 1 : 0); btn.textContent = cutOn ? 'もとに もどす' : 'きって みる'; };
      box.append(h('p', { class: 'bz-tip' }, 'ゆびで くるくる まわせるよ'), btn);
      new MutationObserver(() => { btn.textContent = 'もとに もどす'; }).observe(el, { subtree: true, attributes: true, attributeFilter: ['disabled'] });
    }
  }
  return () => { if (v) v.dispose(); if (live === v) live = null; };
}

function make(level, rand) {
  const easyMode = level <= 1;
  const all = easyMode ? pool().filter((c) => c.easy) : pool();
  const kinds = easyMode ? ['正三角形', '正方形', '長方形'] : level >= 4 ? ['正三角形', '二等辺三角形', '正方形', '長方形', 'ひし形', '台形', '五角形', '正六角形']
    : level <= 1 ? ['正三角形', '二等辺三角形', '正方形', '長方形'] : ['正三角形', '二等辺三角形', '長方形', 'ひし形', '台形', '五角形', '正六角形'];
  const target = kinds[Math.floor(rand() * kinds.length)];
  const hits = all.filter((c) => c.name === target);
  const right = hits[Math.floor(rand() * hits.length)];
  // まちがいの 形: 小学生は 角の数が ちがう 形、中学生は 角の数が 同じでも 形が ちがうもの
  const others = all.filter((c) => c.name !== right.name && (level >= 4 || easyMode || c.k !== right.k));
  const picked = []; const names = new Set([right.name]);
  for (const c of others.slice().sort(() => rand() - 0.5)) {
    if (picked.length >= 3) break;
    if (names.has(c.name)) continue;
    names.add(c.name); picked.push(c);
  }
  const opts = [right, ...picked].sort(() => rand() - 0.5);
  return {
    src: right,
    figure: cubeSvg(right.pts),
    reveal: cubeSvg(right.pts, right.poly),
    options: opts.map((c) => shapeSvg(c.poly)),
    answer: opts.indexOf(right),
    note: `切り口は ${right.name}`,
    tip: easyMode ? 'てんせんの 面で 切ったときの 形を さがそう' : '赤い 点を むすぶ 線に そって 切るよ',
    cols: 2,
  };
}

const thumb = `<svg viewBox="0 0 48 48"><g stroke="#5e4a35" stroke-width="1.6" fill="none" stroke-linejoin="round"><rect x="5" y="17" width="26" height="26"/><path d="M5 17 L17 7 H43 V33 L31 43 M31 17 L43 7"/></g>
<polygon points="5,25 17,7 31,30" fill="#9cc3dc" fill-opacity="0.8" stroke="#4f86a8" stroke-width="1.5"/></svg>`;

export default { id: 'section', title: '立体の 切り口', sub: '3つの点で 切ると？', time: 60, target: 5, prompt: '赤い 3つの 点を 通るように 切ると、切り口は どんな形？', thumb, make, mount: mountSection };
