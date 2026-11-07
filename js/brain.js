// ひらめき パズル: 頭を つかう ミニゲーム。問題は ぜんぶ プログラムが その場で 作る（AI は つかわない）。
// - ゲームは js/brain/*.js。どれも make(level, rand) で 問題を作り、mount(el, puzzle, done) で 遊ぶ
// - 1分チャレンジ: 時間内に 何もん とけるか。とくほど むずかしく なる。目標を こえると 塔を 1階 のぼれる
// - 塔は 10階ずつ。のぼるほど スタートの むずかしさと 目標が 上がる
// - じっくり: 時間なしで 5もん（塔は のぼらない）
// - ポイントは ひかえめ: ほし1こ 3ポイント、1日 BRAIN_DAY_CAP まで
// きろくは p.brain = { st: { [ゲーム]: { floor, best, stars, plays } }, days: { [日]: { pts, rounds } } }
import { h } from './ui.js';
import { today, save, gradeBucket } from './store.js';
import { seededRandom } from './quests.js';
import { icon } from './icons.js';
import icepath from './brain/icepath.js';
import blocks from './brain/blocks.js';
import origami from './brain/origami.js';
import pattern from './brain/pattern.js';
import section from './brain/section.js';

export const GAMES = [icepath, blocks, origami, pattern, section];
export const BRAIN_PER_STAR = 3;
export const BRAIN_DAY_CAP = 30;
const MAX_LEVEL = 8;
const PER_TOWER = 10;
const CALM_ROUND = 5;
const TOWERS = ['たんぽぽの塔', 'そよ風の塔', '花の塔', '木もれ日の塔', '星の塔', '虹の塔'];
const TOWER_COLORS = ['#f0cf7a', '#9cc3dc', '#f3a8b5', '#8fa871', '#c9b3e6', '#f2a76b'];

function rec(p) {
  if (!p.brain) p.brain = {};
  if (!p.brain.st) p.brain.st = {};
  if (!p.brain.days) p.brain.days = {};
  return p.brain;
}
const gameRec = (p, id) => (rec(p).st[id] ||= { floor: 1, best: 0, stars: 0, plays: 0 });
const dayRec = (p) => (rec(p).days[today()] ||= { pts: 0, rounds: 0 });

const towerOf = (floor) => Math.floor((floor - 1) / PER_TOWER);
const towerName = (t) => TOWERS[t] || `たつじんの塔 ${t - TOWERS.length + 1}`;
const towerColor = (t) => TOWER_COLORS[t % TOWER_COLORS.length];
const floorInTower = (floor) => ((floor - 1) % PER_TOWER) + 1;
const floorLabel = (floor) => `${towerName(towerOf(floor))} ${floorInTower(floor)}階`;

// 学年で スタートの むずかしさを かえる。3階ごとに 1だん 上がる
const BASE = { e4: 0, e6: 2, j: 4 };
function startLevel(p, floor) {
  return Math.min(MAX_LEVEL, (BASE[gradeBucket(p)] ?? 0) + Math.floor((floor - 1) / 3));
}
// 1分で とく 目標の 数。塔が かわるごとに 1もん ふえる
const targetFor = (game, floor) => game.target + Math.floor((floor - 1) / PER_TOWER) * (game.id === 'icepath' ? 0 : 1);
const timeStars = (game, score, target) => {
  const step = game.id === 'icepath' ? 1 : 2;
  return score >= target + step * 2 ? 3 : score >= target + step ? 2 : score >= target ? 1 : 0;
};
const calmStars = (score, total) => (score >= total ? 3 : score >= total - 1 ? 2 : score * 2 >= total ? 1 : 0);

function starRow(n, max = 3) {
  return h('span', { class: 'bz-stars' }, Array.from({ length: max }, (_, i) => h('i', { class: i < n ? 'on' : '' }, icon('star'))));
}

function givePoints(p, stars, game, deps) {
  const d = dayRec(p);
  d.rounds += 1;
  const pts = Math.max(0, Math.min(stars * BRAIN_PER_STAR, BRAIN_DAY_CAP - d.pts));
  d.pts += pts;
  if (pts > 0) deps.gain(p, pts, `ひらめき パズル（${game.title}）`); else save();
  return pts;
}

