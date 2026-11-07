// おりがみ パンチ: 紙を おって あなを あけ、ひらくと どうなる？
// 紙は 4×4 マス。おり方: V=右を 左へ、H=下を 上へ（線の 場所 at は マス数）、D=右上を 左下へ（ななめ）。
// こたえは あけた あなを、おった じゅんの 逆に 線で うつして（線たいしょう）作る。
import { choiceMount } from './choice.js';

const N = 4;
const INK = '#5e4a35';
const PAPER = '#f3c9b8'; const BACK = '#f9e3d9'; const CREASE = '#d9a493';

const refl = (f, [x, y]) => (f.t === 'V' ? [2 * f.at - 1 - x, y] : f.t === 'H' ? [x, 2 * f.at - 1 - y] : [y, x]);
const wrongRefl = (f, [x, y]) => (f.t === 'V' ? [x, 2 * f.at - 1 - y] : f.t === 'H' ? [2 * f.at - 1 - x, y] : [N - 1 - y, N - 1 - x]);
const k = (c) => `${c[0]},${c[1]}`;
const uniq = (cs) => { const m = new Map(); cs.forEach((c) => { if (c[0] >= 0 && c[1] >= 0 && c[0] < N && c[1] < N) m.set(k(c), c); }); return [...m.values()]; };
const keyOf = (cs) => cs.map(k).sort().join(';');

function unfold(holes, folds, fn = refl, skip = -1) {
  let s = holes.slice();
  for (let i = folds.length - 1; i >= 0; i--) { if (i === skip) continue; s = uniq([...s, ...s.map((c) => fn(folds[i], c))]); }
  return s;
}

// おったあとの 形（四角 W×H か、三角）
function shapes(folds) {
  let W = N; let H = N; let tri = false;
  const list = [{ W, H, tri }];
  folds.forEach((f) => { if (f.t === 'V') W = f.at; else if (f.t === 'H') H = f.at; else tri = true; list.push({ W, H, tri }); });
  return list;
}

