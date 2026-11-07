// こおりの おさんぽ道: 指で なぞって、こおりを ぜんぶ 1回ずつ ふんで たねまで 行く（一筆がき）。
// ふんだ こおりは はなれると パリンと われて 水になり、もう 通れない。1マス もどす ときは なぞって もどる。
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

// ---- 音（WebAudio で その場で 作る。ファイルは いらない） ----
let ac = null;
function audio() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { ac = new AC(); } catch (e) { ac = null; }
  return ac;
}
function noiseBurst(c, t, dur, freq, gain) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination); src.start(t);
}
function ping(c, t, freq, dur, gain) {
  const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.8, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
// パリン: こまかい 音の かたまり＋高い ガラスの ひびき
function sndBreak() {
  const c = audio(); if (!c) return;
  const t = c.currentTime;
  noiseBurst(c, t, 0.16, 2600, 0.35);
  ping(c, t, 2200 + Math.random() * 900, 0.14, 0.09);
  ping(c, t + 0.025, 3200 + Math.random() * 900, 0.1, 0.06);
}
// ピキッ: のったとき
function sndStep() {
  const c = audio(); if (!c) return;
  const t = c.currentTime;
  noiseBurst(c, t, 0.04, 4000, 0.18);
  ping(c, t, 1500 + Math.random() * 300, 0.05, 0.05);
}
function sndClear() {
  const c = audio(); if (!c) return;
  const t = c.currentTime;
  [1046, 1318, 1568, 2093].forEach((f, i) => ping(c, t + i * 0.08, f, 0.3, 0.08));
}
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch (e) { /* 無視 */ } };

// ---- 絵 ----
const DEFS = `<defs>
<linearGradient id="bzIce" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7fdff"/><stop offset="0.55" stop-color="#d4eef8"/><stop offset="1" stop-color="#a8d8ea"/></linearGradient>
<linearGradient id="bzWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc0d8"/><stop offset="1" stop-color="#4f9bbd"/></linearGradient>
<radialGradient id="bzRock" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#cfc6ba"/><stop offset="1" stop-color="#9a8e80"/></radialGradient>
</defs>`;

function iceTile(x, y, k) {
  const sp = k % 3 === 0 ? `<path class="bz-spark" d="M${x + 44} ${y + 14} l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z" fill="#fff"/>` : '';
  return `<g class="bz-tile" style="transform-origin:${x + S / 2}px ${y + S / 2}px">
<rect x="${x + 3}" y="${y + 7}" width="${S - 6}" height="${S - 6}" rx="11" fill="#3f86a6" opacity="0.45"/>
<rect x="${x + 3}" y="${y + 3}" width="${S - 6}" height="${S - 6}" rx="11" fill="url(#bzIce)" stroke="#8cc8de" stroke-width="1.5"/>
<rect x="${x + 7}" y="${y + 7}" width="${S - 14}" height="${S - 14}" rx="8" fill="none" stroke="#fff" stroke-width="2" opacity="0.7"/>
<path d="M${x + 12} ${y + 24} q4 -10 14 -12" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.95"/>
<path d="M${x + 13} ${y + 33} l5 -4" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>${sp}
<g class="bz-crack" stroke="#6fb3cf" stroke-width="1.6" fill="none" stroke-linecap="round">
<path d="M${x + 30} ${y + 30} l-11 -9 l-5 2 M${x + 30} ${y + 30} l13 -6 l4 -8 M${x + 30} ${y + 30} l4 14 l-3 6 M${x + 30} ${y + 30} l-12 7"/></g></g>`;
}
function rockTile(x, y) {
  return `<ellipse cx="${x + S / 2}" cy="${y + S / 2 + 10}" rx="22" ry="7" fill="#3f86a6" opacity="0.35"/>
<path d="M${x + 10} ${y + 40} q2 -22 20 -26 q16 -2 20 18 q2 12 -8 14 h-26 q-8 0 -6 -6z" fill="url(#bzRock)" stroke="#857868" stroke-width="1.2"/>
<path d="M${x + 15} ${y + 26} q6 -12 16 -12 q12 0 16 10 q-6 -3 -10 1 q-4 -4 -9 0 q-6 -3 -13 1z" fill="#fff"/>`;
}
const seedSvg = (x, y) => `<g class="bz-goal" transform="translate(${x + S / 2},${y + S / 2 + 3})"><circle r="15" fill="#fff6d8" opacity="0.8"/>
<path d="M0 11 C-8 4 -4 -9 0 -12 C4 -9 8 4 0 11Z" fill="#c99a5b" stroke="#8a6a3e" stroke-width="1.5"/><path d="M0 -12 q-10 -10 -16 -5 q8 6 16 5" fill="#8fa871"/></g>`;

