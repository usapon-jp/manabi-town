// 教科の たまごの 画面（カード・ピヨ先生の ことば・うえる 場所えらび）。きまりは js/eggs.js、3D は js/eggs3d.js。
// 草原は 見えたまま（.sheet に しない）。カードは いつも 1まい、ボタンは 1つだけ（つぎに やることが まよわない）。
import { h } from './ui.js';
import { currentProfile, onChange, save } from './store.js';
import { subjectNames } from './subjects.js';
import { currentIslandId, START } from './islands.js';
import {
  EGGS, eggDef, eggsOf, hasEggs, giveEggs, stateOf, wordsOf, needsTap, eggSubject, setEggSubject, warmMinutes,
  hatchEgg, plantSeed, finishBuilding, unlockLabels, hatchedCount,
} from './eggs.js';
import { bankLevel } from './bank.js';

const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;
const subjOf = (p) => subjectNames(p);
const isAdult = (p) => p?.grade === 'adult';

let world = null;
let deps = { study: () => {}, isHome: () => true };
let card = null;          // いま 出ている カード
let plantBar = null;

// ---- main.js から ----
export function initEggs(w, d) {
  world = w;
  deps = { ...deps, ...d };
  if (!world?.eggs) return;
  world.onTapEgg = (hit) => { const p = currentProfile(); if (p && !busy()) openFor(p, hit); };
  refreshView();
  onChange(refreshView);
  // 時間で 育つので、ときどき 見なおす。勉強の 反応も ここで（町が 見えている ときだけ）
  setInterval(() => { if (deps.isHome()) { refreshView(); checkWarmth(); } }, 2500);
}
const busy = () => !!document.querySelector('.tour, .sheet, .avatar-name, .egg-intro, .egg-born') || !!plantBar;

// 3D に いまの すがたを わたす
export function refreshView() {
  const p = currentProfile();
  if (!world?.eggs) return;
  const has = !!p && hasEggs(p) && currentIslandId(p) === START;
  const now = Date.now();
  const subs = p ? subjOf(p) : [];
  const e = p ? eggsOf(p) : null;
  const views = EGGS.map((d) => {
    const st = has ? stateOf(p, d.id, now, subs) : null;
    return st ? { id: d.id, ...st, seed: e.seed?.[d.id] || null, tap: needsTap(st), lv: d.id === 'sansu' && st.phase === 'built' ? bankLevel(p, subs).lv : 0 } : { id: d.id, phase: 'none' };
  });
  world.eggs.setView(views, has);
}

// ---- ピヨ先生の ひとこと（上に 小さく。1文 20字ほど） ----
let sayEl = null; let sayTimer = 0; const sayQueue = [];
export function piyoSay(text, sec = 3.2) {
  sayQueue.push({ text, sec });
  if (!sayEl || sayEl.hidden) nextSay();
}
function nextSay() {
  const q = sayQueue.shift();
  if (!q) { if (sayEl) sayEl.hidden = true; return; }
  if (!sayEl) {
    sayEl = h('div', { class: 'egg-say', role: 'status' }, h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 34, height: 34 }), h('p'));
    document.body.append(sayEl);
  }
  sayEl.querySelector('p').textContent = q.text;
  sayEl.hidden = false;
  sayEl.classList.remove('pop'); void sayEl.offsetWidth; sayEl.classList.add('pop');
  clearTimeout(sayTimer);
  sayTimer = setTimeout(nextSay, q.sec * 1000);
}