// ---- 塔の 絵 ----
function towerSvg(floor) {
  const t = towerOf(floor); const now = floorInTower(floor); const col = towerColor(t);
  const W = 150; const fh = 24; const top = 40;
  let s = `<polygon points="${W / 2},4 ${W / 2 + 48},${top} ${W / 2 - 48},${top}" fill="${col}" stroke="#5e4a35" stroke-width="2" stroke-linejoin="round"/>`
    + `<line x1="${W / 2}" y1="4" x2="${W / 2}" y2="-14" stroke="#5e4a35" stroke-width="2"/><path d="M${W / 2} -14 l14 4 l-14 4z" fill="#e06b5a"/>`;
  for (let i = PER_TOWER; i >= 1; i--) {
    const y = top + (PER_TOWER - i) * fh;
    const x = W / 2 - 42 - (PER_TOWER - i) * 0.9; const w = 84 + (PER_TOWER - i) * 1.8;
    const done = i < now; const cur = i === now;
    s += `<rect x="${x}" y="${y + 1}" width="${w}" height="${fh - 2}" rx="5" fill="${done ? col : cur ? '#fff' : '#f4ecdc'}" stroke="${cur ? '#7f985e' : '#5e4a35'}" stroke-width="${cur ? 2.5 : 1.3}" ${cur ? 'stroke-dasharray="5 3"' : ''} opacity="${done || cur ? 1 : 0.8}"/>`;
    s += `<rect x="${W / 2 - 6}" y="${y + 6}" width="12" height="${fh - 10}" rx="5" fill="${done ? '#fffaf0' : '#e2d3b7'}" opacity="${done ? 0.7 : 0.6}"/>`;
    s += `<text x="${x + w + 8}" y="${y + fh / 2 + 5}" font-size="12" font-weight="700" fill="${cur ? '#5c7a3e' : '#b5a792'}">${i}</text>`;
    if (cur) s += `<image href="assets/brain/piyo.webp" x="${x - 26}" y="${y - 6}" width="24" height="30"/>`;
  }
  const H = top + PER_TOWER * fh + 6;
  s += `<rect x="${W / 2 - 60}" y="${H - 6}" width="120" height="8" rx="4" fill="#dbe7c6"/>`;
  return `<svg viewBox="-34 -18 ${W + 60} ${H + 22}" width="100%" style="max-width:220px">${s}</svg>`;
}

