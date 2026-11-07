// ひらめき パズル: 頭を つかう ミニゲーム。問題は ぜんぶ プログラムが その場で 作る（AI は つかわない）。
// - ゲームは js/brain/*.js。どれも make(level, rand) で 問題を作り、mount(el, puzzle, done) で 遊ぶ
// - 1回 = ROUND もん（こおりの道は 3マップ）。ほしの数で ステージが 進み、ステージで むずかしさが 上がる
// - ポイントは ひかえめ: ほし1こ 3ポイント、1日 BRAIN_DAY_CAP まで
// きろくは p.brain = { st: { [ゲーム]: { stage, stars, plays } }, days: { [日]: { pts, rounds } } }
import { h, toast } from './ui.js';
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

function rec(p) {
  if (!p.brain) p.brain = {};
  if (!p.brain.st) p.brain.st = {};
  if (!p.brain.days) p.brain.days = {};
  return p.brain;
}
const gameRec = (p, id) => (rec(p).st[id] ||= { stage: 1, stars: 0, plays: 0 });
const dayRec = (p) => (rec(p).days[today()] ||= { pts: 0, rounds: 0 });

// 学年で スタートの むずかしさを かえる。ステージ2つごとに 1だん 上がる
const BASE = { e4: 0, e6: 2, j: 4 };
export function levelFor(p, id) {
  const st = gameRec(p, id).stage;
  return Math.min(MAX_LEVEL, (BASE[gradeBucket(p)] ?? 0) + Math.floor((st - 1) / 2));
}

const starsFor = (score, total) => (score >= total ? 3 : score >= total - 1 ? 2 : score * 2 >= total ? 1 : 0);

function starRow(n, max = 3) {
  return h('span', { class: 'bz-stars' }, Array.from({ length: max }, (_, i) => h('i', { class: i < n ? 'on' : '' }, icon('star'))));
}

// ---- 遊ぶ 画面 ----
function play(p, game, deps) {
  document.querySelector('.bz-play')?.remove();
  const level = levelFor(p, game.id);
  const total = game.round || 5;
  const rand = seededRandom(`${p.id}:${game.id}:${Date.now()}`);
  let i = 0; let score = 0;
  const wrap = h('div', { class: 'runner bz-play' });
  const close = () => { wrap.remove(); deps.render?.(); };
  document.body.append(wrap);

  const top = () => h('div', { class: 'runner-top' },
    h('button', { class: 'close', 'aria-label': 'とじる', onclick: close }, icon('x')),
    h('div', { class: 'dots' }, Array.from({ length: total }, (_, k) => h('i', { class: k < i ? 'done' : k === i ? 'now' : '' }))),
    h('span', { class: 'chip' }, `ステージ ${gameRec(p, game.id).stage}`));

  const next = () => {
    if (i >= total) { finish(); return; }
    const puzzle = game.make(level, rand);
    const body = h('div', { class: 'bz-body' });
    const card = h('div', { class: 'runner-card bz-card' }, top(),
      h('p', { class: 'prompt' }, puzzle.prompt || game.prompt), body);
    wrap.replaceChildren(card);
    wrap.scrollTop = 0;
    game.mount(body, puzzle, (ok) => {
      if (ok) score += 1;
      i += 1;
      const fb = h('p', { class: `feedback ${ok ? 'ok' : 'ng'}` }, ok ? (game.praise || 'せいかい！') : 'ざんねん！ こたえを 見てみよう');
      const btn = h('button', { class: 'btn primary next', onclick: next }, i >= total ? 'けっか' : 'つぎへ');
      card.append(h('div', { class: 'runner-foot' }, fb, btn));
      btn.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    });
  };

  const finish = () => {
    const g = gameRec(p, game.id);
    const stars = starsFor(score, total);
    const before = g.stage;
    g.plays += 1;
    g.stars += stars;
    if (stars >= 2) g.stage += 1;
    const d = dayRec(p);
    d.rounds += 1;
    const pts = Math.max(0, Math.min(stars * BRAIN_PER_STAR, BRAIN_DAY_CAP - d.pts));
    d.pts += pts;
    if (pts > 0) deps.gain(p, pts, `ひらめき パズル（${game.title}）`); else save();
    const up = g.stage > before;
    wrap.replaceChildren(h('div', { class: 'runner-card result bz-result' },
      h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 84, height: 84, class: 'bz-piyo' }),
      h('p', { class: 'big' }, `${score} / ${total}`),
      starRow(stars),
      h('p', { class: 'reward' }, up ? `ステージ ${g.stage} に 進んだ！` : stars ? 'いい ちょうし！' : 'もう1回 やってみよう'),
      h('p', { class: 'bz-pts' }, pts > 0 ? `+${pts} ポイント` : stars ? 'きょうの ポイントは いっぱい。力だめしは つづけられるよ' : ''),
      h('div', { class: 'runner-foot' },
        h('button', { class: 'btn primary next', onclick: () => play(p, game, deps) }, 'もう1回'),
        h('button', { class: 'btn', onclick: () => { close(); openBrain(p, deps); } }, 'ほかの パズル'))));
  };
  next();
}

// ---- えらぶ 画面 ----
export function openBrain(p, deps) {
  document.querySelector('.sheet.bz-sheet')?.remove();
  const close = () => sheet.remove();
  const d = dayRec(p);
  const sheet = h('div', { class: 'sheet bz-sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card' },
      h('div', { class: 'coach' }, h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 48, height: 48 }),
        h('p', {}, 'どの パズルで あそぶ？')),
      h('div', { class: 'bz-grid' }, GAMES.map((g) => {
        const r = gameRec(p, g.id);
        return h('button', { type: 'button', class: 'bz-game', onclick: () => { close(); play(p, g, deps); } },
          h('span', { class: 'bz-thumb', html: g.thumb }),
          h('b', {}, g.title),
          h('small', {}, g.sub),
          h('span', { class: 'bz-stage' }, `ステージ ${r.stage}`));
      })),
      h('p', { class: 'more-meter' }, d.pts >= BRAIN_DAY_CAP
        ? 'きょうの ポイントは いっぱい（力だめしは つづけられるよ）'
        : `ほし1こ ${BRAIN_PER_STAR}ポイント（1日 ${BRAIN_DAY_CAP}ポイントまで${d.pts ? `・あと ${BRAIN_DAY_CAP - d.pts}` : ''}）`),
      h('button', { class: 'link', type: 'button', onclick: close }, 'とじる')));
  document.body.append(sheet);
}

// クエストの画面の カード
export function brainCard(p, deps) {
  const total = GAMES.reduce((n, g) => n + (rec(p).st[g.id]?.stars || 0), 0);
  return h('div', { class: 'card quest bz-card-home' },
    h('div', { class: 'more-head' },
      h('span', { class: 'bz-home-ic', html: icepath.thumb }),
      h('div', {},
        h('h3', {}, 'ひらめき パズル'),
        h('p', {}, 'こおりの道・つみき・おりがみ・きまり'))),
    total ? h('p', { class: 'more-meter' }, `あつめた ほし ${total}こ`) : null,
    h('button', { class: 'btn', onclick: () => openBrain(p, deps) }, icon('puzzle'), ' あそぶ'));
}