// ---- 勉強した 分が とどいたら 反応（この端末で さいごに 見た 分を おぼえる） ----
const SEEN_KEY = 'manabi-egg-seen';
function readSeen() { try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } }
function writeSeen(v) { try { localStorage.setItem(SEEN_KEY, JSON.stringify(v)); } catch (_) { /* おぼえられなくても 町は 動く */ } }
export function checkWarmth() {
  const p = currentProfile();
  if (!p || !hasEggs(p) || !world?.eggs || currentIslandId(p) !== START || busy()) return;
  const subs = subjOf(p);
  const all = readSeen();
  const mine = all[p.id] && typeof all[p.id] === 'object' ? all[p.id] : {};
  let changed = false;
  for (const d of EGGS) {
    const st = stateOf(p, d.id, Date.now(), subs);
    if (!st || st.phase === 'built' || st.phase === 'hatched') continue;
    const key = `${st.phase}:${d.id}`;
    const m = Math.round(warmMinutes(p, d.id, subs) * 10) / 10;
    const seen = mine[key];
    const subject = eggSubject(p, d.id, subs);
    if (typeof seen === 'number' && m > seen + 0.4) {
      world.eggs.react(d.id);
      piyoSay(st.phase === 'seed' ? `${subject}で たねに 水を あげたよ` : `${subject}で たまごが ぽかぽか！`);
    }
    if (seen !== m) { mine[key] = m; changed = true; }
    // うまれそう・できあがりそう に なった しゅんかん
    const rk = `ready:${key}`;
    if (st.stage === 'ready' && !mine[rk]) {
      if (typeof seen === 'number') piyoSay(st.phase === 'seed' ? `${d.building.name}が できそう！` : `${subject}の たまご、うまれそう！`);
      mine[rk] = 1; changed = true;
    }
  }
  if (changed) { all[p.id] = mine; writeSeen(all); }
}

// ---- たまごを もらう（はじめて 町を ひらいたとき。名前と チュートリアルの あと） ----
export function offerEggs(p, onDone) {
  if (!p || hasEggs(p) || document.querySelector('.egg-intro')) { onDone?.(); return; }
  if (world?.eggs) world.focus(world.eggs.nest.x, world.eggs.nest.z);
  const say = h('p', { class: 'an-say' }, 'たまごを 5つ もってきたよ');
  const sub = h('p', { class: 'egg-sub' }, 'べんきょうすると はやく うまれるよ');
  const btn = h('button', { class: 'btn primary', type: 'button' }, 'うけとる');
  const box = h('div', { class: 'an-card egg-intro-card' },
    h('div', { class: 'an-coach' }, h('img', { src: 'assets/icons/icon-192.png', alt: 'ピヨ先生', width: 44, height: 44 }), say),
    h('div', { class: 'egg-row' }, EGGS.map((d) => eggIcon(d.color))),
    sub, btn);
  const root = h('div', { class: 'egg-intro avatar-name' }, box);
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    btn.disabled = true;
    giveEggs(p, Date.now(), subjOf(p));
    save();
    refreshView();
    const warm = EGGS.filter((d) => (eggsOf(p).pre?.[d.id] || 0) > 0);
    EGGS.forEach((d, i) => setTimeout(() => world?.eggs?.react(d.id), 250 + i * 160));
    say.textContent = 'どれから あたためる？';
    sub.textContent = warm.length ? 'いままでの べんきょうで 少し あたたかいよ' : 'たまごを タッチすると ようすが わかるよ';
    btn.hidden = true;
    world?.celebrate?.();
    setTimeout(() => {
      root.classList.add('gone');
      setTimeout(() => { root.remove(); world?.focus(null); markSeen(p); onDone?.(); }, 300);
    }, 2600);
  });
  document.body.append(root);
}
// もらった ときの 分は「もう 見た」ことに する（いきなり 反応が 出ないように）
function markSeen(p) {
  const all = readSeen();
  all[p.id] = {};
  writeSeen(all);
  checkWarmth();
}

function eggIcon(color, small) {
  return h('i', { class: `egg-ic${small ? ' sm' : ''}`, style: `--c:${css(color)}`, 'aria-hidden': 'true' });
}