// ---- 遊ぶ 画面 ----
// mode: 'time'（1分チャレンジ）か 'calm'（じっくり 5もん）
function play(p, game, deps, mode = 'time') {
  document.querySelector('.bz-play')?.remove();
  const g = gameRec(p, game.id);
  const floor = g.floor;
  const base = startLevel(p, floor);
  const target = targetFor(game, floor);
  const limit = (game.time || 60) * 1000;
  const rand = seededRandom(`${p.id}:${game.id}:${Date.now()}`);
  let solved = 0; let tried = 0; let over = false; let tick = 0; let endAt = 0;
  const level = () => Math.min(MAX_LEVEL, base + Math.floor(solved / 2));   // とくほど むずかしく
  const wrap = h('div', { class: 'runner bz-play' });
  const stop = () => { over = true; clearInterval(tick); };
  const close = () => { stop(); wrap.remove(); deps.render?.(); };
  document.body.append(wrap);

  const bar = h('i', {});
  const clock = h('b', { class: 'bz-clock' });
  const counter = h('span', { class: 'chip bz-count' });
  const top = () => h('div', { class: 'runner-top' },
    h('button', { class: 'close', 'aria-label': 'とじる', onclick: close }, icon('x')),
    mode === 'time'
      ? h('div', { class: 'bz-timer' }, h('span', { class: 'bz-bar' }, bar), clock)
      : h('div', { class: 'dots' }, Array.from({ length: CALM_ROUND }, (_, k) => h('i', { class: k < tried ? 'done' : k === tried ? 'now' : '' }))),
    counter);
  const paint = () => {
    counter.textContent = mode === 'time' ? `${solved} / ${target}` : `${solved}もん`;
    counter.classList.toggle('hit', mode === 'time' && solved >= target);
    if (mode !== 'time') return;
    const left = Math.max(0, endAt - Date.now());
    bar.style.width = `${(left / limit) * 100}%`;
    bar.classList.toggle('low', left < 10000);
    clock.textContent = `${Math.ceil(left / 1000)}`;
  };

  const next = () => {
    if (over) return;
    if (mode === 'calm' && tried >= CALM_ROUND) { finish(); return; }
    const puzzle = game.make(level(), rand);
    const body = h('div', { class: 'bz-body' });
    const card = h('div', { class: 'runner-card bz-card' }, top(),
      h('p', { class: 'prompt' }, puzzle.prompt || game.prompt), body);
    wrap.replaceChildren(card);
    wrap.scrollTop = 0;
    paint();
    game.mount(body, puzzle, (ok) => {
      if (over) return;
      tried += 1;
      if (ok) solved += 1;
      paint();
      if (mode === 'time') {
        // テンポよく 次へ。まちがえた ときは 答えを 少し 見せる
        const pop = h('div', { class: `bz-pop ${ok ? 'ok' : 'ng'}` }, ok ? icon('circle-check') : icon('x'));
        card.append(pop);
        setTimeout(next, ok ? 450 : 1300);
        return;
      }
      const fb = h('p', { class: `feedback ${ok ? 'ok' : 'ng'}` }, ok ? (game.praise || 'せいかい！') : 'ざんねん！ こたえを 見てみよう');
      const btn = h('button', { class: 'btn primary next', onclick: next }, tried >= CALM_ROUND ? 'けっか' : 'つぎへ');
      card.append(h('div', { class: 'runner-foot' }, fb, btn));
      btn.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    });
  };

  const finish = () => {
    stop();
    g.plays += 1;
    let stars; let headline; let sub = '';
    if (mode === 'time') {
      stars = timeStars(game, solved, target);
      const best = solved > (g.best || 0) && solved > 0;
      if (best) g.best = solved;
      const cleared = solved >= target;
      if (cleared) g.floor += 1;
      headline = cleared ? `${floorInTower(floor)}階 クリア！` : `あと ${target - solved}もん！`;
      if (cleared && floorInTower(floor) === PER_TOWER) headline = `${towerName(towerOf(floor))} せいは！`;
      sub = `${best ? '自己ベスト！ ' : ''}${cleared ? `つぎは ${floorLabel(g.floor)}` : `目標 ${target}もんで ${floorInTower(floor)}階 クリア`}`;
    } else {
      stars = calmStars(solved, CALM_ROUND);
      headline = stars ? 'いい ちょうし！' : 'もう1回 やってみよう';
    }
    g.stars += stars;
    const pts = givePoints(p, stars, game, deps);
    wrap.replaceChildren(h('div', { class: 'runner-card result bz-result' },
      mode === 'time' && solved >= target ? h('div', { class: 'bz-tower small', html: towerSvg(g.floor) }) : h('img', { src: 'assets/brain/piyo.webp', alt: '', width: 74, height: 100, class: 'bz-piyo' }),
      h('p', { class: 'big' }, mode === 'time' ? `${solved}もん` : `${solved} / ${CALM_ROUND}`),
      starRow(stars),
      h('p', { class: 'reward' }, headline),
      sub ? h('p', { class: 'bz-sub' }, sub) : null,
      h('p', { class: 'bz-pts' }, pts > 0 ? `+${pts} ポイント` : stars ? 'きょうの ポイントは いっぱい。力だめしは つづけられるよ' : ''),
      h('div', { class: 'runner-foot' },
        h('button', { class: 'btn primary next', onclick: () => play(p, game, deps, mode) }, mode === 'time' && solved >= target ? `${floorInTower(g.floor)}階に ちょうせん` : 'もう1回'),
        h('button', { class: 'btn', onclick: () => { close(); openGame(p, game, deps); } }, '塔を 見る'))));
  };

  // よーい… スタート
  if (mode === 'time') {
    const n = h('p', { class: 'bz-ready' }, 'よーい…');
    wrap.replaceChildren(h('div', { class: 'runner-card result' },
      h('p', { class: 'bz-sub' }, floorLabel(floor)),
      h('p', { class: 'reward' }, `${Math.round(limit / 1000)}びょうで ${target}もん とこう！`), n));
    setTimeout(() => { if (!wrap.isConnected) return; n.textContent = 'スタート！'; }, 900);
    setTimeout(() => {
      if (!wrap.isConnected) return;
      endAt = Date.now() + limit;
      tick = setInterval(() => { paint(); if (Date.now() >= endAt) finish(); }, 200);
      next();
    }, 1500);
  } else next();
}

