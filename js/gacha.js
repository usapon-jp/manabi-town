// パーツガチャ。ポイントを「ガチャ石」にこうかんして、石1こで1回ひく。
// 中身は js/data/gacha.js（ふやすときは そちらだけ直す）。
//
// 保存（プロフィールの p.gacha）:
//   stones: もっている石の数（ほかの端末とは ふえた分を足しあわせる。merge.js）
//   got:    もらったものの記録 [{ id, item, banner, at }]。1こずつ id があるので、端末をまたいでも まざらない
//   kiraUsed: つかった きらきらの数（使い道は あとで）
// もっている数・天井までの回数・きらきらは、ぜんぶ got から計算する（ずれないように）。
//
// 3Dの箱庭からは ownedParts / ownedSeeds / ownedCharas を使う。
import { h, toast } from './ui.js';
import { save, spendPoints } from './store.js';
import { icon } from './icons.js';
import { CATS, RARITY, PITY, STONE_PRICE, ITEMS, BANNERS } from './data/gacha.js';

const byId = new Map(ITEMS.map((i) => [i.id, i]));
export const itemById = (id) => byId.get(id) || null;

function g(p) {
  if (!p.gacha || typeof p.gacha !== 'object') p.gacha = {};
  if (!Number.isFinite(p.gacha.stones)) p.gacha.stones = 0;
  if (!Array.isArray(p.gacha.got)) p.gacha.got = [];
  return p.gacha;
}

export const stones = (p) => g(p).stones;

// いま ひける台（期間内のもの）
export function activeBanners(d = new Date()) {
  const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return BANNERS.filter((b) => (!b.from || b.from <= t) && (!b.to || t <= b.to));
}

// もらった数 { itemId: 何回 }（知らない id は読みとばす）
function counts(p) {
  const n = {};
  g(p).got.forEach((r) => { if (byId.has(r.item)) n[r.item] = (n[r.item] || 0) + 1; });
  return n;
}

// 箱庭でおける数 { itemId: こすう }（たてる・かざる）。おいた数は 箱庭のほうで引く
export function ownedParts(p) {
  const out = {};
  Object.entries(counts(p)).forEach(([id, n]) => {
    const it = byId.get(id);
    if (CATS[it.cat]?.stack) out[id] = n * (it.qty || 1);
  });
  return out;
}
// うえられる花の種類（plants.js の SPECIES のキー）
export function ownedSeeds(p) {
  return new Set(Object.keys(counts(p)).map((id) => byId.get(id)).filter((it) => it.cat === 'seed').map((it) => it.species));
}
// なかまになったキャラ
export function ownedCharas(p) {
  return Object.keys(counts(p)).map((id) => byId.get(id)).filter((it) => it.cat === 'chara');
}
// きらきら = 1回で ずっと使えるもの が かぶった数
export function kira(p) {
  let n = 0;
  Object.entries(counts(p)).forEach(([id, c]) => { if (!CATS[byId.get(id).cat]?.stack) n += c - 1; });
  return Math.max(0, n - (g(p).kiraUsed || 0));
}

