// きまり さがし: ならびの きまりを 見つけて「？」に 入るものを えらぶ。
// 小4: 形と色の くりかえし → 小6: 2つの きまり・矢じるしの 回転・数 → 中2: 数の きまり（差が ふえる・2倍・2つ まざる など）
import { choiceMount } from './choice.js';

const INK = '#5e4a35';
const COLORS = ['#f3a8b5', '#f0cf7a', '#9cc3dc', '#8fa871'];
const SHAPES = ['cir', 'tri', 'sq', 'star', 'heart'];

function tok(t, size = 40) {
  const c = t.c; const r = size / 2; const m = r;
  let body = '';
  if (t.s === 'cir') body = `<circle cx="${m}" cy="${m}" r="${r * 0.62}" fill="${c}" stroke="${INK}" stroke-width="1.6"/>`;
  else if (t.s === 'tri') body = `<path d="M${m} ${m - r * 0.68} L${m + r * 0.72} ${m + r * 0.56} L${m - r * 0.72} ${m + r * 0.56}Z" fill="${c}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
  else if (t.s === 'sq') body = `<rect x="${m - r * 0.56}" y="${m - r * 0.56}" width="${r * 1.12}" height="${r * 1.12}" rx="3" fill="${c}" stroke="${INK}" stroke-width="1.6"/>`;
  else if (t.s === 'star') {
    const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.3 : r * 0.7; pts.push(`${(m + rr * Math.cos(a)).toFixed(1)},${(m + rr * Math.sin(a)).toFixed(1)}`); }
    body = `<polygon points="${pts.join(' ')}" fill="${c}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;
  } else if (t.s === 'heart') body = `<path d="M${m} ${m + r * 0.55} C${m - r * 0.9} ${m - r * 0.05} ${m - r * 0.45} ${m - r * 0.75} ${m} ${m - r * 0.3} C${m + r * 0.45} ${m - r * 0.75} ${m + r * 0.9} ${m - r * 0.05} ${m} ${m + r * 0.55}Z" fill="${c}" stroke="${INK}" stroke-width="1.5"/>`;
  else if (t.s === 'arrow') body = `<g transform="rotate(${t.d * 90} ${m} ${m})"><path d="M${m} ${m - r * 0.7} L${m + r * 0.5} ${m - r * 0.1} H${m + r * 0.2} V${m + r * 0.65} H${m - r * 0.2} V${m - r * 0.1} H${m - r * 0.5}Z" fill="${c}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/></g>`;
  return `<svg viewBox="0 0 ${size} ${size}" width="100%">${body}</svg>`;
}

const tkey = (t) => (typeof t === 'number' ? `n${t}` : `${t.s}|${t.c}|${t.d ?? ''}`);

function seqFigure(items, gap) {
  const cells = items.map((t, i) => {
    if (i === gap) return '<div class="bz-seq q">？</div>';
    return `<div class="bz-seq${typeof t === 'number' ? ' num' : ''}">${typeof t === 'number' ? t : tok(t)}</div>`;
  }).join('');
  return `<div class="bz-seqs">${cells}</div>`;
}

const pick = (a, rand) => a[Math.floor(rand() * a.length)];
function shuf(a, rand) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

// ---- 形の きまり ----
function shapeRepeat(rand) {
  const units = ['AB', 'AAB', 'ABB', 'ABC', 'AABB', 'ABCB'];
  const u = pick(units, rand);
  const sh = shuf(SHAPES, rand); const co = shuf(COLORS, rand);
  const map = { A: { s: sh[0], c: co[0] }, B: { s: sh[1], c: co[1] }, C: { s: sh[2], c: co[2] } };
  const len = Math.max(7, u.length * 2 + 1);
  return Array.from({ length: len + 1 }, (_, i) => ({ ...map[u[i % u.length]] }));
}
function twoRules(rand) {
  const p1 = pick([2, 3], rand); const p2 = p1 === 2 ? 3 : pick([2, 4], rand);
  const sh = shuf(SHAPES, rand).slice(0, p1); const co = shuf(COLORS, rand).slice(0, p2);
  return Array.from({ length: 9 }, (_, i) => ({ s: sh[i % p1], c: co[i % p2] }));
}
function arrows(rand) {
  const step = pick([1, 3, 1, 2], rand); const d0 = Math.floor(rand() * 4);
  const co = shuf(COLORS, rand); const cp = pick([1, 2, 3], rand);
  return Array.from({ length: 8 }, (_, i) => ({ s: 'arrow', d: (d0 + i * step) % 4, c: co[i % cp] }));
}
function tokenOptions(seq, ans, rand) {
  const right = seq[ans];
  const pool = [];
  SHAPES.forEach((s) => pool.push({ ...right, s }));
  COLORS.forEach((c) => pool.push({ ...right, c }));
  if (right.s === 'arrow') [0, 1, 2, 3].forEach((d) => pool.push({ ...right, d }));
  seq.forEach((t) => pool.push(t));
  const out = [right]; const seen = new Set([tkey(right)]);
  for (const t of shuf(pool, rand)) { if (out.length >= 4) break; if (right.s === 'arrow' && t.s !== 'arrow') continue; const kk = tkey(t); if (seen.has(kk)) continue; seen.add(kk); out.push(t); }
  return out;
}

