// こおりの おさんぽ道: 指で なぞって、こおりを ぜんぶ 1回ずつ ふんで たねまで 行く（一筆がき）。
// ふんだ こおりは とけて 水になり、もう 通れない。1マス もどす ときは なぞって もどる。
// 問題は 長い 一本道を ランダムに 作り、道に ならなかった マスを 岩にする（かならず とける）。
import { h } from '../ui.js';

const S = 60;
const SIZES = [[4, 4], [4, 5], [5, 5], [5, 6], [6, 6], [6, 7], [7, 7], [7, 8], [8, 8]];
const COVER = [0.7, 0.75, 0.78, 0.8, 0.82, 0.85, 0.87, 0.9, 0.92];

function walk(w, hgt, rand) {
  const used = new Uint8Array(w * hgt);
  const nb = (c) => {
    const x = c % w; const y = (c / w) | 0; const r = [];
    if (x > 0) r.push(c - 1); if (x < w - 1) r.push(c + 1);
    if (y > 0) r.push(c - w); if (y < hgt - 1) r.push(c + w);
    return r;
  };
  let c = Math.floor(rand() * w * hgt);
  const path = [c]; used[c] = 1;
  for (;;) {
    const opts = nb(c).filter((n) => !used[n]);
    if (!opts.length) break;
    // ほとんどは「先の 少ない マス」を えらぶ（長い道に なりやすい）。ときどき でたらめ
    let pick;
    if (rand() < 0.75) {
      const deg = (n) => nb(n).filter((m) => !used[m]).length;
      const min = Math.min(...opts.map(deg));
      const best = opts.filter((n) => deg(n) === min);
      pick = best[Math.floor(rand() * best.length)];
    } else pick = opts[Math.floor(rand() * opts.length)];
    c = pick; used[c] = 1; path.push(c);
  }
  return path;
}

function make(level, rand) {
  const [w, hgt] = SIZES[Math.min(level, SIZES.length - 1)];
  const goal = Math.round(w * hgt * COVER[Math.min(level, COVER.length - 1)]);
  let best = [];
  for (let t = 0; t < 400; t++) {
    const p = walk(w, hgt, rand);
    // ぴったり ぜんぶ うまる 道は かんたんすぎる ことが あるので、目あての 長さに いちばん 近いものを とる
    if (Math.abs(p.length - goal) < Math.abs(best.length - goal) || (best.length < goal * 0.8 && p.length > best.length)) best = p;
    if (Math.abs(best.length - goal) <= 1) break;
  }
  if (rand() < 0.5) best.reverse();
  const ice = new Set(best);
  return { w, h: hgt, ice, start: best[0], goal: best[best.length - 1], solution: best };
}