// 最後の ★3 から何回ひいたか（台ごと）
function sinceTop(p, bannerId) {
  const got = g(p).got.filter((r) => r.banner === bannerId).sort((a, b) => a.at - b.at);
  let n = 0;
  got.forEach((r) => { n = itemById(r.item)?.rarity === 3 ? 0 : n + 1; });
  return n;
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function pickRarity(rnd) {
  let x = rnd() * 100;
  for (const r of [3, 2, 1]) { x -= RARITY[r].rate; if (x < 0) return r; }
  return 1;
}

// 1回分をきめる。min: これより下の★は出さない
function rollOne(banner, since, min, rnd) {
  let r = since + 1 >= PITY ? 3 : pickRarity(rnd);
  if (r < min) r = min;
  const pool = banner.items.map(itemById).filter(Boolean);
  let list = pool.filter((i) => i.rarity === r);
  // その★がない台なら、近い★から
  for (let d = 1; !list.length && d < 3; d++) list = pool.filter((i) => i.rarity === r - d || i.rarity === r + d);
  if (!list.length) list = pool;
  return list[Math.floor(rnd() * list.length)];
}

// n回ひく。10回のときは ★2以上が1つは出る。石が足りなければ null
export function pull(p, banner, n, rnd = Math.random) {
  const st = g(p);
  if (st.stones < n) return null;
  const before = counts(p);
  let since = sinceTop(p, banner.id);
  const out = [];
  for (let i = 0; i < n; i++) {
    const last = n >= 10 && i === n - 1 && !out.some((x) => x.it.rarity >= 2);
    const it = rollOne(banner, since, last ? 2 : 1, rnd);
    since = it.rarity === 3 ? 0 : since + 1;
    const had = (before[it.id] || 0) + out.filter((x) => x.it.id === it.id).length;
    out.push({ it, isNew: had === 0, dup: had > 0 && !CATS[it.cat]?.stack });
    st.got.push({ id: uid(), item: it.id, banner: banner.id, at: Date.now() + i });
  }
  st.stones -= n;
  save();
  return out;
}

// ポイントを石にこうかん
export function exchange(p, n) {
  if (p.points < STONE_PRICE * n) return false;
  spendPoints(p, STONE_PRICE * n, `ガチャ石 ${n}こ と こうかん`);
  g(p).stones += n;
  save();
  return true;
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

function thumb(it, { locked = false, n = 0 } = {}) {
  return h('span', { class: `g-thumb r${it.rarity} ${locked ? 'locked' : ''}`, style: `--c:${it.color || '#8a735d'}` },
    svgEl(locked ? '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>' : it.svg),
    n > 1 ? h('i', { class: 'g-n' }, `×${n}`) : null);
}

function sheet(cls, ...kids) {
  const close = () => el.remove();
  const el = h('div', { class: `sheet ${cls}-sheet`, onclick: (e) => { if (e.target === el) close(); } },
    h('div', { class: `sheet-card ${cls}` }, ...kids));
  document.body.append(el);
  return { el, close };
}

export function openGacha(p, deps, bannerId) {
  document.querySelector('.gacha-sheet')?.remove();
  const banners = activeBanners();
  const banner = banners.find((b) => b.id === bannerId) || banners[0];
  if (!banner) { toast('いまは ガチャが お休みだよ'); return; }
  const st = g(p);
  const left = PITY - sinceTop(p, banner.id);
  const have = counts(p);
  const reopen = () => { s.close(); deps.render(); openGacha(p, deps, banner.id); };

  const swap = (n) => h('button', {
    class: 'g-swap', disabled: p.points < STONE_PRICE * n,
    onclick: () => { if (exchange(p, n)) { toast(`ガチャ石を ${n}こ もらった！`); reopen(); } },
  }, icon('sprout'), `${STONE_PRICE * n}`, h('span', { class: 'arrow' }, icon('chevron-right')), gemIcon(), `${n}`);

  const pullBtn = (n) => h('button', {
    class: `btn ${n === 1 ? 'primary' : ''} g-pull`, disabled: st.stones < n,
    onclick: () => {
      const res = pull(p, banner, n);
      if (!res) { toast('石が たりないよ'); return; }
      s.close(); deps.render();
      showResult(p, deps, banner, res);
    },
  }, `${n}回 ひく`, h('small', {}, gemIcon(), `${n}`));

  // もっているもの（台の中身をしゅるいごとに。まだのものは ？）
  const pool = banner.items.map(itemById).filter(Boolean);
  const cats = Object.keys(CATS).filter((c) => pool.some((i) => i.cat === c));
  const owned = pool.filter((i) => have[i.id]).length;
  const book = h('div', { class: 'g-book' },
    h('h4', {}, 'あつめた パーツ', h('small', {}, `${owned} / ${pool.length}`)),
    ...cats.map((c) => h('div', { class: 'g-cat' },
      h('b', {}, CATS[c].label),
      h('ul', { class: 'g-grid' }, pool.filter((i) => i.cat === c).sort((a, b) => a.rarity - b.rarity).map((it) => {
        const n = have[it.id] || 0;
        return h('li', {}, h('button', { class: 'g-cell', onclick: () => openItem(it, n) },
          thumb(it, { locked: !n, n: CATS[c].stack ? n * (it.qty || 1) : 0 }),
          h('small', {}, n ? it.name : '？'), stars(it.rarity)));
      })))));

  const s = sheet('gacha-card',
    banners.length > 1 ? h('div', { class: 'g-tabs' }, banners.map((b) => h('button', { class: b.id === banner.id ? 'on' : '', onclick: () => { s.close(); openGacha(p, deps, b.id); } }, b.title))) : null,
    h('p', { class: 'sheet-title' }, capsuleIcon(), ` ${banner.title}ガチャ`),
    h('p', { class: 'sheet-sub' }, banner.sub),
    h('div', { class: 'g-machine', 'aria-hidden': 'true' }, h('i', { class: 'b1' }), h('i', { class: 'b2' }), h('i', { class: 'b3' }), h('i', { class: 'b4' })),
    h('div', { class: 'g-wallet' },
      h('span', { class: 'g-chip' }, gemIcon(), h('b', {}, `${st.stones}`)),
      h('span', { class: 'g-chip soft' }, icon('sprout'), `${p.points}`),
      kira(p) ? h('span', { class: 'g-chip soft' }, icon('sparkles'), `${kira(p)}`) : null),
    h('div', { class: `g-swaps ${st.stones ? '' : 'hint'}` }, swap(1), swap(10)),
    h('div', { class: 'g-pulls' }, pullBtn(1), pullBtn(10)),
    h('div', { class: 'g-pity' },
      h('span', { class: 'gbar' }, h('i', { style: `width:${Math.round(((PITY - left) / PITY) * 100)}%` })),
      h('small', {}, `★3 まで あと ${left}回`)),
    book,
    h('details', { class: 'g-rates' }, h('summary', {}, 'でる かくりつ'),
      h('p', {}, [3, 2, 1].map((r) => `★${r} ${RARITY[r].rate}%`).join('・')),
      h('p', {}, `${PITY}回目までに ★3 が かならず出る。10回ひくと ★2いじょうが 1つは出る。`),
      h('p', {}, 'さく・たてもの・こものは、出るたびに ふえる。タネと なかまは 2回目から きらきら に なる。')),
    h('button', { class: 'link', onclick: () => s.close() }, 'とじる'),
  );
}

function openItem(it, n) {
  const sp = sheet('g-item-card',
    thumb(it, { locked: !n }),
    h('p', { class: 'sheet-title' }, n ? it.name : '？？？'),
    stars(it.rarity),
    h('p', { class: 'sheet-sub' }, n ? `${CATS[it.cat].label}${it.size ? `・高さ ${it.size}m` : ''}` : 'まだ もっていないよ'),
    n ? h('p', { class: 'g-soon' }, it.cat === 'seed' ? '「つくる」の花で うえられるよ（じゅんびちゅう）' : it.cat === 'chara' ? '街に すんでくれるよ（じゅんびちゅう）' : '「つくる」で おけるよ（じゅんびちゅう）') : null,
    h('button', { class: 'link', onclick: () => sp.close() }, 'とじる'));
}

// ひいたあと: カプセルをタップしてあける → 中身がポン
function showResult(p, deps, banner, res) {
  const top = Math.max(...res.map((x) => x.it.rarity));
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
        h('p', { class: 'sheet-title' }, top === 3 ? 'めずらしいのが 出た！' : res.length > 1 ? `${res.length}こ もらった！` : 'もらった！'),
        h('ul', { class: `g-got ${res.length > 1 ? 'many' : ''}` }, res.map((x, i) => h('li', { style: `--i:${i}`, class: `r${x.it.rarity}` },
          thumb(x.it),
          x.isNew ? h('i', { class: 'g-new' }, 'NEW') : x.dup ? h('i', { class: 'g-kira' }, icon('sparkles'), '+1') : null,
          h('b', {}, x.it.name, CATS[x.it.cat]?.stack && (x.it.qty || 1) > 1 ? ` ×${x.it.qty}` : ''),
          stars(x.it.rarity)))),
        res.some((x) => x.dup) ? h('p', { class: 'sheet-sub' }, 'かぶったタネは きらきら に なったよ') : null,
        h('button', { class: 'btn primary', onclick: () => { s.close(); openGacha(p, deps, banner.id); } }, 'OK'),
      ].filter(Boolean));
    }, 420);
  }
}