const U = 15;
function shapePath(s, ox, oy) {
  if (s.tri) return `<polygon points="${ox},${oy} ${ox},${oy + N * U} ${ox + N * U},${oy + N * U}" fill="${PAPER}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;
  return `<rect x="${ox}" y="${oy}" width="${s.W * U}" height="${s.H * U}" fill="${PAPER}" stroke="${INK}" stroke-width="1.5"/>`;
}
const hole = (x, y, ox, oy) => `<circle cx="${ox + (x + 0.5) * U}" cy="${oy + (y + 0.5) * U}" r="${U * 0.3}" fill="#fff" stroke="${INK}" stroke-width="1.3"/>`;

function figure(folds, holes) {
  const sh = shapes(folds);
  const P = N * U + 26;   // 1コマの はば
  let s = ''; let x = 4;
  folds.forEach((f, i) => {
    const cur = sh[i]; const oy = 18;
    // おる がわを うすく
    if (f.t === 'V') s += `<rect x="${x + f.at * U}" y="${oy}" width="${(cur.W - f.at) * U}" height="${cur.H * U}" fill="${BACK}"/>` + `<rect x="${x}" y="${oy}" width="${f.at * U}" height="${cur.H * U}" fill="${PAPER}"/>` + `<rect x="${x}" y="${oy}" width="${cur.W * U}" height="${cur.H * U}" fill="none" stroke="${INK}" stroke-width="1.5"/>`
      + `<line x1="${x + f.at * U}" y1="${oy - 4}" x2="${x + f.at * U}" y2="${oy + cur.H * U + 4}" stroke="#7fa6c0" stroke-width="2.5" stroke-dasharray="5 4"/>`
      + `<path d="M${x + (f.at + (cur.W - f.at) / 2) * U + 4} ${oy - 2} q${-(cur.W - f.at) * U / 2 - 4} -14 ${-(cur.W - f.at) * U - 4} 0" fill="none" stroke="#c98f7a" stroke-width="2.5" marker-end="url(#oa)"/>`;
    else if (f.t === 'H') s += `<rect x="${x}" y="${oy + f.at * U}" width="${cur.W * U}" height="${(cur.H - f.at) * U}" fill="${BACK}"/>` + `<rect x="${x}" y="${oy}" width="${cur.W * U}" height="${f.at * U}" fill="${PAPER}"/>` + `<rect x="${x}" y="${oy}" width="${cur.W * U}" height="${cur.H * U}" fill="none" stroke="${INK}" stroke-width="1.5"/>`
      + `<line x1="${x - 4}" y1="${oy + f.at * U}" x2="${x + cur.W * U + 4}" y2="${oy + f.at * U}" stroke="#7fa6c0" stroke-width="2.5" stroke-dasharray="5 4"/>`
      + `<path d="M${x + cur.W * U + 2} ${oy + (f.at + (cur.H - f.at) / 2) * U + 4} q14 ${-(cur.H - f.at) * U / 2 - 4} 0 ${-(cur.H - f.at) * U - 4}" fill="none" stroke="#c98f7a" stroke-width="2.5" marker-end="url(#oa)"/>`;
    else s += `<polygon points="${x},${oy} ${x + N * U},${oy} ${x + N * U},${oy + N * U}" fill="${BACK}"/><polygon points="${x},${oy} ${x},${oy + N * U} ${x + N * U},${oy + N * U}" fill="${PAPER}"/>`
      + `<rect x="${x}" y="${oy}" width="${N * U}" height="${N * U}" fill="none" stroke="${INK}" stroke-width="1.5"/>`
      + `<line x1="${x - 3}" y1="${oy - 3}" x2="${x + N * U + 3}" y2="${oy + N * U + 3}" stroke="#7fa6c0" stroke-width="2.5" stroke-dasharray="5 4"/>`
      + `<path d="M${x + N * U - 8} ${oy + 12} q-4 ${N * U / 2} ${-N * U / 2 + 4} ${N * U / 2 - 4}" fill="none" stroke="#c98f7a" stroke-width="2.5" marker-end="url(#oa)"/>`;
    s += `<text x="${x + N * U / 2}" y="${oy + N * U + 24}" text-anchor="middle" font-size="13" fill="#8a735d" font-weight="700">${i + 1}. おる</text>`;
    x += P;
  });
  const last = sh[sh.length - 1];
  s += shapePath(last, x, 18);
  holes.forEach(([hx, hy]) => { s += hole(hx, hy, x, 18); });
  s += `<text x="${x + N * U / 2}" y="${18 + N * U + 24}" text-anchor="middle" font-size="13" fill="#8a735d" font-weight="700">あなを あける</text>`;
  x += N * U + 4;
  return `<svg viewBox="0 0 ${x + 4} ${N * U + 50}" width="100%" style="max-width:${(x + 4) * 1.5}px"><defs><marker id="oa" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7Z" fill="#c98f7a"/></marker></defs>${s}</svg>`;
}

function paperSvg(holes, folds) {
  const u = 18; let s = `<rect x="2" y="2" width="${N * u}" height="${N * u}" rx="2" fill="${PAPER}" stroke="${INK}" stroke-width="1.3"/>`;
  // おり目: あとの おり目は、前の おり目で うつった ところにも できる
  folds.forEach((f, i) => {
    if (f.t === 'D') { s += `<line x1="2" y1="2" x2="${2 + N * u}" y2="${2 + N * u}" stroke="${CREASE}" stroke-dasharray="3 3"/>`; return; }
    let pos = [f.at];
    for (let j = i - 1; j >= 0; j--) if (folds[j].t === f.t) pos = [...new Set([...pos, ...pos.map((v) => 2 * folds[j].at - v)])];
    pos.forEach((v) => {
      s += f.t === 'V' ? `<line x1="${2 + v * u}" y1="2" x2="${2 + v * u}" y2="${2 + N * u}" stroke="${CREASE}" stroke-dasharray="3 3"/>`
        : `<line x1="2" y1="${2 + v * u}" x2="${2 + N * u}" y2="${2 + v * u}" stroke="${CREASE}" stroke-dasharray="3 3"/>`;
    });
  });
  holes.forEach(([x, y]) => { s += `<circle cx="${2 + (x + 0.5) * u}" cy="${2 + (y + 0.5) * u}" r="${u * 0.28}" fill="#fff" stroke="${INK}" stroke-width="1.2"/>`; });
  return `<svg viewBox="0 0 ${N * u + 4} ${N * u + 4}" width="100%">${s}</svg>`;
}