function shards(x, y) {
  const cx = x + S / 2; const cy = y + S / 2; let s = '';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5; const d = 18 + Math.random() * 22;
    const sz = 5 + Math.random() * 7;
    s += `<polygon points="0,${-sz} ${sz * 0.8},${sz * 0.5} ${-sz * 0.7},${sz * 0.6}" fill="${i % 2 ? '#f2fbff' : '#bfe4f2'}" stroke="#8cc8de" stroke-width="0.8"
style="--tx:${(Math.cos(a) * d).toFixed(1)}px;--ty:${(Math.sin(a) * d).toFixed(1)}px;--r:${Math.round(Math.random() * 360 - 180)}deg;transform:translate(${cx}px,${cy}px)"/>`;
  }
  return `<g class="bz-shards">${s}<circle class="bz-ripple" cx="${cx}" cy="${cy}" r="10" fill="none" stroke="#e3f4fa" stroke-width="3"/></g>`;
}

function mount(el, pz, done) {
  const { w, h: hgt } = pz;
  const total = pz.ice.size;
  let path = [pz.start];
  let over = false;
  const board = h('div', { class: 'bz-ice', style: `max-width:${w * 64}px` });
  let tiles = '';
  for (let c = 0; c < w * hgt; c++) {
    const x = (c % w) * S; const y = ((c / w) | 0) * S;
    tiles += pz.ice.has(c) ? `<g data-c="${c}">${iceTile(x, y, c)}</g>` : rockTile(x, y);
  }
  const [gx, gy] = [(pz.goal % w) * S, ((pz.goal / w) | 0) * S];
  board.innerHTML = `<svg viewBox="-6 -6 ${w * S + 12} ${hgt * S + 12}" width="100%">${DEFS}
<rect x="-6" y="-6" width="${w * S + 12}" height="${hgt * S + 12}" rx="18" fill="url(#bzWater)"/>
<g opacity="0.35" stroke="#e3f4fa" stroke-width="2" fill="none" stroke-linecap="round">${Array.from({ length: hgt * 2 }, (_, i) => `<path d="M${(i * 37) % (w * S - 30)} ${i * 30 + 14} q8 -6 16 0 t16 0"/>`).join('')}</g>
${tiles}${seedSvg(gx, gy)}<g class="bz-fx"></g><polyline class="bz-route" fill="none"/></svg>`;
  const svg = board.querySelector('svg');
  const fx = svg.querySelector('.bz-fx');
  const route = svg.querySelector('.bz-route');
  const piyo = h('div', { class: 'bz-piyo-walk' }, h('img', { src: 'assets/brain/piyo.webp', alt: '', draggable: 'false' }));
  piyo.style.width = `${((S * 0.8) / (w * S + 12)) * 100}%`;
  board.append(piyo);

  const msg = h('p', { class: 'bz-hint' }, 'ピヨから 指で なぞってね');
  const left = h('span', { class: 'bz-left' });
  const reset = h('button', { type: 'button', class: 'btn small', onclick: () => {
    if (over) return;
    path = [pz.start];
    svg.querySelectorAll('[data-c]').forEach((g) => g.classList.remove('gone', 'cur'));
    place(true); check();
  } }, 'やりなおす');
  const giveup = h('button', { type: 'button', class: 'btn small bz-giveup', onclick: () => {
    if (over) return;
    over = true;
    route.setAttribute('points', pz.solution.map((c) => `${(c % w) * S + S / 2},${((c / w) | 0) * S + S / 2}`).join(' '));
    route.classList.add('show');
    msg.textContent = 'こんな 道が あったよ';
    done(false);
  } }, 'こたえを 見る');

  const tileOf = (c) => svg.querySelector(`[data-c="${c}"]`);
  let facing = 1;
  function place(instant) {
    const cur = path[path.length - 1];
    piyo.classList.toggle('instant', !!instant);
    piyo.style.left = `${((6 + ((cur % w) + 0.5) * S) / (w * S + 12)) * 100}%`;
    piyo.style.top = `${((6 + (((cur / w) | 0) + 0.5) * S) / (hgt * S + 12)) * 100}%`;
    piyo.style.setProperty('--flip', facing);
    piyo.classList.remove('hop'); void piyo.offsetWidth; piyo.classList.add('hop');
    svg.querySelectorAll('.cur').forEach((g) => g.classList.remove('cur'));
    tileOf(cur)?.classList.add('cur');
    left.textContent = `のこり ${total - path.length}`;
  }

  const ok = (c) => pz.ice.has(c) && !path.includes(c);
  const adj = (a, b) => (Math.abs(a - b) === 1 && ((a / w) | 0) === ((b / w) | 0)) || Math.abs(a - b) === w;
  function breakTile(c) {
    tileOf(c)?.classList.add('gone');
    const x = (c % w) * S; const y = ((c / w) | 0) * S;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = shards(x, y);
    fx.append(g);
    setTimeout(() => g.remove(), 700);
    sndBreak(); buzz(12);
  }
  function stepTo(n) {
    const prev = path[path.length - 1];
    if (n % w !== prev % w) facing = n % w > prev % w ? 1 : -1;
    path.push(n);
    breakTile(prev);
    sndStep();
  }
  function moveTo(c) {
    if (over) return;
    const cur = path[path.length - 1];
    if (c === cur) return;
    if (path.length > 1 && c === path[path.length - 2]) {
      // なぞって もどる: こおりが もとに もどる
      path.pop();
      const back = path[path.length - 1];
      tileOf(back)?.classList.remove('gone');
      if (back % w !== cur % w) facing = back % w > cur % w ? 1 : -1;
      place(); check(); return;
    }
    // はやく なぞって マスを とばしたときは、まっすぐ ならべて 1マスずつ 進める
    const cx = c % w; const cy = (c / w) | 0; const ux = cur % w; const uy = (cur / w) | 0;
    if (cx !== ux && cy !== uy) return;
    const step = cx === ux ? (cy > uy ? w : -w) : (cx > ux ? 1 : -1);
    let n = cur; const add = [];
    while (n !== c) { n += step; if (!ok(n) || !adj(n - step, n)) return; add.push(n); }
    add.forEach(stepTo);
    place();
    check();
  }
  function check() {
    const cur = path[path.length - 1];
    if (path.length === total && cur === pz.goal) {
      over = true;
      msg.textContent = 'ぜんぶ わった！';
      board.classList.add('clear');
      breakTile(cur);
      sndClear(); buzz([20, 40, 20]);
      setTimeout(() => done(true), 450);
      return;
    }
    const can = [cur - 1, cur + 1, cur - w, cur + w].some((n) => n >= 0 && n < w * hgt && adj(cur, n) && ok(n));
    if (cur === pz.goal && path.length < total) msg.textContent = 'まだ こおりが のこってるよ。もどるか やりなおそう';
    else if (!can) msg.textContent = '動けない！ なぞって もどるか、やりなおそう';
    else msg.textContent = 'こおりを ぜんぶ わって、たねまで 行こう';
  }

  const cellAt = (e) => {
    const r = svg.getBoundingClientRect();
    const sx = (w * S + 12) / r.width; const sy = (hgt * S + 12) / r.height;
    const x = Math.floor(((e.clientX - r.left) * sx - 6) / S);
    const y = Math.floor(((e.clientY - r.top) * sy - 6) / S);
    if (x < 0 || y < 0 || x >= w || y >= hgt) return -1;
    return y * w + x;
  };
  let down = false;
  board.addEventListener('pointerdown', (e) => {
    audio()?.resume?.();
    down = true; board.setPointerCapture?.(e.pointerId);
    const c = cellAt(e); if (c >= 0) moveTo(c);
  });
  board.addEventListener('pointermove', (e) => { if (!down) return; const c = cellAt(e); if (c >= 0) moveTo(c); });
  const up = () => { down = false; };
  board.addEventListener('pointerup', up);
  board.addEventListener('pointercancel', up);

  place(true);
  left.textContent = `のこり ${total - 1}`;
  el.append(board, h('div', { class: 'bz-ice-bar' }, left, msg), h('div', { class: 'bz-ice-btns' }, reset, giveup));
}

const thumb = `<svg viewBox="0 0 48 48"><rect x="3" y="3" width="20" height="20" rx="5" fill="#8fc3d8"/><rect x="25" y="3" width="20" height="20" rx="5" fill="#d6ecf3" stroke="#b5d7e4"/>
<rect x="3" y="25" width="20" height="20" rx="5" fill="#dbe7c6"/><ellipse cx="13" cy="36" rx="6" ry="4.5" fill="#b5a792"/><rect x="25" y="25" width="20" height="20" rx="5" fill="#d6ecf3" stroke="#b5d7e4"/>
<path d="M13 13 H35 V35" stroke="#e5b84f" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export default {
  id: 'icepath', title: 'こおりの おさんぽ道', sub: '指で なぞる 一筆がき', time: 90, target: 2,
  prompt: 'こおりを ぜんぶ わって、たねまで 行こう', praise: 'ぜんぶ わった！', thumb, make, mount,
};
