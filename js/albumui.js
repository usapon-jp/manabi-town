// 町の アルバムの 画面（右の「アルバム」ボタン・本の ページ・1まいを 大きく 見る）。きまりは js/album.js。
// カメラで とった 写真が、古い じゅんに 1ページ 4まい ずつ はられる。日づけと 島の 名前は じどうで つく。
// ボタンは 少なく: ページを めくる ‹ ›、写真を タップで 大きく（スタンプ・ひとこと・ほぞん・けす）。
import { h } from './ui.js';
import { icon } from './icons.js';
import { currentProfile, onChange, save } from './store.js';
import { islandDef, START } from './islands.js';
import { getData, removePhoto, keepOnDevice } from './photos.js';
import { registerFeature } from './eggs.js';
import { piyoSay } from './eggui.js';
import { cameraLevel, SKY_NAMES } from './camera.js';
import {
  FEATURE, PER_PAGE, STAMPS, NOTE_MAX, albumLevel, can, shotCap, nextHint, albumShots, pagesOf, lastPage, stampDef, setStamp, setNote,
} from './album.js';

registerFeature(FEATURE, {
  label: 'アルバム',
  line: '旅の アルバムも くれたよ（右の「アルバム」）',
  built: 'アルバムに ひとことが 書けるよ',
});

let deps = { isHome: () => true, openCamera: () => {} };
let fab = null;
let sheet = null;

// ---- main.js から ----
export function initAlbum(d) {
  deps = { ...deps, ...d };
  refresh();
  onChange(refresh);
  setInterval(refresh, 2500);
}
const busy = () => !!document.querySelector('.tour, .sheet, .avatar-name, .egg-intro, .egg-born, .egg-plant, .cam-ui');

// ---- 町の 右がわの アルバムボタン（もらった子だけ。カメラの ボタンの 下） ----
const SEEN_KEY = 'manabi-album-lv';
function readSeen() { try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } }
function writeSeen(v) { try { localStorage.setItem(SEEN_KEY, JSON.stringify(v)); } catch (_) { /* おぼえられなくても アルバムは 動く */ } }

export function refresh() {
  const p = currentProfile();
  const lv = p ? albumLevel(p) : 0;
  const show = !!p && lv > 0 && deps.isHome();
  if (show && !fab) {
    fab = h('button', { class: 'cam-fab album-fab', type: 'button', 'aria-label': 'アルバム', onclick: () => { const me = currentProfile(); if (me && !busy()) openAlbum(me); } },
      icon('book-open'), h('span', {}, 'アルバム'));
    document.body.append(fab);
  }
  if (fab) {
    fab.hidden = !show || busy();
    // カメラの ボタンが あれば その下、なければ カメラの 場所に
    fab.classList.toggle('below', !!p && cameraLevel(p) > 0);
  }
  // 育って できることが ふえたら ピヨ先生が 教える（この端末で はじめて 見た ときは 言わない）
  if (p && lv > 0) {
    const all = readSeen();
    const was = all[p.id];
    if (typeof was === 'number' && lv > was && !busy() && deps.isHome()) {
      piyoSay(lv === 2 ? 'アルバムに スタンプが ふえたよ！' : 'アルバムに ひとことが 書けるよ！', 4);
    }
    if (was !== lv && !busy()) { all[p.id] = lv; writeSeen(all); }
  }
}

// 写真の 下に 出す ことば（日づけ・空 と 島）
function captionOf(m) {
  const at = new Date(m.takenAt || Date.now());
  const day = Number.isFinite(at.getTime()) ? `${at.getMonth() + 1}月${at.getDate()}日` : '';
  const sky = SKY_NAMES[m.sky] || '';
  const isle = islandDef(m.isle || START)?.name || 'はじまりの島';
  return { when: [day, sky].filter(Boolean).join(' '), isle };
}

