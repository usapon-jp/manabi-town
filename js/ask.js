// 「ピヨ先生に しつもん」: わからない所を、チャットで聞く。写真（カメラ）で問題を見せられて、図でも せつめいしてくれる。
// 会話は Haiku（受け口の action: ask）。会話はこの画面を閉じたら消える（保存しない）。
import { h, toast } from './ui.js';
import { gradeLabel } from './store.js';
import { askAI, aiErrorText, aiLeft } from './ai.js';
import { shrink } from './scan.js';
import { icon } from './icons.js';

const SUBJECTS = ['国語', '算数・数学', '理科', '社会', '英語'];

export function openAsk(p, { subject } = {}) {
  document.querySelector('.chat.ask')?.remove();
  const messages = [];   // { role, text }
  let sticky = null;     // さいごに送った写真。つづきの しつもんにも つける
  let photo = null;      // つぎのしつもんに つける写真（data URL）
  let busy = false;
  let subj = subject || '';

  const log = h('div', { class: 'chat-log' });
  const input = h('input', { type: 'text', maxlength: 300, placeholder: 'わからない ことを 書いてね', enterkeyhint: 'send' });
  const thumb = h('div', { class: 'ask-thumb', hidden: true });
  const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: async () => {
    const f = file.files?.[0]; file.value = '';
    if (!f) return;
    try { photo = await shrink(f); } catch { toast('この写真は ひらけなかった'); return; }
    thumb.hidden = false;
    thumb.replaceChildren(h('img', { src: photo, alt: '' }), h('button', { type: 'button', 'aria-label': '写真をはずす', onclick: () => { photo = null; thumb.hidden = true; } }, icon('x')));
  } });
  const subjRow = h('div', { class: 'chat-choices' }, SUBJECTS.map((s) => h('button', { type: 'button', class: `pick ${s === subj ? 'on' : ''}`,
    onclick: (e) => { subj = subj === s ? '' : s; subjRow.querySelectorAll('.pick').forEach((b) => b.classList.toggle('on', b === e.currentTarget && !!subj)); } }, s)));
  const form = h('form', { class: 'chat-input', onsubmit: (e) => { e.preventDefault(); ask(); } },
    h('button', { type: 'button', class: 'chat-cam', 'aria-label': 'しゃしんを とる', onclick: () => file.click() }, icon('camera')),
    input, h('button', { class: 'chat-send', type: 'submit', 'aria-label': 'おくる' }, icon('send')));
  const close = () => { layer.remove(); document.body.classList.remove('running'); };
  const layer = h('div', { class: 'chat ask' },
    h('div', { class: 'chat-top' },
      h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 36, height: 36 }),
      h('b', {}, 'ピヨ先生に しつもん'),
      h('button', { class: 'chat-close', 'aria-label': 'とじる', onclick: close }, icon('x'))),
    log, h('div', { class: 'chat-foot' }, subjRow, thumb, form), file);
  document.body.append(layer);
  document.body.classList.add('running');

  const bubble = (role, ...kids) => { const b = h('div', { class: `msg ${role}` }, ...kids); log.append(b); log.scrollTop = log.scrollHeight; return b; };
  bubble('assistant', 'こんにちは！ わからない問題を 書くか、しゃしんで みせてね。ずで せつめいも できるよ');

  // 図（SVG）は <img> として出す（中のスクリプトは うごかない）
  const diagram = (svg) => h('img', { class: 'ask-diagram', alt: 'ピヨ先生の図', src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` });

  async function ask() {
    const t = input.value.trim();
    if (busy || (!t && !photo)) return;
    if (aiLeft() <= 0) { toast('きょうの しつもんは ここまで。また あしたね'); return; }
    busy = true;
    const img = photo;
    if (img) sticky = img;
    input.value = ''; photo = null; thumb.hidden = true;
    messages.push({ role: 'user', text: t || '（しゃしんの もんだいを おしえて）' });
    bubble('user', img ? h('img', { class: 'ask-photo', src: img, alt: '' }) : null, t);
    const wait = bubble('assistant thinking', 'かんがえ中…');
    try {
      const r = await askAI({ action: 'ask', grade: gradeLabel(p), subject: subj, messages, image: sticky || undefined }, { timeout: 45000 });
      wait.remove();
      messages.push({ role: 'assistant', text: r.say || '' });
      bubble('assistant', r.say || '', r.svg ? diagram(r.svg) : null);
    } catch (e) {
      wait.remove();
      messages.pop();   // 送れなかった質問は もどす
      bubble('assistant err', aiErrorText(e).replace('ヒント', 'しつもん'));
      input.value = t;
    }
    busy = false;
  }
}