// ---- タップした ものの カード ----
function closeCard() {
  if (!card) return;
  const c = card; card = null;
  c.classList.add('gone');
  setTimeout(() => c.remove(), 250);
}
function showCard(...kids) {
  closeCard();
  const el = h('div', { class: 'egg-card' }, h('div', { class: 'egg-card-in' },
    h('button', { class: 'egg-x', type: 'button', 'aria-label': 'とじる', onclick: closeCard }, '×'), ...kids.flat().filter(Boolean)));
  el.addEventListener('click', (e) => { if (e.target === el) closeCard(); });
  document.body.append(el);
  card = el;
}
function meter(k, color) {
  // 数字は 出さない。あたたかさの バーだけ
  return h('div', { class: 'egg-meter', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.max(6, Math.round(k * 100))}%;--c:${css(color)}` }));
}
// つなげる 教科を えらぶ（おとな・その教科が 一覧に ない子だけ）
function linkPicker(p, d, subs) {
  const cur = eggSubject(p, d.id, subs);
  if (!isAdult(p) && subs.includes(cur)) return null;
  const sel = h('select', { class: 'egg-link', onchange: () => { if (setEggSubject(p, d.id, sel.value)) { save(); refreshView(); openFor(p, { id: d.id, what: 'egg' }); } } },
    subs.map((n) => h('option', { value: n, selected: n === cur || null }, n)));
  return h('label', { class: 'egg-link-row' }, h('span', {}, 'つなげる べんきょう'), sel);
}
function studyBtn(p, subject) {
  return h('button', { class: 'btn primary', type: 'button', onclick: () => { closeCard(); deps.study(p, subject); } }, `${subject}を べんきょうする`);
}

// 建物の カードを しくみごとに 入れかえる（bankui.js など）。fn(p, d, 道具)
const buildingCards = new Map();
export function registerBuildingCard(id, fn) { buildingCards.set(id, fn); }

// その教科の カードを ひらく（ほかの 画面から「たまごを 見る」に つかえる）
export function openEggCard(p, id) {
  if (p && hasEggs(p)) openFor(p, { id, what: 'egg' });
}

function openFor(p, hit) {
  const d = eggDef(hit.id);
  if (!d) return;
  const subs = subjOf(p);
  const st = stateOf(p, d.id, Date.now(), subs);
  if (!st) return;
  const subject = eggSubject(p, d.id, subs);
  if (st.phase === 'egg') {
    const ready = st.stage === 'ready';
    showCard(
      h('div', { class: 'egg-head' }, eggIcon(d.color), h('b', {}, `${subject}の たまご`)),
      h('p', { class: 'egg-words' }, wordsOf(st)),
      meter(st.k, d.color),
      ready ? h('button', { class: 'btn primary egg-go', type: 'button', onclick: () => { closeCard(); doHatch(p, d); } }, 'うまれる！')
        : studyBtn(p, subject),
      ready ? null : h('p', { class: 'egg-hint' }, '10分 やると ぐんと そだつよ'),
      linkPicker(p, d, subs));
    return;
  }
  if (st.phase === 'hatched') {
    showCard(
      h('div', { class: 'egg-head' }, eggIcon(d.color), h('b', {}, d.chara.name)),
      h('p', { class: 'egg-words' }, `${d.building.name}の たねを うえよう`),
      h('button', { class: 'btn primary', type: 'button', onclick: () => { closeCard(); startPlant(p, d); } }, 'たねを うえる'));
    return;
  }
  if (st.phase === 'seed') {
    const ready = st.stage === 'ready';
    showCard(
      h('div', { class: 'egg-head' }, eggIcon(d.color), h('b', {}, `${d.building.name}の たね`)),
      h('p', { class: 'egg-words' }, wordsOf(st)),
      meter(st.k, d.color),
      ready ? h('button', { class: 'btn primary egg-go', type: 'button', onclick: () => { closeCard(); doBuild(p, d); } }, 'できあがり！')
        : studyBtn(p, subject),
      ready ? null : h('p', { class: 'egg-hint' }, `${subject}で 水を あげられるよ`));
    return;
  }
  // できた 建物・そこに すむ なかま。しくみ（銀行 など）が あれば そちらの カードを 出す
  const custom = buildingCards.get(d.id);
  if (custom) { custom(p, d, { showCard, closeCard, eggIcon, studyBtn, piyoSay, chime, subject, subs }); return; }
  showCard(
    h('div', { class: 'egg-head' }, eggIcon(d.color), h('b', {}, `${d.chara.name}の ${d.building.name}`)),
    h('p', { class: 'egg-words' }, 'いつも ありがとう！'),
    studyBtn(p, subject));
}

// ---- 生まれる ----
function doHatch(p, d) {
  if (!world?.eggs) return;
  world.focus(world.eggs.nest.x, world.eggs.nest.z);
  chime(false);
  world.eggs.hatch(d.id).then(() => {
    const first = hatchedCount(p) === 0;
    const fresh = hatchEgg(p, d.id, Date.now(), subjOf(p));
    if (fresh == null) { world.focus(null); refreshView(); return; }
    save();
    refreshView();
    world.celebrate?.();
    chime(true);
    const labels = unlockLabels(d.id);
    celebrate(`${d.chara.name}が うまれた！`, `${d.building.name}の たねを くれたよ`, d.color,
      [labels.length ? `${labels.join('と ')}が つかえるよ` : null, first ? 'すきな 場所に うえてね' : null],
      'たねを うえる', () => startPlant(p, d));
  });
}

// ---- 建物が できる ----
function doBuild(p, d) {
  if (!finishBuilding(p, d.id, Date.now(), subjOf(p))) return;
  save();
  refreshView();
  const spot = world?.eggs?.spotOf(d.id);
  if (spot) world.focus(spot.x, spot.z);
  world?.eggs?.pop(d.id);
  world?.celebrate?.();
  chime(true);
  setTimeout(() => celebrate(`${d.building.name}が できたよ！`, `${d.chara.name}が すむよ`, d.color, [], 'やったね！', null), 1800);
}

// おいわいの カード（ボタン 1つ。あとで も えらべる）
function celebrate(title, sub, color, lines, label, then) {
  const colors = ['#ff7a8a', '#ffd84a', '#8fd6f2', '#9fe0a0', '#c7a6ff', '#ffb27a'];
  const confetti = Array.from({ length: 36 }, (_, i) => h('i', { style: `left:${(i * 37) % 100}%;background:${colors[i % colors.length]};animation-delay:${(i % 9) * 0.1}s;animation-duration:${2.2 + (i % 5) * 0.35}s` }));
  const done = (go) => { el.remove(); world?.focus(null); if (go) then?.(); };
  const el = h('div', { class: 'egg-born' },
    h('div', { class: 'egg-confetti', 'aria-hidden': 'true' }, confetti),
    h('div', { class: 'egg-born-card' },
      h('div', { class: 'egg-born-pic' }, eggIcon(color)),
      h('p', { class: 'egg-born-title' }, title),
      h('p', { class: 'egg-born-sub' }, sub),
      ...lines.filter(Boolean).map((t) => h('p', { class: 'egg-born-line' }, t)),
      h('button', { class: 'btn primary', type: 'button', onclick: () => done(true) }, label),
      then ? h('button', { class: 'link', type: 'button', onclick: () => done(false) }, 'あとで') : null));
  document.body.append(el);
}

// ---- たねを うえる 場所えらび ----
function startPlant(p, d) {
  if (!world?.eggs || plantBar) return;
  world.focus(null);
  world.eggs.beginPlant(d.id);
  const ok = h('button', { class: 'btn primary', type: 'button' }, 'ここに うえる');
  const msg = h('p', {}, 'あるいて 場所を きめてね');
  const end = () => { clearInterval(tick); world.eggs.endPlant(); plantBar?.remove(); plantBar = null; refreshView(); };
  ok.addEventListener('click', () => {
    const at = world.eggs.plantSpot();
    if (!at) { msg.textContent = 'ここは うえられないよ'; return; }
    if (!plantSeed(p, d.id, at.x, at.z, at.rot)) { end(); return; }
    save();
    end();
    chime(false);
    piyoSay(`${d.building.name}の たねを うえたよ！`);
    piyoSay('べんきょうで はやく そだつよ');
  });
  plantBar = h('div', { class: 'egg-plant' }, h('div', { class: 'egg-plant-in' },
    h('div', { class: 'egg-head' }, eggIcon(d.color, true), msg),
    h('div', { class: 'egg-plant-row' }, h('button', { class: 'btn', type: 'button', onclick: end }, 'やめる'), ok)));
  document.body.append(plantBar);
  const tick = setInterval(() => {
    // ほかの タブへ いった・ほかの 子に かわった ときは やめる
    if (!deps.isHome() || currentProfile() !== p) { if (!document.querySelector('.egg-born')) end(); return; }
    const good = !!world.eggs.plantSpot();
    ok.disabled = !good;
    msg.textContent = good ? 'ここで いい？' : 'あるいて 場所を きめてね';
  }, 200);
}

// ---- 音（ちいさな チャイム）。ならせない 端末では なにもしない ----
function chime(big) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
    const ac = new Ctx(); const t0 = ac.currentTime;
    (big ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 880]).forEach((f, i) => {
      const o = ac.createOscillator(); const g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + i * 0.11); g.gain.linearRampToValueAtTime(0.1, t0 + i * 0.11 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.11 + 0.5);
      o.connect(g); g.connect(ac.destination); o.start(t0 + i * 0.11); o.stop(t0 + i * 0.11 + 0.55);
    });
    setTimeout(() => ac.close?.(), 1500);
  } catch (_) { /* 音が 出せなくても つづける */ }
}