function pickFolds(level, rand) {
  const r = (a) => a[Math.floor(rand() * a.length)];
  const one = () => [r([{ t: 'V', at: 2 }, { t: 'H', at: 2 }])];
  const two = () => r([[{ t: 'V', at: 2 }, { t: 'H', at: 2 }], [{ t: 'H', at: 2 }, { t: 'V', at: 2 }], [{ t: 'V', at: 2 }, { t: 'V', at: 1 }], [{ t: 'H', at: 2 }, { t: 'H', at: 1 }]]);
  const three = () => r([[{ t: 'V', at: 2 }, { t: 'H', at: 2 }, { t: 'V', at: 1 }], [{ t: 'H', at: 2 }, { t: 'V', at: 2 }, { t: 'H', at: 1 }], [{ t: 'V', at: 2 }, { t: 'H', at: 2 }, { t: 'H', at: 1 }]]);
  if (level <= 1) return { folds: one(), n: level === 0 ? 1 : 2 };
  if (level <= 3) return { folds: two(), n: level === 2 ? 1 : 2 };
  if (level === 4) return rand() < 0.5 ? { folds: [{ t: 'D' }], n: 1 + Math.floor(rand() * 2) } : { folds: two(), n: 2 };
  if (level === 5) return rand() < 0.6 ? { folds: three(), n: 1 } : { folds: [{ t: 'D' }], n: 2 };
  return rand() < 0.6 ? { folds: three(), n: 1 + Math.floor(rand() * 2) } : { folds: [{ t: 'D' }], n: 2 + Math.floor(rand() * 2) };
}

function make(level, rand) {
  const { folds, n } = pickFolds(level, rand);
  const last = shapes(folds).pop();
  const cells = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (last.tri ? y > x : x < last.W && y < last.H) cells.push([x, y]);
  const holes = [];
  while (holes.length < Math.min(n, cells.length)) { const c = cells[Math.floor(rand() * cells.length)]; if (!holes.some((h) => k(h) === k(c))) holes.push(c); }
  const right = unfold(holes, folds);
  const wrongs = [unfold(holes, folds, wrongRefl)];
  folds.forEach((_, i) => wrongs.push(unfold(holes, folds, refl, i)));
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => wrongs.push(right.map(([x, y]) => [x + dx, y + dy])));
  wrongs.push(right.map(([x, y]) => [y, x]));
  const seen = new Set([keyOf(right)]); const opts = [right];
  for (const wv of wrongs.sort(() => rand() - 0.5)) {
    if (opts.length >= 4) break;
    const u = uniq(wv);
    if (u.length !== wv.length || !u.length) continue;   // はみ出した ものは つかわない
    const kk = keyOf(u); if (seen.has(kk)) continue; seen.add(kk); opts.push(u);
  }
  while (opts.length < 4) {
    const rnd = uniq(right.map(() => [Math.floor(rand() * N), Math.floor(rand() * N)]));
    const kk = keyOf(rnd); if (!seen.has(kk)) { seen.add(kk); opts.push(rnd); }
  }
  const order = opts.map((_, i) => i).sort(() => rand() - 0.5);
  return {
    figure: figure(folds, holes),
    options: order.map((i) => paperSvg(opts[i], folds)),
    answer: order.indexOf(0),
    note: 'おり目で 鏡のように うつるよ',
  };
}

const thumb = `<svg viewBox="0 0 48 48"><rect x="6" y="8" width="18" height="32" fill="#f3c9b8" stroke="#5e4a35" stroke-width="1.5"/><rect x="24" y="8" width="18" height="32" fill="#f9e3d9" stroke="#d9a493" stroke-dasharray="3 2"/>
<circle cx="15" cy="18" r="3.5" fill="#fff" stroke="#5e4a35" stroke-width="1.3"/><circle cx="15" cy="30" r="3.5" fill="#fff" stroke="#5e4a35" stroke-width="1.3"/><path d="M38 14 q-6 -6 -12 -1" stroke="#c98f7a" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;

export default { id: 'origami', title: 'おりがみ パンチ', sub: 'おって あけた あなは？', round: 5, prompt: 'おって、あなを あけて、ひらくと？', thumb, make, mount: choiceMount };
