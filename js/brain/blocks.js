// つみきの かげ: ななめから 見た つみきを、上から・前から 見ると どう見える？ 何こ ある？
// つみきは 高さの 表（たて×よこ）で 作る。前の 列は 後ろより 高くしない（かくれて 見えない ところを 作らない）。
import { choiceMount } from './choice.js';

const A = 24; const B = 14; const Z = 28;   // ななめ図の 大きさ
const INK = '#5e4a35';
const C = ['#f6dd9a', '#e5bd63', '#cf9f45'];

const key = (g) => JSON.stringify(g);

function makeHeights(w, d, k, maxH, rand) {
  const g = Array.from({ length: d }, () => Array(w).fill(0));
  const cells = [[Math.floor(rand() * w), Math.floor(rand() * d)]];
  const has = (x, y) => cells.some(([a, b]) => a === x && b === y);
  while (cells.length < k) {
    const [x, y] = cells[Math.floor(rand() * cells.length)];
    const n = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]][Math.floor(rand() * 4)];
    if (n[0] < 0 || n[1] < 0 || n[0] >= w || n[1] >= d || has(...n)) continue;
    cells.push(n);
  }
  // 後ろ（x,y が 小さい）から じゅんに 高さを きめる。前の マスは 後ろの マスより 高くしない
  cells.sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
  cells.forEach(([x, y]) => {
    let lim = maxH;
    if (x > 0 && g[y][x - 1]) lim = Math.min(lim, g[y][x - 1]);
    if (y > 0 && g[y - 1][x]) lim = Math.min(lim, g[y - 1][x]);
    if (x > 0 && y > 0 && g[y - 1][x - 1]) lim = Math.min(lim, g[y - 1][x - 1]);
    g[y][x] = 1 + Math.floor(rand() * lim);
  });
  return g;
}

const top = (g) => g.map((r) => r.map((v) => (v ? 1 : 0)));
const front = (g) => g[0].map((_, x) => Math.max(...g.map((r) => r[x])));   // 前（左下）から: よこに x
const side = (g) => g.map((r) => Math.max(...r)).reverse();                 // 右（右下）から 見た形（まちがいの 見本）
const count = (g) => g.flat().reduce((a, b) => a + b, 0);

function iso(g) {
  const d = g.length; const w = g[0].length;
  const cubes = [];
  for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) for (let z = 0; z < g[y][x]; z++) cubes.push([x, y, z]);
  cubes.sort((p, q) => p[0] + p[1] - (q[0] + q[1]) || p[2] - q[2]);
  const P = (x, y, z) => [(x - y) * A, (x + y) * B - z * Z];
  let s = '';
  cubes.forEach(([x, y, z]) => {
    const t = [P(x, y, z + 1), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)];
    const l = [P(x, y + 1, z + 1), P(x + 1, y + 1, z + 1), P(x + 1, y + 1, z), P(x, y + 1, z)];
    const r = [P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x + 1, y + 1, z), P(x + 1, y, z)];
    const poly = (pts, c) => `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${c}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
    s += poly(t, C[0]) + poly(l, C[1]) + poly(r, C[2]);
  });
  // 「前」の しるし（左下から 見る）
  const f = P(w * 0.3, d + 1.2, 0);
  s += `<g transform="translate(${f[0] - 30},${f[1] + 6})"><path d="M0 0 l18 -11" stroke="#d98a74" stroke-width="3.5" stroke-linecap="round"/><path d="M18 -11 l-9 0 M18 -11 l-4 8" stroke="#d98a74" stroke-width="3.5" stroke-linecap="round"/>
<text x="-6" y="18" font-size="17" font-weight="800" fill="#d98a74" text-anchor="middle">前</text></g>`;
  // 見える 部分に 合わせて わくを きめる
  const xs = []; const ys = [];
  cubes.forEach(([x, y, z]) => [[x, y, z + 1], [x + 1, y, z], [x, y + 1, z], [x + 1, y + 1, z]].forEach((q) => { const [X, Y] = P(...q); xs.push(X); ys.push(Y); }));
  xs.push(f[0] - 40, f[0] - 8); ys.push(f[1] + 28);
  const minX = Math.min(...xs) - 8; const maxX = Math.max(...xs) + 8; const minY = Math.min(...ys) - 8; const maxY = Math.max(...ys) + 4;
  return `<svg viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" width="100%" style="max-width:300px;max-height:260px">${s}</svg>`;
}