const rockSvg = (x, y) => `<rect x="${x + 2}" y="${y + 2}" width="${S - 4}" height="${S - 4}" rx="12" fill="#dbe7c6"/>
<ellipse cx="${x + S / 2}" cy="${y + S / 2 + 4}" rx="18" ry="13" fill="#b5a792"/><ellipse cx="${x + S / 2 - 5}" cy="${y + S / 2 - 1}" rx="7" ry="4" fill="#d3c7b6"/>`;
const iceSvg = (x, y) => `<rect x="${x + 2}" y="${y + 2}" width="${S - 4}" height="${S - 4}" rx="12" fill="#d6ecf3" stroke="#b5d7e4" stroke-width="2"/>
<path d="M${x + 13} ${y + 22} l10 -8 M${x + 13} ${y + 33} l20 -16" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.9"/>`;
const waterSvg = (x, y) => `<rect x="${x + 2}" y="${y + 2}" width="${S - 4}" height="${S - 4}" rx="12" fill="#8fc3d8"/>
<path d="M${x + 14} ${y + 26} q6 -5 12 0 t12 0 M${x + 20} ${y + 38} q6 -5 12 0 t12 0" stroke="#d6ecf3" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
const seedSvg = (x, y) => `<g transform="translate(${x + S / 2},${y + S / 2 + 4})"><path d="M0 12 C-9 4 -4 -10 0 -13 C4 -10 9 4 0 12Z" fill="#c99a5b" stroke="#8a6a3e" stroke-width="1.5"/>
<path d="M0 -13 q-11 -11 -17 -5 q8 6 17 5" fill="#8fa871"/></g>`;

function mount(el, pz, done) {
  const { w, h: hgt } = pz;
  const total = pz.ice.size;
  let path = [pz.start];
  let over = false;
  const svgWrap = h('div', { class: 'bz-ice' });
  const msg = h('p', { class: 'bz-hint' }, 'ピヨから 指で なぞってね');
  const left = h('span', { class: 'bz-left' });
  const reset = h('button', { type: 'button', class: 'btn small', onclick: () => { if (over) return; path = [pz.start]; draw(); } }, 'やりなおす');
  const giveup = h('button', { type: 'button', class: 'btn small bz-giveup', onclick: () => {
    if (over) return;
    over = true; path = pz.solution.slice(); draw(true);
    msg.textContent = 'こんな 道が あったよ';
    done(false);
  } }, 'こたえを 見る');

  const xy = (c) => [(c % w) * S, ((c / w) | 0) * S];
  function draw(showAll) {
    const visited = new Set(path);
    const cur = path[path.length - 1];
    let s = '';
    for (let c = 0; c < w * hgt; c++) {
      const [x, y] = xy(c);
      if (!pz.ice.has(c)) s += rockSvg(x, y);
      else if (visited.has(c) && c !== cur) s += waterSvg(x, y);
      else s += iceSvg(x, y);
    }
    const pts = path.map((c) => { const [x, y] = xy(c); return `${x + S / 2},${y + S / 2}`; }).join(' ');
    s += `<polyline points="${pts}" fill="none" stroke="#f0cf7a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${showAll ? '0' : '2 12'}" opacity="0.95"/>`;
    if (cur !== pz.goal) { const [gx, gy] = xy(pz.goal); s += seedSvg(gx, gy); }
    const [px, py] = xy(cur);
    s += `<image href="assets/icons/icon-192.png" x="${px + 6}" y="${py + 4}" width="${S - 12}" height="${S - 12}" style="clip-path:circle(45%)"/>`;
    svgWrap.innerHTML = `<svg viewBox="0 0 ${w * S} ${hgt * S}" width="100%" style="max-width:${w * 64}px">${s}</svg>`;
    left.textContent = `のこり ${total - path.length}`;
  }

  const ok = (c) => pz.ice.has(c) && !path.includes(c);
  const adj = (a, b) => (Math.abs(a - b) === 1 && ((a / w) | 0) === ((b / w) | 0)) || Math.abs(a - b) === w;
  function moveTo(c) {
    if (over) return;
    const cur = path[path.length - 1];
    if (c === cur) return;
    if (path.length > 1 && c === path[path.length - 2]) { path.pop(); draw(); return; }
    // はやく なぞって マスを とばしたときは、まっすぐ ならべて 1マスずつ 進める
    const cx = c % w; const cy = (c / w) | 0; const ux = cur % w; const uy = (cur / w) | 0;
    if (cx !== ux && cy !== uy) return;
    const step = cx === ux ? (cy > uy ? w : -w) : (cx > ux ? 1 : -1);
    let n = cur; const add = [];
    while (n !== c) { n += step; if (!ok(n) || !adj(n - step, n)) return; add.push(n); }
    path.push(...add);
    draw();
    check();
  }
  function check() {
    const cur = path[path.length - 1];
    if (path.length === total && cur === pz.goal) {
      over = true;
      msg.textContent = 'ぜんぶ ふめた！';
      svgWrap.classList.add('clear');
      setTimeout(() => done(true), 350);
      return;
    }
    const can = [cur - 1, cur + 1, cur - w, cur + w].some((n) => n >= 0 && n < w * hgt && adj(cur, n) && ok(n));
    if (cur === pz.goal && path.length < total) msg.textContent = 'まだ こおりが のこってるよ。もどるか やりなおそう';
    else if (!can) msg.textContent = '動けない！ なぞって もどるか、やりなおそう';
    else msg.textContent = 'こおりを ぜんぶ ふんで、たねまで 行こう';
  }

  const cellAt = (e) => {
    const svg = svgWrap.querySelector('svg');
    const r = svg.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * w);
    const y = Math.floor(((e.clientY - r.top) / r.height) * hgt);
    if (x < 0 || y < 0 || x >= w || y >= hgt) return -1;
    return y * w + x;
  };
  let down = false;
  svgWrap.addEventListener('pointerdown', (e) => {
    down = true; svgWrap.setPointerCapture?.(e.pointerId);
    const c = cellAt(e); if (c >= 0) moveTo(c);
  });
  svgWrap.addEventListener('pointermove', (e) => { if (!down) return; const c = cellAt(e); if (c >= 0) moveTo(c); });
  const up = () => { down = false; };
  svgWrap.addEventListener('pointerup', up);
  svgWrap.addEventListener('pointercancel', up);

  draw();
  el.append(svgWrap, h('div', { class: 'bz-ice-bar' }, left, msg), h('div', { class: 'bz-ice-btns' }, reset, giveup));
}

const thumb = `<svg viewBox="0 0 48 48"><rect x="3" y="3" width="20" height="20" rx="5" fill="#8fc3d8"/><rect x="25" y="3" width="20" height="20" rx="5" fill="#d6ecf3" stroke="#b5d7e4"/>
<rect x="3" y="25" width="20" height="20" rx="5" fill="#dbe7c6"/><ellipse cx="13" cy="36" rx="6" ry="4.5" fill="#b5a792"/><rect x="25" y="25" width="20" height="20" rx="5" fill="#d6ecf3" stroke="#b5d7e4"/>
<path d="M13 13 H35 V35" stroke="#e5b84f" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export default {
  id: 'icepath', title: 'こおりの おさんぽ道', sub: '指で なぞる 一筆がき', round: 3,
  prompt: 'こおりを ぜんぶ ふんで、たねまで 行こう', praise: 'ぜんぶ ふめた！', thumb, make, mount,
};