// ---- アルバム（本） ----
// opts.inCamera: カメラの 画面から ひらいた（あいている わくを タップすると カメラに もどる）
export function openAlbum(p, opts = {}) {
  if (!p || !albumLevel(p) || sheet?.isConnected) return;
  let page = Number.isInteger(opts.page) ? opts.page : lastPage(p);
  const head = h('p', { class: 'al-count' });
  const paper = h('div', { class: 'al-page' });
  const num = h('span', { class: 'al-num' });
  const prev = h('button', { class: 'al-turn', type: 'button', 'aria-label': 'まえの ページ', onclick: () => turn(-1) }, icon('chevron-left'));
  const next = h('button', { class: 'al-turn', type: 'button', 'aria-label': 'つぎの ページ', onclick: () => turn(1) }, icon('chevron-right'));
  const lock = h('p', { class: 'al-lock' });
  let token = 0;

  const close = () => { sheet?.remove(); sheet = null; opts.onClose?.(); refresh(); };
  function turn(d) {
    const n = pagesOf(currentProfile() || p).length;
    const to = Math.max(0, Math.min(n - 1, page + d));
    if (to === page) return;
    page = to;
    paper.classList.remove('flip-l', 'flip-r'); void paper.offsetWidth; paper.classList.add(d > 0 ? 'flip-r' : 'flip-l');
    draw();
  }
  // あいている わく: カメラが あれば「ぱしゃり」で カメラへ
  function goShoot() {
    const me = currentProfile() || p;
    if (!cameraLevel(me)) return;
    close();
    if (!opts.inCamera) deps.openCamera();
  }

  async function draw() {
    const me = currentProfile() || p;
    const pages = pagesOf(me);
    page = Math.max(0, Math.min(pages.length - 1, page));
    const all = albumShots(me).length;
    const cap = shotCap(me);
    head.textContent = `${all}/${cap}まい`;
    head.classList.toggle('full', all >= cap);
    num.textContent = `${page + 1} / ${pages.length}`;
    prev.disabled = page === 0;
    next.disabled = page >= pages.length - 1;
    // まだ 育つなら つぎに ふえることを 出す（カメラが まだなら カメラの もらいかた）
    const hint = !cameraLevel(me) ? '理科の たまごで カメラが もらえるよ' : nextHint(me);
    lock.replaceChildren(...(hint ? [icon(cameraLevel(me) ? 'lock' : 'camera'), h('span', {}, hint)] : []));
    lock.hidden = !hint;

    const list = pages[page] || [];
    const my = ++token;
    const firstFree = page * PER_PAGE + list.length === all;   // この ページに つぎの 写真が 入る
    const slots = Array.from({ length: PER_PAGE }, (_, i) => {
      const m = list[i];
      if (!m) {
        const shoot = firstFree && i === list.length && cameraLevel(me) && all < cap;
        return h('button', { type: 'button', class: `al-slot empty ${shoot ? 'next' : ''}`, disabled: !shoot || null, onclick: shoot ? goShoot : null, 'aria-label': shoot ? 'カメラで とる' : 'あいている わく' },
          shoot ? h('span', { class: 'al-shoot' }, icon('camera'), h('b', {}, 'ぱしゃり！')) : null);
      }
      const c = captionOf(m);
      const st = stampDef(m.stamp);
      const img = h('span', { class: 'al-img ph-wait' }, '…');
      const slot = h('button', { type: 'button', class: 'al-slot', 'data-id': m.id, onclick: () => view(m.id) },
        h('i', { class: 'al-tape', 'aria-hidden': 'true' }),
        img,
        st ? h('span', { class: 'al-stamp', style: `--c:${st.color}`, 'aria-label': st.label }, icon(st.icon)) : null,
        h('span', { class: 'al-cap' }, m.note ? h('b', { class: 'al-note' }, m.note) : h('b', {}, c.when), h('small', {}, c.isle)));
      getData(m.id).catch(() => null).then((data) => {
        if (my !== token) return;
        img.replaceWith(data ? h('img', { class: 'al-img', src: data, alt: m.name || '町の写真' }) : h('span', { class: 'al-img ph-wait' }, 'じゅんびちゅう'));
      });
      return slot;
    });
    paper.replaceChildren(...slots);
  }

  // ---- 1まいを 大きく ----
  async function view(id) {
    const me = currentProfile() || p;
    const m = albumShots(me).find((x) => x.id === id);
    if (!m) return;
    const data = await getData(id).catch(() => null);
    const c = captionOf(m);
    const pic = h('div', { class: 'al-big-pic' },
      data ? h('img', { src: data, alt: m.name || '町の写真' }) : h('p', { class: 'empty' }, 'この端末には まだ とどいていないよ'));
    const badge = h('span', { class: 'al-stamp big', hidden: true });
    pic.append(badge);
    const stamps = h('div', { class: 'al-stamps' });
    const paintStamp = () => {
      const st = stampDef(m.stamp);
      badge.hidden = !st;
      if (st) { badge.style.setProperty('--c', st.color); badge.replaceChildren(icon(st.icon)); }
      stamps.replaceChildren(...STAMPS.map((s) => h('button', {
        type: 'button', class: `al-st ${m.stamp === s.id ? 'on' : ''}`, style: `--c:${s.color}`, 'aria-label': s.label, 'aria-pressed': String(m.stamp === s.id),
        onclick: () => { if (setStamp(me, id, s.id)) { save(); paintStamp(); draw(); } },
      }, icon(s.icon))));
    };
    let noteRow = null;
    if (can(me, 'note')) {
      const input = h('input', { class: 'al-note-in', type: 'text', maxlength: NOTE_MAX, value: m.note || '', placeholder: 'ひとこと（16字まで）', enterkeyhint: 'done' });
      const commit = () => { if (setNote(me, id, input.value)) { save(); draw(); } };
      input.addEventListener('change', commit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { input.blur(); } });
      noteRow = h('label', { class: 'al-note-row' }, icon('pencil'), input);
    }
    const shut = () => { big.remove(); };
    const big = h('div', { class: 'sheet cam-big al-big', onclick: (e) => { if (e.target === big) shut(); } },
      h('div', { class: 'sheet-card piyo-menu cam-big-card al-big-card' },
        pic,
        h('p', { class: 'al-big-cap' }, h('b', {}, c.when), h('small', {}, c.isle)),
        can(me, 'stamp') ? stamps : null,
        noteRow,
        h('div', { class: 'cam-big-actions' },
          data ? h('button', { class: 'btn primary', type: 'button', onclick: () => keepOnDevice(m, data) }, 'ほぞんする') : null,
          h('button', { class: 'btn', type: 'button', onclick: async () => {
            if (!confirm('この写真を けす？')) return;
            await removePhoto(me, id); shut(); draw();
          } }, 'けす')),
        h('button', { class: 'link', type: 'button', onclick: shut }, 'もどる')));
    paintStamp();
    document.body.append(big);
  }

  // 指で めくる
  let sx = null;
  paper.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  paper.addEventListener('pointerup', (e) => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) turn(dx < 0 ? 1 : -1); });
  paper.addEventListener('pointercancel', () => { sx = null; });

  sheet = h('div', { class: 'sheet al-sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card al-book' },
      h('div', { class: 'al-top' }, h('p', { class: 'sheet-title' }, icon('book-open'), ' 旅の アルバム'), head),
      paper,
      h('div', { class: 'al-nav' }, prev, num, next),
      lock,
      h('button', { class: 'link', type: 'button', onclick: close }, 'とじる')));
  document.body.append(sheet);
  if (fab) fab.hidden = true;
  draw();
}
