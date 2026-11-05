// 「まちの ピヨに しつもん」: ホーム（まちづくりの草原）の左上、きょうやることの となりの ピヨ。
// まちづくりの つかいかたを Haiku（受け口の action: town）が js/townguide.js を読んで 答える。
// 答えに 場所が あれば「ここだよ」で その ボタンを 光らせて 見せる。
// しつもんは ぜんぶ フィードバック（manabi_feedback、screen = 'まち:しつもん'）に のこして、
// チュートリアル・ヒント・あんないを よくする 材料にする（会話は 画面を とじたら 消える）。
import { h, toast } from './ui.js';
import { gradeLabel } from './store.js';
import { askAI, aiErrorText, aiLeft } from './ai.js';
import { logFeedback } from './feedback.js';
import { icon } from './icons.js';
import { createVoice, canListen, canSpeak } from './voice.js';
import { GUIDE, SHOW, QUICK } from './townguide.js';

const SEEN_KEY = 'manabi-townask-seen';
export const townAskSeen = () => { try { return !!localStorage.getItem(SEEN_KEY); } catch { return true; } };

// ホームの 左上に おく ボタン
export function townAskButton(p) {
  const seen = townAskSeen();
  return h('button', { class: 'town-ask-btn', type: 'button', 'aria-label': 'まちの つかいかたを ピヨに しつもん', onclick: () => openTownAsk(p) },
    h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 40, height: 40 }),
    h('i', { class: 'town-ask-q', 'aria-hidden': 'true' }, '?'),
    seen ? null : h('span', { class: 'town-ask-tip' }, 'こまったら きいてね'));
}

export function openTownAsk(p) {
  document.querySelector('.chat.ask')?.remove();
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* 無視 */ }
  document.querySelector('.town-ask-tip')?.remove();
  let messages = [];
  let busy = false;
  let closed = false;
  const voice = createVoice();

  const log = h('div', { class: 'chat-log' });
  const input = h('input', { type: 'text', maxlength: 200, placeholder: 'まちづくりで わからない ことは？', enterkeyhint: 'send' });
  const mic = h('button', { type: 'button', class: 'chat-cam chat-mic', 'aria-label': '声で 話す', hidden: !canListen, onclick: () => {
    voice.unlock();
    if (voice.listening()) { voice.stopListen(); return; }
    mic.classList.add('on');
    input.placeholder = '聞いてるよ…話してね';
    voice.listen({ lang: 'ja-JP', onInterim: (t) => { input.value = t; }, onResult: (t) => { input.value = t; ask(); },
      onEnd: (why) => { mic.classList.remove('on'); input.placeholder = 'まちづくりで わからない ことは？'; if (why === 'denied') toast('マイクが 使えないよ。ブラウザの せっていで ゆるしてね', 5000); } });
  } }, icon('mic'));
  const quick = h('div', { class: 'chat-choices town-quick' }, QUICK.map((q) => h('button', { type: 'button', class: 'pick', onclick: () => { input.value = q; ask(); } }, q)));
  const form = h('form', { class: 'chat-input', onsubmit: (e) => { e.preventDefault(); voice.unlock(); ask(); } },
    input, mic, h('button', { class: 'chat-send', type: 'submit', 'aria-label': '送る' }, icon('send')));

  const close = () => { closed = true; voice.destroy(); layer.remove(); document.body.classList.remove('running'); };
  const layer = h('div', { class: 'chat ask town' },
    h('div', { class: 'ask-head' },
      h('div', { class: 'chat-top' },
        h('span', { class: 'ask-face' }, h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 36, height: 36 })),
        h('b', {}, 'まちの ピヨ'),
        h('button', { class: 'chat-close', 'aria-label': 'とじる', onclick: close }, icon('x')))),
    log, h('div', { class: 'chat-foot' }, quick, form));
  document.body.append(layer);
  document.body.classList.add('running');

  const bubble = (role, ...kids) => { const b = h('div', { class: `msg ${role}` }, ...kids); log.append(b); log.scrollTop = log.scrollHeight; return b; };
  bubble('assistant', 'まちづくりで わからない ことを きいてね。下の ボタンからも えらべるよ');

  async function ask() {
    const t = input.value.trim();
    if (busy || !t) return;
    if (aiLeft() <= 0) { toast('今日の しつもんは ここまで。また 明日ね'); return; }
    busy = true;
    voice.stopSpeak();
    input.value = '';
    quick.classList.add('used');   // 2回目からは よくある しつもんを 1行に
    messages.push({ role: 'user', text: t });
    bubble('user', t);
    const wait = bubble('assistant thinking', '考え中…');
    try {
      const r = await askAI({ action: 'town', grade: gradeLabel(p), messages, guide: GUIDE, keys: Object.keys(SHOW) }, { timeout: 30000 });
      wait.remove();
      if (closed) return;
      const say = r.say || 'ごめんね、うまく こたえられなかった。ちがう 言いかたで きいてみてね';
      messages.push({ role: 'assistant', text: say });
      const spot = SHOW[r.show] ? r.show : '';
      bubble('assistant', h('p', {}, say),
        h('div', { class: 'ask-foot' },
          spot ? h('button', { type: 'button', class: 'town-here', onclick: () => { close(); pointAt(spot); } }, icon('pointer'), ' ここだよ') : null,
          canSpeak ? h('button', { type: 'button', class: 'ask-say', 'aria-label': '読んで', onclick: () => { voice.unlock(); voice.speak(say, null, { lang: 'ja-JP' }); } }, icon('volume-2'), h('span', {}, '読んで')) : null));
      // しつもんを のこす（チュートリアル・ヒントを よくする 材料）
      logFeedback(p, 'まち:しつもん', `[${r.tag || '?'}] Q: ${t}\nA: ${say.slice(0, 300)}`, 'town1');
    } catch (e) {
      wait.remove();
      if (closed) return;
      messages.pop();
      bubble('assistant err', aiErrorText(e).replace('ヒント', 'しつもん'));
      input.value = t;
      logFeedback(p, 'まち:しつもん', `[とどかず] Q: ${t}`, 'town1');
    } finally { busy = false; }
  }
}

