// 町の女の子の きせかえ。帽子（ガチャで 手に入れた もの）・髪の色・目の色・顔の 調整（目の大きさ・口の高さ・顔の細さ）。
// 名前を つける ときと 同じく、草原は 見えたまま 下に カードを 出し、女の子を 前から ちかくで 見せる。
// えらぶと すぐ 保存して（save）、町の 女の子が かわる（world.js の refreshAvatar）。
import { h } from './ui.js';
import { save } from './store.js';
import { icon } from './icons.js';
import { isOwned } from './gacha.js';
import {
  partsOfKind, lookOf, wearPart, setAvatarColor, setAvatarFace, resetAvatarLook,
  COLORS, COLOR_LABELS, FACE,
} from './avatar.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

// world は なくてもよい（3D が うごかない 端末）。onDone は とじたあと
export function openDressup(p, { world, onDone } = {}) {
  if (!p || document.querySelector('.dressup')) return;
  let frame = 0;
  // スライダーを うごかす あいだは 1こまに 1回だけ 保存する
  const saveSoon = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; save(); }); };
  const body = h('div', { class: 'du-body' });

  function paint() {
    const look = lookOf(p);
    // 帽子: 持っている ものだけ えらべる。まだの ものは「ガチャで でるよ」
    const hats = partsOfKind('hat').map((part) => {
      const have = !part.gacha || isOwned(part.gacha, p);
      const on = look.wear.hat === part.id;
      return h('button', {
        type: 'button', class: `du-chip ${on ? 'on' : ''} ${have ? '' : 'locked'}`, disabled: !have, 'aria-pressed': on ? 'true' : 'false',
        onclick: () => { wearPart(p, part.id); save(); paint(); },
      }, have ? part.label : '？', have ? null : h('small', {}, 'ガチャで でるよ'));
    });
    const swatches = (slot) => h('div', { class: 'du-swatches' }, Object.entries(COLORS[slot]).map(([key, c]) => h('button', {
      type: 'button', class: `du-sw ${look.colors[slot] === key ? 'on' : ''}`, style: `--c:${hex(c)}`,
      'aria-label': COLOR_LABELS[key] || key, title: COLOR_LABELS[key] || key,
      onclick: () => { setAvatarColor(p, slot, key); save(); paint(); },
    })));
    const sliders = FACE.map((f) => {
      const input = h('input', {
        type: 'range', min: f.min, max: f.max, step: 0.05, value: look.face[f.key], 'aria-label': f.label,
        oninput: (e) => { setAvatarFace(p, f.key, e.target.value); saveSoon(); },
      });
      return h('label', { class: 'du-slider' }, h('span', {}, f.label),
        h('span', { class: 'du-range' }, h('small', {}, f.lo), input, h('small', {}, f.hi)));
    });
    body.replaceChildren(
      h('div', { class: 'du-sec' }, h('b', {}, 'ぼうし'), h('div', { class: 'du-chips' }, hats)),
      h('div', { class: 'du-sec' }, h('b', {}, 'かみの いろ'), swatches('hair')),
      h('div', { class: 'du-sec' }, h('b', {}, 'めの いろ'), swatches('eye')),
      h('div', { class: 'du-sec' }, h('b', {}, 'かお'), ...sliders),
    );
  }

  let done = false;
  function close() {
    if (done) return;
    done = true;
    if (frame) { cancelAnimationFrame(frame); frame = 0; save(); }
    root.classList.add('gone');
    world?.closeUp(false);
    setTimeout(() => { root.remove(); onDone?.(); }, 300);
  }
  const card = h('div', { class: 'an-card du-card' },
    h('div', { class: 'du-head' }, h('p', { class: 'an-say' }, icon('sparkles'), ' きせかえ'),
      h('button', { type: 'button', class: 'link', onclick: () => { resetAvatarLook(p); save(); paint(); } }, 'もとに もどす')),
    body,
    h('button', { type: 'button', class: 'btn primary', onclick: () => close() }, 'できた'));
  const root = h('div', { class: 'avatar-name dressup' }, card);
  paint();
  document.body.append(root);
  world?.closeUp(true, { dress: true });
}
