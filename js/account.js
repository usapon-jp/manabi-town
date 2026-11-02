// 家族アカウントと「だれが つかう？」の画面。
// - ログインは おうちの人が各端末で1回だけ（せってい の「ほかの端末と そろえる」）
// - 子どもは 自分の顔（名前）をタップするだけ。あいことば（4けた）は つけたい人だけ
import { h, toast } from './ui.js';
import { icon } from './icons.js';
import { getState, gradeLabel } from './store.js';
import { signIn, signUp, signOut, syncNow, syncInfo, onSyncStatus, loggedIn, friendlyError } from './sync.js';

// ---- あいことば ----------------------------------------------------------------

async function hashPin(pin, id) {
  const data = new TextEncoder().encode(`manabi:${id}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const pinFor = (p, pin) => (pin ? hashPin(pin, p.id) : Promise.resolve(null));

// あいことばの入れ物（4けたの数字）
function pinInput(placeholder = '4けたの数字') {
  return h('input', { type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: 4, autocomplete: 'off', placeholder, class: 'pin' });
}

// あいことばが あれば きく。あっていれば true
export function askPin(p) {
  if (!p.pinHash) return Promise.resolve(true);
  return new Promise((resolve) => {
    const box = pinInput();
    const msg = h('p', { class: 'sheet-sub' }, '');
    const done = (ok) => { sheet.remove(); resolve(ok); };
    const check = async () => {
      if (box.value.length < 4) return;
      if (await hashPin(box.value, p.id) === p.pinHash) { done(true); return; }
      msg.textContent = 'ちがうみたい。もういちど';
      box.value = '';
    };
    box.oninput = () => { box.value = box.value.replace(/\D/g, '').slice(0, 4); if (box.value.length === 4) check(); };
    const sheet = h('div', { class: 'sheet', onclick: (e) => { if (e.target === sheet) done(false); } },
      h('div', { class: 'sheet-card' },
        h('p', { class: 'sheet-title' }, icon('lock'), ` ${p.name}の あいことば`),
        box, msg,
        h('button', { class: 'link', onclick: () => done(false) }, 'やめる')));
    document.body.append(sheet);
    setTimeout(() => box.focus(), 50);
  });
}

// せってい「じぶん」に入れる あいことばの欄
export function pinField(p, onSave) {
  const box = pinInput(p.pinHash ? 'かえるときだけ 入れる' : 'なくてもOK');
  box.oninput = () => { box.value = box.value.replace(/\D/g, '').slice(0, 4); };
  const el = h('div', { class: 'form' },
    h('label', {}, 'あいことば（4けた・なくてもOK）', box),
    p.pinHash ? h('button', { class: 'link', type: 'button', onclick: () => { onSave(null); toast('あいことばを なくしたよ'); } }, 'あいことばを なくす') : null);
  return { el, box };
}

// ---- だれが つかう？ ------------------------------------------------------------

export function openPicker(choose, { closable = true } = {}) {
  document.querySelector('.who-sheet')?.remove();
  const s = getState();
  const close = () => sheet.remove();
  const sheet = h('div', { class: 'sheet who-sheet', onclick: (e) => { if (closable && e.target === sheet) close(); } },
    h('div', { class: 'sheet-card' },
      h('p', { class: 'sheet-title' }, 'だれが つかう？'),
      h('div', { class: 'who-list' }, s.profiles.map((x) => h('button', {
        class: `who-btn ${x.id === s.currentId ? 'on' : ''}`,
        onclick: async () => { if (await askPin(x)) { close(); choose(x.id); } },
      },
      h('span', { class: 'who-face' }, x.name.slice(0, 1)),
      h('span', { class: 'who-name' }, x.name, h('small', {}, gradeLabel(x))),
      x.pinHash ? icon('lock') : null))),
      closable ? h('button', { class: 'link', onclick: close }, 'とじる') : null));
  document.body.append(sheet);
}

// ---- ログイン ------------------------------------------------------------------

export function openLogin(onDone) {
  document.querySelector('.login-sheet')?.remove();
  const email = h('input', { type: 'email', autocomplete: 'username', placeholder: 'メールアドレス' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'パスワード（8文字以上）' });
  const msg = h('p', { class: 'sheet-sub' }, '');
  const close = () => sheet.remove();
  const run = (fn) => async (e) => {
    e.preventDefault();
    if (!email.value.trim() || pass.value.length < 8) { msg.textContent = 'メールと、8文字以上のパスワードを 入れてね'; return; }
    sheet.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    msg.textContent = 'つないでいるよ…';
    try {
      const r = await fn(email.value.trim(), pass.value);
      if (r === false) { msg.textContent = 'メールを送りました。メールの「確認」リンクを押してから「ログイン」してね'; }
      else { close(); onDone?.(); return; }
    } catch (err) { msg.textContent = friendlyError(err); }
    sheet.querySelectorAll('button').forEach((b) => { b.disabled = false; });
  };
  const sheet = h('div', { class: 'sheet login-sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('form', { class: 'sheet-card', onsubmit: run(signIn) },
      h('p', { class: 'sheet-title' }, icon('cloud'), ' 家族で ログイン'),
      h('p', { class: 'note' }, 'おうちの人の メールとパスワードで ログインします。どの端末も 同じものを使ってね。'),
      email, pass, msg,
      h('button', { class: 'btn primary', type: 'submit' }, 'ログイン'),
      h('button', { class: 'btn', type: 'button', onclick: run(signUp) }, 'はじめて（家族アカウントをつくる）'),
      h('button', { class: 'link', type: 'button', onclick: close }, 'やめる')));
  document.body.append(sheet);
  setTimeout(() => email.focus(), 50);
}

function when(t) {
  if (!t) return 'まだ';
  const d = new Date(t);
  const sameDay = d.toDateString() === new Date().toDateString();
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  return sameDay ? `きょう ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

// せってい に出すカード
export function syncCard(afterLogin) {
  const line = h('p', { class: 'ai-status' });
  const body = h('div', { class: 'form' });
  const paint = () => {
    if (live && !line.isConnected) { off(); return; } // せってい を とじたら やめる
    const i = syncInfo();
    if (!loggedIn()) {
      line.textContent = 'ログインすると、iPad・iPhone・Android の どれでも 同じ進みで つかえます';
      body.replaceChildren(h('button', { class: 'btn primary', onclick: () => openLogin(afterLogin) }, icon('cloud'), ' ログインして そろえる'));
      return;
    }
    const st = i.status === 'busy' ? 'そろえているよ…'
      : i.status === 'offline' ? `オフライン（${i.text}）`
        : i.status === 'error' ? i.text
          : `さいごに そろえた: ${when(i.last)}`;
    line.textContent = st;
    body.replaceChildren(
      h('button', { class: 'btn', onclick: () => syncNow() }, 'いま そろえる'),
      h('details', {}, h('summary', {}, `ログイン中: ${i.email || ''}`),
        h('button', { class: 'btn', onclick: () => {
          if (!confirm('この端末を ログアウトしますか？（この端末の進みは 消えません）')) return;
          signOut(); toast('ログアウトしたよ');
        } }, 'この端末を ログアウト')));
  };
  let live = false;
  const off = onSyncStatus(paint);
  paint();
  setTimeout(() => { live = true; }, 0);
  return h('div', { class: 'card form' }, h('h3', {}, 'ほかの端末と そろえる'), line, body);
}