// その ボタンを 光らせて、指で さす。つぎに どこかを さわるか、6びょうで 消える
export function pointAt(key) {
  const spot = SHOW[key];
  if (!spot) return;
  // しつもん画面を とじた あと、草原の ボタンが もどってから（少し まつ）
  setTimeout(() => {
  const tools = document.querySelector('.wedit .tools');
  const editing = tools && !tools.hidden;
  if (spot.edit === true && !editing) document.querySelector('.wedit .fab')?.click();
  if (spot.edit === false && editing) document.querySelector('.wedit [data-a="done"]')?.click();
  requestAnimationFrame(() => {
    document.querySelector('.town-point')?.remove();
    const el = document.querySelector(spot.sel);
    const r = el?.getBoundingClientRect();
    if (!r || (!r.width && !r.height)) {
      toast(key === 'undo' ? 'まだ もどすものが ないよ' : `「${spot.label}」は いまは 出ていないよ`, 3000);
      return;
    }
    const pad = 6;
    const box = { left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
    const below = box.top + box.height / 2 < window.innerHeight * 0.5;
    const cx = box.left + box.width / 2;
    const lw = 170;
    const lx = Math.min(Math.max(10, cx - lw / 2), window.innerWidth - lw - 10);
    const root = h('div', { class: 'town-point', 'aria-hidden': 'true' },
      h('div', { class: 'town-point-ring', style: `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px` }),
      h('div', { class: `town-point-hand ${below ? '' : 'from-top'}`, style: `left:${cx - 22}px;top:${below ? box.top + box.height + 4 : box.top - 52}px` }, icon('pointer')),
      h('div', { class: 'town-point-label', style: `left:${lx}px;width:${lw}px;${below ? `top:${box.top + box.height + 56}px` : `bottom:${window.innerHeight - box.top + 56}px`}` }, `ここ！ ${spot.label}`));
    document.body.append(root);
    let timer = 0;
    const off = () => { root.remove(); clearTimeout(timer); document.removeEventListener('pointerdown', off, true); };
    timer = setTimeout(off, 6000);
    setTimeout(() => document.addEventListener('pointerdown', off, true), 300);
  });
  }, 80);
}
