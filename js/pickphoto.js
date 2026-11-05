// 写真の入れかた をえらぶ（カメラで とる／アルバムから えらぶ）
// pickPhoto(onFile) … えらばれた File を onFile に わたす。やめたら なにもしない
import { h } from './ui.js';
import { icon } from './icons.js';

export function pickPhoto(onFile, { title = '写真を 入れる' } = {}) {
  const take = (capture) => {
    const input = h('input', { type: 'file', accept: 'image/*', capture: capture ? 'environment' : null, hidden: true,
      onchange: () => { const f = input.files?.[0]; input.remove(); if (f) onFile(f); } });
    document.body.append(input);
    close();
    input.click();
  };
  const opt = (ic, name, sub, capture) => h('button', { type: 'button', class: 'piyo-opt', onclick: () => take(capture) },
    h('span', { class: 'piyo-ic' }, icon(ic)), h('b', {}, name), h('small', {}, sub));
  const close = () => sheet.remove();
  const sheet = h('div', { class: 'sheet pick-src', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card piyo-menu' },
      h('p', { class: 'sheet-title' }, title),
      opt('camera', 'カメラで とる', 'いま 写真を とる', true),
      opt('image', 'アルバムから えらぶ', 'とってある 写真を つかう', false),
      h('button', { type: 'button', class: 'link', onclick: close }, 'やめる')));
  document.body.append(sheet);
}
