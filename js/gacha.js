// ガチャ。ガチャ石1こで1回ひく。石は「毎日1回のログインボーナス」「レベルアップごと」「ポイント200 と こうかん」で手に入る
// （数字は js/data/gacha.js の STONES）。出るのは、まだ持っていないものから めずらしさの重みで1つ（かぶらない）。
// 中身の表（js/data/gacha.js）は 3Dの箱庭の「もちもの」の台帳もかねる（ownedSet / ownedOfKind / isOwned）。
//
// 保存（プロフィールの p.gacha）。石の数は 記録から計算する（端末をまたいでも ずれない・ふえすぎない）:
//   days: { 'YYYY-MM-DD': 1 }  ログインボーナスをもらった日
//   lv0:  はじめてガチャを見たときのレベル（それより上がった分だけ石がもらえる）
//   buys: [{ id, at, n }]      ポイントとの こうかん
//   got:  [{ id, item, at }]   ひいて出たもの
import { h, toast } from './ui.js';
import { save, spendPoints, today, currentProfile } from './store.js';
import { icon } from './icons.js';
import { levelOf } from './progress.js';
import { KINDS, RARITY, STONES, ITEMS } from './data/gacha.js';

const byId = new Map(ITEMS.map((i) => [i.id, i]));
export const itemById = (id) => byId.get(id) || null;
const ready = (it) => it.ready !== false;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

function g(p) {
  if (!p.gacha || typeof p.gacha !== 'object') p.gacha = {};
  const st = p.gacha;
  st.days = obj(st.days);
  if (!Array.isArray(st.buys)) st.buys = [];
  if (!Array.isArray(st.got)) st.got = [];
  return st;
}
const level = (p) => levelOf(p).lv;

// いま もっている石
export function stones(p) {
  const st = g(p);
  const lv0 = typeof st.lv0 === 'number' ? st.lv0 : level(p);
  const earned = Object.keys(st.days).length * STONES.daily
    + Math.max(0, level(p) - lv0) * STONES.perLevel
    + st.buys.reduce((n, b) => n + (Number(b.n) || 0), 0);
  return Math.max(0, earned - st.got.length);
}

// きょうのログインボーナスと、上がったレベルの分を たしかめる。もらった数をかえす（お知らせ用）
export function grantFree(p) {
  if (!p) return { daily: 0, level: 0 };
  const st = g(p);
  const lv = level(p);
  let changed = false;
  // はじめての人は いまのレベルから数える（さかのぼって くばらない）
  if (typeof st.lv0 !== 'number') { st.lv0 = lv; st.lvSeen = lv; changed = true; }
  const daily = st.days[today()] ? 0 : STONES.daily;
  if (daily) { st.days[today()] = 1; changed = true; }
  const seen = typeof st.lvSeen === 'number' ? st.lvSeen : lv;
  const up = Math.max(0, lv - seen) * STONES.perLevel;
  if (lv !== st.lvSeen) { st.lvSeen = lv; changed = true; }
  if (changed) save();
  return { daily, level: up };
}

// ポイントを石にこうかん（けいけんち・レベルは へらない）
export function exchange(p, n = 1) {
  if (p.points < STONES.price * n) return false;
  spendPoints(p, STONES.price * n, `ガチャ石 ${n}こ と こうかん`);
  g(p).buys.push({ id: uid(), at: Date.now(), n });
  save();
  return true;
}

// ---- もちもの（3Dの箱庭もここを読む） ----
export function ownedSet(p = currentProfile()) {
  const s = new Set(ITEMS.filter((i) => i.own).map((i) => i.id));
  if (p) g(p).got.forEach((r) => { if (byId.has(r.item)) s.add(r.item); });
  return s;
}
export const isOwned = (id, p) => ownedSet(p).has(id);
export const ownedOfKind = (kind, p) => ITEMS.filter((i) => i.kind === kind && ready(i) && isOwned(i.id, p)).map((i) => i.id);
// うえられる花の種類（plants.js の SPECIES のキー）
export const ownedSeeds = (p) => new Set(ownedOfKind('seed', p).map((id) => byId.get(id).species));
export const ownedCharas = (p) => ownedOfKind('chara', p).map((id) => byId.get(id));

// ひけるもの（3Dができていて、まだ持っていないもの）
export const pool = (p) => ITEMS.filter((i) => ready(i) && !i.own && !isOwned(i.id, p));

// 1回ひく。石が足りない・ぜんぶ持っている ときは { ok: false }
export function pull(p, rnd = Math.random) {
  if (stones(p) < 1) return { ok: false, why: 'stones' };
  const list = pool(p);
  if (!list.length) return { ok: false, why: 'complete' };
  const total = list.reduce((n, i) => n + RARITY[i.rarity].weight, 0);
  let r = rnd() * total;
  let it = list[list.length - 1];
  for (const x of list) { r -= RARITY[x.rarity].weight; if (r < 0) { it = x; break; } }
  g(p).got.push({ id: uid(), item: it.id, at: Date.now() });
  save();
  return { ok: true, item: it };
}