// ---- ゲームごとの 画面（塔） ----
export function openGame(p, game, deps) {
  document.querySelector('.sheet.bz-sheet')?.remove();
  const g = gameRec(p, game.id);
  const close = () => sheet.remove();
  const sheet = h('div', { class: 'sheet bz-sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card bz-game-card' },
      h('p', { class: 'sheet-title' }, game.title),
      h('p', { class: 'sheet-sub' }, floorLabel(g.floor)),
      h('div', { class: 'bz-tower', html: towerSvg(g.floor) }),
      h('p', { class: 'bz-goal' }, `${game.time || 60}びょうで ${targetFor(game, g.floor)}もん とけたら クリア`),
      g.best ? h('p', { class: 'bz-sub' }, `自己ベスト ${g.best}もん`) : null,
      h('button', { class: 'btn primary', onclick: () => { close(); play(p, game, deps, 'time'); } }, icon('timer'), ` ${game.time || 60}びょう チャレンジ`),
      h('button', { class: 'btn', onclick: () => { close(); play(p, game, deps, 'calm'); } }, `じっくり ${CALM_ROUND}もん`),
      h('button', { class: 'link', type: 'button', onclick: () => { close(); openBrain(p, deps); } }, 'ほかの パズル')));
  document.body.append(sheet);
}

// ---- えらぶ 画面 ----
export function openBrain(p, deps) {
  document.querySelector('.sheet.bz-sheet')?.remove();
  const close = () => sheet.remove();
  const d = dayRec(p);
  const sheet = h('div', { class: 'sheet bz-sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card' },
      h('div', { class: 'coach' }, h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 48, height: 48 }),
        h('p', {}, 'どの 塔に のぼる？')),
      h('div', { class: 'bz-grid' }, GAMES.map((gm) => {
        const r = gameRec(p, gm.id);
        return h('button', { type: 'button', class: 'bz-game', onclick: () => { close(); openGame(p, gm, deps); } },
          h('span', { class: 'bz-thumb', html: gm.thumb }),
          h('b', {}, gm.title),
          h('small', {}, gm.sub),
          h('span', { class: 'bz-stage', style: `--tc:${towerColor(towerOf(r.floor))}` }, floorLabel(r.floor)));
      })),
      h('p', { class: 'more-meter' }, d.pts >= BRAIN_DAY_CAP
        ? 'きょうの ポイントは いっぱい（力だめしは つづけられるよ）'
        : `ほし1こ ${BRAIN_PER_STAR}ポイント（1日 ${BRAIN_DAY_CAP}ポイントまで${d.pts ? `・あと ${BRAIN_DAY_CAP - d.pts}` : ''}）`),
      h('button', { class: 'link', type: 'button', onclick: close }, 'とじる')));
  document.body.append(sheet);
}

// クエストの画面の カード
export function brainCard(p, deps) {
  const floors = GAMES.reduce((n, gm) => n + ((rec(p).st[gm.id]?.floor || 1) - 1), 0);
  return h('div', { class: 'card quest bz-card-home' },
    h('div', { class: 'more-head' },
      h('span', { class: 'bz-home-ic', html: icepath.thumb }),
      h('div', {},
        h('h3', {}, 'ひらめき パズル'),
        h('p', {}, '1分で 何もん とける？ 塔を のぼろう'))),
    floors ? h('p', { class: 'more-meter' }, `のぼった 階 ぜんぶで ${floors}階`) : null,
    h('button', { class: 'btn', onclick: () => openBrain(p, deps) }, icon('puzzle'), ' あそぶ'));
}