// 上から（ななめの まま ひし形で）
function topSvg(t) {
  const d = t.length; const w = t[0].length;
  const a = 15; const b = 9;
  let s = '';
  for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) {
    const X = (x - y) * a; const Y = (x + y) * b;
    s += `<polygon points="${X},${Y} ${X + a},${Y + b} ${X},${Y + 2 * b} ${X - a},${Y + b}" fill="${t[y][x] ? '#e5bd63' : '#f4ecdc'}" stroke="${t[y][x] ? INK : '#e2d3b7'}" stroke-width="${t[y][x] ? 1.3 : 1}"/>`;
  }
  return `<svg viewBox="${-d * a - 4} -4 ${(w + d) * a + 8} ${(w + d) * b + 8}" width="100%">${s}</svg>`;
}

function colSvg(cols, maxH) {
  const u = 16; const W = cols.length * u; const H = maxH * u;
  let s = `<line x1="-4" y1="${H}" x2="${W + 4}" y2="${H}" stroke="#b5a792" stroke-width="2"/>`;
  cols.forEach((v, i) => { for (let z = 0; z < v; z++) s += `<rect x="${i * u}" y="${H - (z + 1) * u}" width="${u}" height="${u}" fill="#e5bd63" stroke="${INK}" stroke-width="1.2"/>`; });
  return `<svg viewBox="-6 -4 ${W + 12} ${H + 8}" width="100%">${s}</svg>`;
}

function shuffle(a, rand) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

function options(correct, wrongs, n, rand) {
  const seen = new Set([key(correct)]); const out = [correct];
  for (const wv of wrongs) { if (out.length >= n) break; if (!wv) continue; const k = key(wv); if (seen.has(k)) continue; seen.add(k); out.push(wv); }
  const order = shuffle(out.map((_, i) => i), rand);
  return { list: order.map((i) => out[i]), answer: order.indexOf(0) };
}

function make(level, rand) {
  const w = level >= 5 ? 4 : 3; const d = 3;
  const maxH = level <= 1 ? 2 : 3;
  const k = Math.min(w * d - 1, 4 + Math.min(level, 4) + Math.floor(rand() * 2));
  const types = level <= 1 ? ['top'] : level <= 3 ? ['top', 'front', 'front'] : ['top', 'front', 'count', 'count'];
  const type = types[Math.floor(rand() * types.length)];
  const g = makeHeights(w, d, k, maxH, rand);
  const n = level <= 1 ? 3 : 4;

  if (type === 'count') {
    const c = count(g);
    const { list, answer } = options(c, shuffle([c - 1, c + 1, c + 2, c - 2, c + 3], rand).filter((v) => v > 0), 4, rand);
    return { prompt: 'つみきは ぜんぶで 何こ？', figure: iso(g), options: list.map((v) => `${v}こ`), answer, note: 'かくれて 見えない つみきも 数えよう' };
  }
  if (type === 'front') {
    const f = front(g); const mh = Math.max(...f, ...side(g)) + 1;
    const wrongs = [side(g), f.slice().reverse()];
    for (let t = 0; t < 12; t++) { const m = f.slice(); const i = Math.floor(rand() * m.length); m[i] = Math.max(0, Math.min(maxH, m[i] + (rand() < 0.5 ? 1 : -1))); if (m.some((v) => v)) wrongs.push(m); }
    const { list, answer } = options(f, wrongs, n, rand);
    return { prompt: '「前」から 見ると どの形？', figure: iso(g), options: list.map((c) => colSvg(c, mh)), answer };
  }
  const t = top(g);
  const wrongs = [];
  if (w === d) wrongs.push(t[0].map((_, x) => t.map((r) => r[x])));   // ななめに うらがえし
  wrongs.push(t.map((r) => r.slice().reverse()));
  for (let i = 0; i < 12; i++) {
    const m = t.map((r) => r.slice());
    const y = Math.floor(rand() * d); const x = Math.floor(rand() * w);
    m[y][x] = 1 - m[y][x];
    if (m.flat().some((v) => v)) wrongs.push(m);
  }
  const { list, answer } = options(t, wrongs, n, rand);
  return { prompt: '真上から 見ると どの形？', figure: iso(g), options: list.map(topSvg), answer };
}

const thumb = `<svg viewBox="0 0 48 48"><g stroke="#5e4a35" stroke-width="1.3" stroke-linejoin="round">
<polygon points="24,6 36,13 24,20 12,13" fill="#f6dd9a"/><polygon points="12,13 24,20 24,32 12,25" fill="#e5bd63"/><polygon points="36,13 24,20 24,32 36,25" fill="#cf9f45"/>
<polygon points="12,25 24,32 12,39 0,32" fill="#f6dd9a" transform="translate(4,0)"/><polygon points="36,25 48,32 36,39 24,32" fill="#f6dd9a" transform="translate(-4,0)"/></g></svg>`;

export default { id: 'blocks', title: 'つみきの かげ', sub: '上から・前から 見ると？', time: 60, target: 6, thumb, make, mount: choiceMount };