// まとめて n回ひく（10連）。のこりが n より少なければ、のこりの数だけ（石もその数だけ）
export const manyCount = (p, n = 10) => Math.min(n, pool(p).length);
export function pullMany(p, n = 10, rnd = Math.random) {
  const k = manyCount(p, n);
  if (!k) return { ok: false, why: 'complete' };
  if (stones(p) < k) return { ok: false, why: 'stones' };
  const items = [];
  for (let i = 0; i < k; i++) { const r = pull(p, rnd); if (r.ok) items.push(r.item); }
  return { ok: true, items };
}

// ---- 画面 --------------------------------------------------------------------------

const GEM = '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>';
const svgEl = (inner, cls = '') => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ['viewBox:0 0 24 24', 'fill:none', 'stroke:currentColor', 'stroke-width:2', 'stroke-linecap:round', 'stroke-linejoin:round', 'aria-hidden:true']
    .forEach((kv) => { const i = kv.indexOf(':'); el.setAttribute(kv.slice(0, i), kv.slice(i + 1)); });
  el.setAttribute('class', `ic g-svg ${cls}`.trim());
  el.innerHTML = inner;
  return el;
};
export const gemIcon = () => svgEl(GEM, 'gem');
export const capsuleIcon = () => svgEl('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><circle cx="12" cy="12" r="2.2"/>', 'capsule');
const stars = (r) => h('span', { class: 'g-stars', 'aria-label': `★${r}` }, '★'.repeat(r));

function thumb(it, { locked = false } = {}) {
  return h('span', { class: `g-thumb r${it.rarity} ${locked ? 'locked' : ''}`, style: `--c:${it.color || '#8a735d'}` },
    svgEl(locked ? '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>' : it.svg));
}

function sheet(cls, ...kids) {
  const close = () => el.remove();
  const el = h('div', { class: `sheet ${cls}-sheet`, onclick: (e) => { if (e.target === el) close(); } },
    h('div', { class: `sheet-card ${cls}` }, ...kids.filter(Boolean)));
  document.body.append(el);
  return { el, close };
}

// ログインボーナス・レベルアップの石をうけとって、お知らせする（main.js が画面を出すたびに よぶ）
export function checkFree(p) {
  const r = grantFree(p);
  if (r.daily && r.level) toast(`ガチャ石 ${r.daily + r.level}こ！（きょうの分＋レベルアップ）`);
  else if (r.daily) toast('きょうの ガチャ石 1こ！');
  else if (r.level) toast(`レベルアップで ガチャ石 ${r.level}こ！`);
  return r.daily + r.level;
}