// ---- 数の きまり ----
function numbers(level, rand) {
  const r = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const easy = [
    () => { const a = r(1, 20); const d = r(2, 9); return Array.from({ length: 7 }, (_, i) => a + d * i); },
    () => { const d = r(2, 8); const a = d * 6 + r(1, 20); return Array.from({ length: 7 }, (_, i) => a - d * i); },
    () => { const a = r(1, 3); return Array.from({ length: 7 }, (_, i) => a * 2 ** i); },
    () => { const a = r(1, 10); const p = r(2, 5); const q = r(1, 3); const s = [a]; for (let i = 1; i < 8; i++) s.push(s[i - 1] + (i % 2 ? p : -q)); return s; },
  ];
  const hard = [
    () => { const a = r(1, 10); const d = r(1, 3); const s = [a]; for (let i = 1; i < 7; i++) s.push(s[i - 1] + d + (i - 1)); return s; },
    () => { const o = r(1, 3); return Array.from({ length: 7 }, (_, i) => (i + o) ** 2); },
    () => { const s = [r(1, 3), r(1, 4)]; while (s.length < 8) s.push(s[s.length - 1] + s[s.length - 2]); return s; },
    () => { const a = r(1, 3); const s = [a]; for (let i = 1; i < 7; i++) s.push(s[i - 1] * 2 + 1); return s; },
    () => { const a = r(1, 9); const b = r(20, 40); const d = r(2, 5); const e = r(1, 4); return Array.from({ length: 8 }, (_, i) => (i % 2 ? b - e * ((i - 1) / 2) : a + d * (i / 2))); },
    () => { const o = r(1, 2); return Array.from({ length: 7 }, (_, i) => ((i + o) * (i + o + 1)) / 2); },
  ];
  return pick(level >= 4 ? (rand() < 0.75 ? hard : easy) : easy, rand)();
}
function numberOptions(seq, ans, rand) {
  const v = seq[ans];
  const d = Math.abs((seq[ans] ?? 0) - (seq[ans - 1] ?? seq[ans + 1] ?? 0)) || 2;
  const cand = shuf([v + 1, v - 1, v + 2, v - 2, v + d, v - d, v * 2, v + 10, v - 10], rand).filter((x) => x > 0 && x !== v);
  return [v, ...[...new Set(cand)].slice(0, 3)];
}

function make(level, rand) {
  let seq; let kind;
  if (level <= 1) { seq = shapeRepeat(rand); kind = 't'; } else if (level <= 3) {
    const g = pick(['two', 'arrow', 'num', 'shape'], rand);
    kind = g === 'num' ? 'n' : 't';
    seq = g === 'two' ? twoRules(rand) : g === 'arrow' ? arrows(rand) : g === 'num' ? numbers(level, rand) : shapeRepeat(rand);
  } else {
    const g = pick(['num', 'num', 'two', 'arrow'], rand);
    kind = g === 'num' ? 'n' : 't';
    seq = g === 'two' ? twoRules(rand) : g === 'arrow' ? arrows(rand) : numbers(level, rand);
  }
  // 「？」は ふつう さいご。むずかしく なると まん中にも
  const gap = level >= 3 && rand() < 0.35 ? 3 + Math.floor(rand() * (seq.length - 5)) : seq.length - 1;
  const opts = kind === 'n' ? numberOptions(seq, gap, rand) : tokenOptions(seq, gap, rand);
  const order = shuf(opts.map((_, i) => i), rand);
  return {
    figure: seqFigure(seq, gap),
    options: order.map((i) => (kind === 'n' ? String(opts[i]) : tok(opts[i], 48).replace('width="100%"', 'width="64"'))),
    answer: order.indexOf(0),
  };
}

const thumb = `<svg viewBox="0 0 48 48"><path d="M8 8 L15 20 H1Z" fill="#f0cf7a" stroke="#5e4a35" stroke-width="1.3" stroke-linejoin="round"/><circle cx="24" cy="15" r="6" fill="#f3a8b5" stroke="#5e4a35" stroke-width="1.3"/><path d="M40 8 L47 20 H33Z" fill="#f0cf7a" stroke="#5e4a35" stroke-width="1.3" stroke-linejoin="round"/>
<rect x="15" y="27" width="18" height="18" rx="5" fill="#fff" stroke="#7f985e" stroke-width="2" stroke-dasharray="4 3"/><text x="24" y="41" text-anchor="middle" font-size="14" font-weight="800" fill="#7f985e">?</text></svg>`;

export default { id: 'pattern', title: 'きまり さがし', sub: 'ならびの「？」は？', round: 5, prompt: 'きまりを 見つけて、？に 入るのは？', thumb, make, mount: choiceMount };
