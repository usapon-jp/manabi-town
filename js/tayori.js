// ピヨだより: 町の ピヨの ひとこと（たまご・たね・カメラ・アルバム・銀行の しらせ）を ためて、あとから 読める ところ。
// ホームの 左（きょうやること の 下）の ピヨの ボタンで ひらく。まだ 読んでいない 数を 赤い 数字で 出す。
// 中に「まちの つかいかたを きく」（js/townask.js）も おく。
// 保存は この端末の localStorage だけ（きょうだいごと）。町・ポイント・プロフィールには さわらない。
import { h } from './ui.js';
import { icon } from './icons.js';
import { currentProfile } from './store.js';

const KEY = 'manabi-tayori';
const MAX = 30;            // ためる 数（古いものから 消える）
const SAME_MS = 10 * 60000; // 10分いないの 同じ ことばは 1つに

function readAll() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
function box(id, all = readAll()) {
  const b = all[id];
  return { list: Array.isArray(b?.list) ? b.list.filter((x) => x && typeof x.t === 'string' && Number.isFinite(x.at)) : [], read: Number.isFinite(b?.read) ? b.read : 0 };
}
function write(id, b) {
  const all = readAll();
  all[id] = b;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ためられなくても 町は 動く */ }
}

// ひとことを 1つ ためる（eggui.js の piyoSay から）
export function addTayori(text, now = Date.now()) {
  const p = currentProfile();
  const t = String(text || '').trim();
  if (!p || !t) return;
  const b = box(p.id);
  const last = b.list[0];
  if (last && last.t === t && now - last.at < SAME_MS) { last.at = now; } else b.list.unshift({ t, at: now });
  b.list = b.list.slice(0, MAX);
  write(p.id, b);
  paintTayori();
}

export function unreadTayori(p = currentProfile()) {
  if (!p) return 0;
  const b = box(p.id);
  return b.list.filter((x) => x.at > b.read).length;
}

// ボタンの 数字を いまの 数に（ホームを 作りなおさずに）
export function paintTayori() {
  const n = unreadTayori();
  document.querySelectorAll('.town-ask-btn').forEach((btn) => {
    const badge = btn.querySelector('.tayori-n');
    badge.textContent = n > 9 ? '9+' : String(n);
    badge.hidden = !n;
    btn.setAttribute('aria-label', n ? `ピヨだより（あたらしい ${n}こ）` : 'ピヨだより');
  });
}

const when = (at, now = new Date()) => {
  const d = new Date(at);
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  return diff === 0 ? `きょう ${hm}` : diff === 1 ? `きのう ${hm}` : `${d.getMonth() + 1}/${d.getDate()}`;
};

export function openTayori(p, { ask } = {}) {
  document.querySelector('.sheet.tayori-sheet')?.remove();
  const b = box(p.id);
  const read = b.read;
  write(p.id, { ...b, read: Date.now() });
  paintTayori();
  const close = () => sheet.remove();
  const sheet = h('div', { class: 'sheet tayori-sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card' },
      h('p', { class: 'sheet-title' }, h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 32, height: 32 }), ' ピヨだより'),
      b.list.length
        ? h('ul', { class: 'tayori-list' }, b.list.map((x) => h('li', { class: x.at > read ? 'new' : '' },
          h('p', {}, x.t), h('small', {}, when(x.at)))))
        : h('p', { class: 'empty' }, 'たまごや たねの しらせが ここに とどくよ'),
      ask ? h('button', { class: 'btn', type: 'button', onclick: () => { close(); ask(); } }, icon('message-circle'), ' まちの つかいかたを きく') : null,
      h('button', { class: 'link', type: 'button', onclick: close }, 'とじる')));
  document.body.append(sheet);
}