export function openGacha(p, deps) {
  document.querySelector('.gacha-card-sheet')?.remove();
  const n = stones(p);
  const left = pool(p);
  const done = !left.length;
  const k10 = manyCount(p);
  const owned = ownedSet(p);
  const reopen = () => { s.close(); deps.render(); openGacha(p, deps); };

  const swap = (k) => h('button', {
    class: 'g-swap', disabled: p.points < STONES.price * k,
    onclick: () => { if (exchange(p, k)) { toast(`ガチャ石を ${k}こ もらった！`); reopen(); } },
  }, icon('sprout'), `${STONES.price * k}`, h('span', { class: 'arrow' }, icon('chevron-right')), gemIcon(), `${k}`);

  // あつめたもの（しゅるいごとに。まだのものは ？）
  const shown = ITEMS.filter(ready);
  const soon = ITEMS.filter((i) => !ready(i)).length;
  const book = h('div', { class: 'g-book' },
    h('h4', {}, 'あつめた もの', h('small', {}, `${shown.filter((i) => owned.has(i.id)).length} / ${shown.length}`)),
    ...Object.keys(KINDS).filter((k) => shown.some((i) => i.kind === k)).map((k) => h('div', { class: 'g-cat' },
      h('b', {}, KINDS[k].label),
      h('ul', { class: 'g-grid' }, shown.filter((i) => i.kind === k).sort((a, b) => a.rarity - b.rarity).map((it) => {
        const have = owned.has(it.id);
        return h('li', {}, h('button', { class: 'g-cell', onclick: () => openItem(it, have) },
          thumb(it, { locked: !have }), h('small', {}, have ? it.label : '？'), stars(it.rarity)));
      })))),
    soon ? h('p', { class: 'g-soon' }, icon('sparkles'), ` もうすぐ ${soon}こ ふえるよ`) : null);

  const s = sheet('gacha-card',
    h('p', { class: 'sheet-title' }, capsuleIcon(), ' ガチャ'),
    h('p', { class: 'sheet-sub' }, 'はこにわで つかえる ものが でるよ'),
    h('div', { class: 'g-machine', 'aria-hidden': 'true' }, h('i', { class: 'b1' }), h('i', { class: 'b2' }), h('i', { class: 'b3' }), h('i', { class: 'b4' })),
    h('div', { class: 'g-wallet' },
      h('span', { class: 'g-chip' }, gemIcon(), h('b', {}, `${n}`)),
      h('span', { class: 'g-chip soft' }, icon('sprout'), `${p.points}`)),
    done
      ? h('p', { class: 'g-done' }, icon('party-popper'), ' ぜんぶ あつめたよ！ 石は とっておいてね')
      : h('div', { class: 'g-pulls' },
        h('button', {
          class: 'btn primary g-pull', disabled: n < 1,
          onclick: () => {
            const r = pull(p);
            if (!r.ok) { toast(r.why === 'stones' ? '石が たりないよ' : 'ぜんぶ あつめたよ！'); return; }
            s.close(); deps.render();
            showResult(p, deps, [r.item]);
          },
        }, '1回 ひく', h('small', {}, gemIcon(), '1')),
        h('button', {
          class: 'btn g-pull', disabled: n < k10 || k10 < 2,
          onclick: () => {
            const r = pullMany(p, 10);
            if (!r.ok) { toast(r.why === 'stones' ? '石が たりないよ' : 'ぜんぶ あつめたよ！'); return; }
            s.close(); deps.render();
            showResult(p, deps, r.items);
          },
        }, k10 >= 10 ? '10連' : `まとめて ${k10}回`, h('small', {}, gemIcon(), `${k10}`))),
    h('div', { class: `g-swaps ${n || done ? '' : 'hint'}` }, swap(1), swap(10)),
    h('p', { class: 'g-how' }, `まいにち1こ・レベルアップで${STONES.perLevel}こ もらえるよ`),
    book,
    h('details', { class: 'g-rates' }, h('summary', {}, 'でる かくりつ'),
      h('p', {}, 'まだ もっていない ものから 1つ でる（かぶらない）。'),
      h('p', {}, `でやすさ ★1:★2:★3 = ${RARITY[1].weight}:${RARITY[2].weight}:${RARITY[3].weight}`)),
    h('button', { class: 'link', onclick: () => s.close() }, 'とじる'),
  );
}

function openItem(it, have) {
  const sp = sheet('g-item-card',
    thumb(it, { locked: !have }),
    h('p', { class: 'sheet-title' }, have ? it.label : '？？？'),
    stars(it.rarity),
    h('p', { class: 'sheet-sub' }, `${KINDS[it.kind]?.label || ''}・${RARITY[it.rarity].label}`),
    have ? h('p', { class: 'g-soon' }, it.kind === 'seed' ? '「つくる」の 花のタネで うえられるよ' : it.kind === 'chara' ? '街に すんでくれるよ' : it.kind === 'part' ? '家を タップして つけられるよ' : `「つくる」の ${it.kind === 'fence' ? '柵' : 'おきもの'}で つかえるよ`) : h('p', { class: 'g-soon' }, 'まだ もっていないよ'),
    h('button', { class: 'link', onclick: () => sp.close() }, 'とじる'));
}

// ひいたあと: カプセルをタップしてあける → 中身がポン
function showResult(p, deps, list) {
  const top = Math.max(...list.map((x) => x.rarity));
  const one = list.length === 1 ? list[0] : null;
  const s = sheet('g-result-card',
    h('button', { class: `g-capsule r${top}`, 'aria-label': 'あける', onclick: () => open() }, h('i', { class: 'top' }), h('i', { class: 'bot' })),
    h('p', { class: 'g-tap' }, icon('pointer'), ' タップして あける'));
  const card = s.el.querySelector('.sheet-card');
  let opened = false;
  function open() {
    if (opened) return;
    opened = true;
    card.classList.add('open');
    deps.celebrate?.();
    setTimeout(() => {
      card.replaceChildren(...[
        h('p', { class: 'sheet-title' }, top === 3 ? 'とても めずらしいのが 出た！' : one ? 'もらった！' : `${list.length}こ もらった！`),
        h('ul', { class: `g-got ${one ? '' : 'many'}` }, list.map((it, i) => h('li', { class: `r${it.rarity}`, style: `--i:${i}` },
          thumb(it), h('i', { class: 'g-new' }, 'NEW'), h('b', {}, it.label), stars(it.rarity)))),
        one ? h('p', { class: 'sheet-sub' }, one.kind === 'fence' ? '「つくる」の 柵で たてられるよ' : one.kind === 'piece' ? '「つくる」の おきもので おけるよ' : one.kind === 'part' ? '家を タップして つけられるよ' : '') : null,
        h('button', { class: 'btn primary', onclick: () => { s.close(); openGacha(p, deps); } }, 'OK'),
      ].filter(Boolean));
    }, 420);
  }
}
