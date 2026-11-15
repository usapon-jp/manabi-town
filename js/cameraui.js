// 町の カメラの 画面（ボタン・撮影・とった写真）。きまりは js/camera.js、3D は world.js の camera。
// 草原は 見えたまま。ボタンは 少なく、使えるものだけ 出す（まだ ひらいていない ものは 出さない）。
import { h, toast } from './ui.js';
import { icon } from './icons.js';
import { currentProfile, onChange } from './store.js';
import { currentIslandId } from './islands.js';
import { addPhoto, removePhoto, getData } from './photos.js';
import { registerFeature } from './eggs.js';
import { piyoSay } from './eggui.js';
import {
  FEATURE, FOLDER, MAX_SHOTS, SUBJECT, ZOOMS, POSES, SUNSET, cameraLevel, can, nextHint, shots, isFull, shotLabel,
} from './camera.js';

registerFeature(FEATURE, { label: 'カメラ' });

let world = null;
let deps = { isHome: () => true };
let fab = null;
let ui = null;                 // 撮影の 画面（出ている あいだ）
const st = { zoom: 0, selfie: false, pose: null, filter: false };

// ---- main.js から ----
export function initCamera(w, d) {
  world = w;
  deps = { ...deps, ...d };
  if (!world?.camera) return;
  refresh();
  onChange(refresh);
  setInterval(refresh, 2500);
}
const busy = () => !!document.querySelector('.tour, .sheet, .avatar-name, .egg-intro, .egg-born, .egg-plant');

// ---- 町の 右がわの カメラボタン（ひらいた子だけ） ----
const SEEN_KEY = 'manabi-cam-lv';
function readSeen() { try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } }
function writeSeen(v) { try { localStorage.setItem(SEEN_KEY, JSON.stringify(v)); } catch (_) { /* おぼえられなくても カメラは 動く */ } }

export function refresh() {
  const p = currentProfile();
  const lv = p ? cameraLevel(p) : 0;
  const show = !!p && lv > 0 && deps.isHome() && !ui;
  if (show && !fab) {
    fab = h('button', { class: 'cam-fab', type: 'button', 'aria-label': 'カメラ', onclick: () => { if (!busy()) open(); } }, icon('camera'), h('span', {}, 'しゃしん'));
    document.body.append(fab);
  }
  if (fab) fab.hidden = !show || busy();
  // 育って できることが ふえたら ピヨ先生が 教える（この端末で はじめて 見た ときは 言わない）
  if (p && lv > 0) {
    const all = readSeen();
    const was = all[p.id];
    if (typeof was === 'number' && lv > was && !busy() && deps.isHome()) {
      piyoSay(lv === 2 ? 'カメラに ズームと ポーズが ふえたよ！' : 'カメラに 自撮りと 夕焼け色が ふえたよ！', 4);
    }
    if (was !== lv && !busy()) { all[p.id] = lv; writeSeen(all); }
  }
}

// ---- 撮影の 画面 ----
function open() {
  const p = currentProfile();
  if (!p || !world?.camera || ui) return;
  const lv = cameraLevel(p);
  if (!lv) return;
  Object.assign(st, { zoom: 0, selfie: false, pose: null, filter: false });
  world.camera.start();
  document.body.classList.add('cam-mode');
  if (fab) fab.hidden = true;

  const shutter = h('button', { class: 'cam-shutter', type: 'button', 'aria-label': 'ぱしゃり', onclick: () => shoot() }, h('i'));
  const count = h('button', { class: 'cam-roll', type: 'button', 'aria-label': 'とった写真', onclick: () => openRoll(p, { onClose: paint }) });
  const tools = h('div', { class: 'cam-tools' });
  const hint = h('p', { class: 'cam-hint' });
  const tint = h('div', { class: 'cam-tint', hidden: true });
  tint.style.background = `linear-gradient(${SUNSET.top}, ${SUNSET.bottom})`;
  tint.style.mixBlendMode = SUNSET.op;
  const flash = h('div', { class: 'cam-flash' });
  const close = h('button', { class: 'cam-close', type: 'button', 'aria-label': 'カメラを とじる', onclick: () => closeCam() }, icon('x'));

  const tool = (cls, ic, text, on, fn) => h('button', { type: 'button', class: `cam-tool ${on ? 'on' : ''} ${cls}`, onclick: fn }, icon(ic), h('span', {}, text));
  function paint() {
    const mine = currentProfile() || p;
    const n = shots(mine).length;
    count.replaceChildren(icon('image'), h('b', {}, `${n}/${MAX_SHOTS}`));
    count.classList.toggle('full', n >= MAX_SHOTS);
    const list = [];
    if (can(mine, 'zoom')) list.push(tool('zoom', 'plus', `ズーム ×${ZOOMS[st.zoom]}`, st.zoom > 0, () => {
      st.zoom = (st.zoom + 1) % ZOOMS.length; world.camera.setZoom(ZOOMS[st.zoom]); paint();
    }));
    if (can(mine, 'pose')) {
      list.push(tool('pose', 'smile', st.pose ? POSES.find((x) => x.id === st.pose).label : 'ポーズ', !!st.pose, () => {
        const i = POSES.findIndex((x) => x.id === st.pose);
        st.pose = i + 1 < POSES.length ? POSES[i + 1].id : null;   // おすたびに つぎの ポーズ → さいごは なし
        world.camera.setPose(st.pose); paint();
      }));
    }
    if (can(mine, 'selfie')) list.push(tool('selfie', 'camera', '自撮り', st.selfie, () => {
      st.selfie = !st.selfie; world.camera.setSelfie(st.selfie); paint();
    }));
    if (can(mine, 'filter')) list.push(tool('filter', 'sparkles', '夕焼け色', st.filter, () => {
      st.filter = !st.filter; paint();
    }));
    tools.replaceChildren(...list);
    tint.hidden = !st.filter;
    hint.textContent = nextHint(mine) || '';
    hint.hidden = !hint.textContent;
  }

  async function shoot() {
    const now = currentProfile() || p;
    if (isFull(now)) { toast(`${MAX_SHOTS}まいで いっぱい。いらない写真を けしてね`); openRoll(now, { onClose: paint }); return; }
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    try {
      const cv = world.camera.snap();
      if (st.filter) tintCanvas(cv);
      const dataUrl = cv.toDataURL('image/jpeg', 0.82);
      await addPhoto(now, { dataUrl, folder: FOLDER, subject: SUBJECT, label: shotLabel(), extra: { kind: 'town', isle: currentIslandId(now) } });
      const n = shots(now).length;
      toast(n >= MAX_SHOTS ? `とれた！ ${n}/${MAX_SHOTS}（いっぱい）` : `とれた！ ${n}/${MAX_SHOTS}`);
    } catch (_) { toast('うまく とれなかった。もういちど'); }
    paint();
  }

  function closeCam() {
    world.camera.stop();
    document.body.classList.remove('cam-mode');
    ui?.remove(); ui = null;
    refresh();
  }

  ui = h('div', { class: 'cam-ui' }, tint, close, count, tools, hint, shutter, flash);
  document.body.append(ui);
  paint();
}

