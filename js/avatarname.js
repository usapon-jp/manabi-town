// 町の女の子に 名前を つける。はじめて 町を ひらいたとき（いま使っている子も 1回だけ）と、せっていから。
// 草原は 見えたまま（.sheet に しない）で、女の子と ピヨ先生を 前から ちかくで 見せる。
import { h } from './ui.js';
import { save } from './store.js';
import { setAvatarName, cleanName, hasAvatarName, avatarName, NAME_MAX } from './avatar.js';

// world は なくてもよい（3D が うごかない 端末）。onDone(つけたか) は とじたあと
export function openAvatarNaming(p, { world, onDone } = {}) {
  if (!p || document.querySelector('.avatar-name')) return;
  const again = hasAvatarName(p);
  const input = h('input', { type: 'text', maxlength: NAME_MAX, placeholder: 'なまえ', value: again ? avatarName(p) : '', autocomplete: 'off', enterkeyhint: 'done' });
  const say = h('p', { class: 'an-say' }, again ? 'なまえを かえる？' : 'この子に なまえを つけてね');
  const ok = h('button', { class: 'btn primary', type: 'submit' }, 'けってい');
  const sync = () => { ok.disabled = !cleanName(input.value); };
  input.addEventListener('input', sync);
  sync();
  let done = false;
  function close(named) {
    if (done) return;
    done = true;
    root.classList.add('gone');
    world?.closeUp(false);
    setTimeout(() => { root.remove(); onDone?.(named); }, 300);
  }
  const form = h('form', { class: 'an-card', onsubmit: (e) => {
    e.preventDefault();
    const n = cleanName(input.value);
    if (!n || done) return;
    setAvatarName(p, n);
    save();
    input.blur();
    say.textContent = `よろしくね、${n}！`;
    form.classList.add('named');
    world?.celebrate();
    world?.showName();
    setTimeout(() => close(true), 1600);
  } },
  h('div', { class: 'an-coach' }, h('img', { src: 'assets/icons/icon-192.png', alt: 'ピヨ先生', width: 44, height: 44 }), say),
  h('div', { class: 'an-row' }, input, ok),
  h('button', { type: 'button', class: 'link an-later', onclick: () => close(false) }, again ? 'やめる' : 'あとで'));
  const root = h('div', { class: 'avatar-name' }, form);
  document.body.append(root);
  world?.closeUp(true);
  // スマホで いきなり キーボードが 出ると 女の子が かくれるので、パソコンだけ すぐ 入力できるように
  if (matchMedia('(pointer: fine)').matches) setTimeout(() => input.focus(), 350);
}
