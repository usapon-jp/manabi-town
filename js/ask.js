// 「ピヨ先生に しつもん」: わからない所を、チャットで聞く。写真（カメラ）で問題を見せられて、図でも せつめいしてくれる。
// 会話は Haiku（受け口の action: ask）。会話はこの画面を閉じたら消える（保存しない）。
import { h, toast } from './ui.js';
import { gradeLabel } from './store.js';
import { askAI, aiErrorText, aiLeft } from './ai.js';
import { openPhotos } from './photos.js';
import { shrink } from './scan.js';
import { icon } from './icons.js';
import { createVoice, canListen, canSpeak, isStandalone } from './voice.js';

const SUBJECTS = ['国語', '算数・数学', '理科', '社会', '英語'];

export function openAsk(p, { subject } = {}) {
  document.querySelector('.chat.ask')?.remove();
  const messages = [];   // { role, text }
  let sticky = null;     // さいごに送った写真。つづきの しつもんにも つける
  let photo = null;      // つぎのしつもんに つける写真（data URL）
  let busy = false;
  const voice = createVoice();
  let closed = false;
  let voiceOn = false;   // 音声モード: 返事を読み上げて、おわったら また聞きとる
  let subj = subject || '';

  const log = h('div', { class: 'chat-log' });
  const input = h('input', { type: 'text', maxlength: 300, placeholder: 'わからない ことを 書いてね', enterkeyhint: 'send' });
  const thumb = h('div', { class: 'ask-thumb', hidden: true });
  const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: async () => {
    const f = file.files?.[0]; file.value = '';
    if (!f) return;
    try { photo = await shrink(f); } catch { toast('この写真は ひらけなかった'); return; }
    showThumb();
  } });
  function showThumb() {
    thumb.hidden = false;
    thumb.replaceChildren(h('img', { src: photo, alt: '' }), h('button', { type: 'button', 'aria-label': '写真をはずす', onclick: () => { photo = null; thumb.hidden = true; } }, icon('x')));
  }
  const subjRow = h('div', { class: 'chat-choices' }, SUBJECTS.map((s) => h('button', { type: 'button', class: `pick ${s === subj ? 'on' : ''}`,
    onclick: (e) => { subj = subj === s ? '' : s; subjRow.querySelectorAll('.pick').forEach((b) => b.classList.toggle('on', b === e.currentTarget && !!subj)); } }, s)));
  const mic = h('button', { type: 'button', class: 'chat-cam chat-mic', 'aria-label': '声で はなす', hidden: !canListen, onclick: () => { voice.unlock(); if (voice.listening()) voice.stopListen(); else listen(); } }, icon('mic'));
  const speaker = h('button', { type: 'button', class: 'chat-close chat-voice', 'aria-label': '音声モード', hidden: !(canListen || canSpeak), onclick: () => {
    voiceOn = !voiceOn;
    voice.unlock();
    speaker.classList.toggle('on', voiceOn);
    speaker.replaceChildren(icon(voiceOn ? 'volume-2' : 'volume-x'));
    if (voiceOn) {
      if (!canListen) toast('この端末では 声の入力は つかえないけど、読み上げは するよ');
      else if (isStandalone() && /iPad|iPhone|Macintosh/.test(navigator.userAgent)) toast('ホーム画面のアプリだと 声が つかえないことが あるよ。Safariで ひらいてみてね', 5000);
      else listen();
    } else { voice.destroy(); setMic(false); }
  } }, icon('volume-x'));
  function setMic(on) { mic.classList.toggle('on', on); }
  function listen() {
    if (busy || closed) return;
    setMic(true);
    input.placeholder = 'きいてるよ…はなしてね';
    voice.listen({
      onInterim: (t) => { input.value = t; },
      onResult: (t) => { input.value = t; ask(); },
      onEnd: (why) => {
        setMic(false); input.placeholder = 'わからない ことを 書いてね';
        if (why === 'denied') { voiceOn = false; speaker.classList.remove('on'); speaker.replaceChildren(icon('volume-x')); toast('マイクが つかえないよ。ブラウザの せっていで ゆるしてね', 5000); }
        else if (why === 'error') toast('うまく きこえなかった…もういちど');
      },
    });
  }
  const form = h('form', { class: 'chat-input', onsubmit: (e) => { e.preventDefault(); ask(); } },
    h('button', { type: 'button', class: 'chat-cam', 'aria-label': 'しゃしんを とる', onclick: () => file.click() }, icon('camera')),
    h('button', { type: 'button', class: 'chat-cam', 'aria-label': 'しりょうから えらぶ', onclick: () => openPhotos(p, { pick: 1, onPick: (urls) => { if (urls[0]) { photo = urls[0]; showThumb(); } } }) }, icon('folder')),
    input, mic, h('button', { class: 'chat-send', type: 'submit', 'aria-label': 'おくる' }, icon('send')));
  const close = () => { closed = true; voiceOn = false; voice.destroy(); layer.remove(); document.body.classList.remove('running'); };
  const layer = h('div', { class: 'chat ask' },
    h('div', { class: 'chat-top' },
      h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 36, height: 36 }),
      h('b', {}, 'ピヨ先生に しつもん'),
      speaker,
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
    voice.stopSpeak();
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
      if (closed) return;
      messages.push({ role: 'assistant', text: r.say || '' });
      bubble('assistant', r.say || '', r.svg ? diagram(r.svg) : null);
      if (voiceOn && !closed && r.say) voice.speak(r.say, () => { if (voiceOn && !closed && canListen) listen(); });
    } catch (e) {
      wait.remove();
      messages.pop();   // 送れなかった質問は もどす
      bubble('assistant err', aiErrorText(e).replace('ヒント', 'しつもん'));
      input.value = t;
    }
    busy = false;
  }
}