// 夕焼け色: プレビューと おなじ 色・おなじ 重ね方で 絵に 合わせる
function tintCanvas(cv) {
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, cv.height);
  grad.addColorStop(0, SUNSET.top); grad.addColorStop(1, SUNSET.bottom);
  g.globalCompositeOperation = SUNSET.op;
  g.fillStyle = grad; g.fillRect(0, 0, cv.width, cv.height);
  g.globalCompositeOperation = 'source-over';
}

// ---- とった写真（10まいまで）。見る・スマホに ほぞん・けす ----
export function openRoll(p, { onClose } = {}) {
  const grid = h('div', { class: 'cam-grid' });
  const sub = h('p', { class: 'sheet-sub' });
  const close = () => { sheet.remove(); onClose?.(); };
  async function draw() {
    const list = shots(p);
    sub.textContent = list.length >= MAX_SHOTS ? `${MAX_SHOTS}まいで いっぱい。いらない写真を けすと また とれるよ` : `${list.length}/${MAX_SHOTS}まい`;
    const items = await Promise.all(list.map(async (m) => ({ m, data: await getData(m.id).catch(() => null) })));
    grid.replaceChildren(...(items.length ? items.map(({ m, data }) => h('button', { type: 'button', class: 'cam-thumb', onclick: () => view(m, data) },
      data ? h('img', { src: data, alt: m.name || '町の写真' }) : h('span', { class: 'ph-wait' }, 'じゅんびちゅう'),
      h('small', {}, m.name || ''))) : [h('p', { class: 'empty' }, 'まだ 写真が ないよ。ぱしゃり！')]));
  }
  function view(m, data) {
    const big = h('div', { class: 'sheet cam-big', onclick: (e) => { if (e.target === big) big.remove(); } },
      h('div', { class: 'sheet-card piyo-menu cam-big-card' },
        data ? h('img', { src: data, alt: m.name || '町の写真' }) : h('p', { class: 'empty' }, 'この端末には まだ とどいていないよ'),
        h('p', { class: 'sheet-sub' }, m.name || ''),
        h('div', { class: 'cam-big-actions' },
          data ? h('button', { class: 'btn primary', type: 'button', onclick: () => keep(m, data) }, 'スマホに ほぞん') : null,
          h('button', { class: 'btn', type: 'button', onclick: async () => {
            if (!confirm('この写真を けす？')) return;
            await removePhoto(p, m.id); big.remove(); draw();
          } }, 'けす')),
        h('button', { class: 'link', type: 'button', onclick: () => big.remove() }, 'もどる')));
    document.body.append(big);
  }
  const sheet = h('div', { class: 'sheet cam-sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card piyo-menu ph-card' },
      h('p', { class: 'sheet-title' }, icon('camera'), ' カメラの 写真'),
      sub, grid,
      h('button', { class: 'link', type: 'button', onclick: close }, 'とじる')));
  document.body.append(sheet);
  draw();
}

// スマホの 写真に ほぞん（シェアが つかえれば それ。なければ ダウンロード）
async function keep(m, dataUrl) {
  const name = `machi-${String(m.takenAt || '').slice(0, 10) || 'photo'}.jpg`;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], name, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    toast('ほぞんしたよ');
  } catch (e) { if (e?.name !== 'AbortError') toast('ほぞん できなかった'); }
}

