// 立体の 切り口: 立方体を 赤い 3つの 点を 通る 平面で 切ると、切り口は どんな形？
// 点は 頂点と 辺の まん中から えらぶ。切り口は 平面と 12本の 辺の 交わりから 計算する。
// 答えたあと 切り口を 色で 見せる。小4〜小6は「何角形」、中2は 正方形・ひし形・台形 なども。
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
  points.forEach((q) => { const [x, y] = P(q); s += `<circle cx="${x}" cy="${y}" r="7" fill="#e06b5a" stroke="#fff" stroke-width="2"/>`; });
  const w = OX * 2 + S * 1.5; const hgt = OY + 16;
  return `<svg viewBox="0 0 ${w} ${hgt}" width="100%" style="max-width:280px">${s}</svg>`;
}

const FAMILY = [['正三角形', '二等辺三角形', '三角形'], ['正方形', '長方形', 'ひし形', '台形', '平行四辺形'], ['五角形', '六角形', '正六角形']];

function make(level, rand) {
  const detail = level >= 4;
  const kinds = detail ? ['正三角形', '二等辺三角形', '正方形', '長方形', 'ひし形', '台形', '五角形', '六角形', '正六角形']
    : level <= 1 ? ['三角形', '四角形'] : ['三角形', '四角形', '五角形', '六角形'];
  const target = kinds[Math.floor(rand() * kinds.length)];
  let best = null;
  for (let t = 0; t < 3000; t++) {
    const idx = new Set(); while (idx.size < 3) idx.add(Math.floor(rand() * CAND.length));
    const pts = [...idx].map((i) => CAND[i]);
    const poly = cut(pts); if (!poly) continue;
    const name = detail ? classify(poly) : BASIC[poly.length];
    if (!kinds.includes(name)) continue;
    best = { pts, poly, name };
    if (name === target) break;
  }
  const { pts, poly, name } = best;
  let opts;
  if (!detail) opts = level <= 1 ? ['三角形', '四角形', '五角形', '六角形'] : ['三角形', '四角形', '五角形', '六角形'];
  else {
    const fam = FAMILY.find((f) => f.includes(name));
    const same = fam.filter((x) => x !== name).sort(() => rand() - 0.5).slice(0, 2);
    const other = FAMILY.flat().filter((x) => x !== name && !same.includes(x)).sort(() => rand() - 0.5);
    opts = [name, ...same, ...other].slice(0, 4).sort(() => rand() - 0.5);
  }
  return {
    figure: cubeSvg(pts),
    reveal: cubeSvg(pts, poly),
    options: opts,
    answer: opts.indexOf(name),
    note: `切り口は ${name}`,
    cols: 2,
  };
}

const thumb = `<svg viewBox="0 0 48 48"><g stroke="#5e4a35" stroke-width="1.6" fill="none" stroke-linejoin="round"><rect x="5" y="17" width="26" height="26"/><path d="M5 17 L17 7 H43 V33 L31 43 M31 17 L43 7"/></g>
<polygon points="5,25 17,7 31,30" fill="#9cc3dc" fill-opacity="0.8" stroke="#4f86a8" stroke-width="1.5"/></svg>`;

export default { id: 'section', title: '立体の 切り口', sub: '3つの点で 切ると？', round: 5, prompt: '赤い 3つの 点を 通るように 切ると、切り口は どんな形？', thumb, make, mount: choiceMount };
