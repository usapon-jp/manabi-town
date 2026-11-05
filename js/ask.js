// 「ピヨ先生に しつもん」: わからない所を、チャットで聞く。写真（カメラ）で問題を見せられて、図でも せつめいしてくれる。
// 会話は Haiku（受け口の action: ask）。会話はこの画面を閉じたら消える（保存しない）。
// モード: しつもん / 図で おしえて（かならず図つき）/ 英語 よみあげ（英文を声で）/ 英会話（英語で おしゃべり）
// 声は 端末の読み上げ・音声入力をつかう（お金はかからない）。
import { h, toast } from './ui.js';
import { pickPhoto } from './pickphoto.js';
import { gradeLabel } from './store.js';
import { askAI, aiErrorText, aiLeft } from './ai.js';
import { openPhotos } from './photos.js';
import { shrink } from './scan.js';
import { icon } from './icons.js';
import { createVoice, canListen, canSpeak, isStandalone } from './voice.js';

const SUBJECTS = ['国語', '算数・数学', '理科', '社会', '英語'];

export const MODES = {
  ask: { ic: 'message-circle', label: 'しつもん', ph: 'わからない ことを 書いてね',
    hello: 'こんにちは！ わからない問題を 書くか、写真で 見せてね。図で せつめいも できるよ' },
  zu: { ic: 'shapes', label: '図で 教えて', ph: '図で 知りたい ことは？', subject: '算数・数学',
    hello: '図を かいて せつめいするね。問題を 書くか、写真で 見せてね。\nれい: 「三角形の 面積は どうして ÷2 なの？」' },
  yomu: { ic: 'volume-2', label: '英語 読み上げ', ph: '英語を 書いてね', subject: '英語',
    hello: '読みたい 英語を 書くか、教科書の 写真を 見せてね。声で 読むよ。\nスピーカーを つづけて おすと ゆっくり 読むよ' },
  talk: { ic: 'languages', label: '英会話', ph: '英語で 書いてね', subject: '英語',
    hello: 'やあ！ ピヨだよ。英語で おしゃべり しよう。マイクで 話しても、書いても いいよ',
    helloEn: "Hi! I'm Piyo. How are you today?" },
};

// p: プロフィール。opt.subject: 教科（タイマーの教科など）。opt.mode: さいしょの モード
// 本気モードの メガネ: ピヨの 目（36px の アイコン上）に ◯◯ を かさねるだけ
function faceGlasses() {
  const el = document.createElement('span');
  el.className = 'ask-face-glasses';
  el.innerHTML = '<svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true" fill="none" stroke="#3b2f22" stroke-width="1.4">'
    + '<circle cx="14.1" cy="13" r="3.4"/><circle cx="22.3" cy="13" r="3.4"/><path d="M17.5 12.6h1.4"/></svg>';
  return el;
}

export function openAsk(p, { subject, mode: startMode } = {}) {
  document.querySelector('.chat.ask')?.remove();
  let mode = MODES[startMode] ? startMode : 'ask';
  let messages = [];     // { role, text }
  let sticky = null;     // さいごに送った写真。つづきの しつもんにも つける
  let photo = null;      // つぎのしつもんに つける写真（data URL）
  let busy = false;
  let turn = 0;          // モードを かえたら ふえる（古い返事を 出さないため）
  const stopBtn = h('button', { type: 'button', class: 'ask-stop', hidden: true, onclick: () => voice.stopSpeak() }, h('i', { class: 'ask-stop-sq' }), '読み上げを 止める');
  const voice = createVoice({ onSpeaking: (on) => { stopBtn.hidden = !on; } });
  let closed = false;
  let voiceOn = false;   // 音声モード: 返事を読み上げて、おわったら また聞きとる
  let subj = subject || '';
  // 本気モード（メガネ）: おすと かならず Sonnet が じっくり考えて答える。ふだんは 受け口が 自動で ふりわける
  let honki = false;
  const honkiBtn = h('button', { type: 'button', class: 'ask-honki', 'aria-pressed': 'false', title: '本気モード（じっくり 考えて 答える）', onclick: () => {
    honki = !honki;
    honkiBtn.classList.toggle('on', honki);
    honkiBtn.setAttribute('aria-pressed', String(honki));
    layer.classList.toggle('honki', honki);
  } }, icon('glasses'), h('span', {}, '本気'));
  const listenLang = () => (mode === 'talk' ? 'en-US' : 'ja-JP');

  const log = h('div', { class: 'chat-log' });
  const input = h('input', { type: 'text', maxlength: 300, placeholder: MODES[mode].ph, enterkeyhint: 'send' });
  const thumb = h('div', { class: 'ask-thumb', hidden: true });
  const takePhoto = async (f) => {
    if (!f) return;
    try { photo = await shrink(f); } catch { toast('この写真は 開けなかった'); return; }
    showThumb();
  };
  function showThumb() {
    thumb.hidden = false;
    thumb.replaceChildren(h('img', { src: photo, alt: '' }), h('button', { type: 'button', 'aria-label': '写真をはずす', onclick: () => { photo = null; thumb.hidden = true; } }, icon('x')));
  }
  const subjRow = h('div', { class: 'chat-choices' }, SUBJECTS.map((s) => h('button', { type: 'button', class: `pick ${s === subj ? 'on' : ''}`,
    onclick: (e) => { subj = subj === s ? '' : s; subjRow.querySelectorAll('.pick').forEach((b) => b.classList.toggle('on', b === e.currentTarget && !!subj)); } }, s)));
  const mic = h('button', { type: 'button', class: 'chat-cam chat-mic', 'aria-label': '声で 話す', hidden: !canListen, onclick: () => { voice.unlock(); if (voice.listening()) voice.stopListen(); else listen(); } }, icon('mic'));
  const speaker = h('button', { type: 'button', class: 'chat-close chat-voice', 'aria-label': '音声モード', hidden: !(canListen || canSpeak), onclick: () => {
    voiceOn = !voiceOn;
    voice.unlock();
    speaker.classList.toggle('on', voiceOn);
    speaker.replaceChildren(icon(voiceOn ? 'volume-2' : 'volume-x'));
    if (voiceOn) {
      if (!canListen) toast('この端末では 声の入力は 使えないけど、読み上げは するよ');
      else if (isStandalone() && /iPad|iPhone|Macintosh/.test(navigator.userAgent)) toast('ホーム画面のアプリだと 声が 使えないことが あるよ。Safariで 開いてみてね', 5000);
      else listen();
    } else { voice.destroy(); setMic(false); }
  } }, icon('volume-x'));
  function setMic(on) { mic.classList.toggle('on', on); }
  function listen() {
    if (busy || closed) return;
    setMic(true);
    input.placeholder = mode === 'talk' ? "I'm listening… 英語で 話してね" : '聞いてるよ…話してね';
    voice.listen({
      lang: listenLang(),
      onInterim: (t) => { input.value = t; },
      onResult: (t) => { input.value = t; ask(); },
      onEnd: (why) => {
        setMic(false); input.placeholder = MODES[mode].ph;
        if (why === 'denied') { voiceOn = false; speaker.classList.remove('on'); speaker.replaceChildren(icon('volume-x')); toast('マイクが 使えないよ。ブラウザの せっていで ゆるしてね', 5000); }
        else if (why === 'error') toast('うまく 聞こえなかった…もう一度');
      },
    });
  }
  const camBtn = h('button', { type: 'button', class: 'chat-cam', 'aria-label': '写真を 入れる', onclick: () => pickPhoto(takePhoto, { title: 'しつもんの 写真' }) }, icon('camera'));
  const libBtn = h('button', { type: 'button', class: 'chat-cam', 'aria-label': 'しりょうから えらぶ', onclick: () => openPhotos(p, { pick: 1, onPick: (urls) => { if (urls[0]) { photo = urls[0]; showThumb(); } } }) }, icon('folder'));
  const form = h('form', { class: 'chat-input', onsubmit: (e) => { e.preventDefault(); voice.unlock(); ask(); } },
    camBtn, libBtn, input, mic, h('button', { class: 'chat-send', type: 'submit', 'aria-label': '送る' }, icon('send')));

  // モードの きりかえ（上の ならび）
  const modeRow = h('div', { class: 'ask-modes', role: 'tablist' }, Object.entries(MODES).map(([id, m]) =>
    h('button', { type: 'button', role: 'tab', 'data-mode': id, class: id === mode ? 'on' : '', onclick: () => { voice.unlock(); setMode(id); } }, icon(m.ic), h('span', {}, m.label))));

  const close = () => { closed = true; voiceOn = false; voice.destroy(); layer.remove(); document.body.classList.remove('running'); };
  const layer = h('div', { class: 'chat ask' },
    h('div', { class: 'ask-head' },
      h('div', { class: 'chat-top' },
        h('span', { class: 'ask-face' }, h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 36, height: 36 }), faceGlasses()),
        h('b', {}, 'ピヨ先生'),
        honkiBtn,
        speaker,
        h('button', { class: 'chat-close', 'aria-label': 'とじる', onclick: close }, icon('x'))),
      modeRow),
    log, h('div', { class: 'chat-foot' }, stopBtn, subjRow, thumb, form));
  document.body.append(layer);
  document.body.classList.add('running');

  const bubble = (role, ...kids) => { const b = h('div', { class: `msg ${role}` }, ...kids); log.append(b); log.scrollTop = log.scrollHeight; return b; };

  // 図（SVG）は <img> として出す（中のスクリプトは うごかない）
  const diagram = (svg) => h('img', { class: 'ask-diagram', alt: 'ピヨ先生の図', src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` });

  // スピーカー: 1回目は ふつう、つづけて おすと ゆっくり
  function sayBtn(text, lang, label) {
    if (!canSpeak || !text) return null;
    let last = 0;
    return h('button', { type: 'button', class: 'ask-say', 'aria-label': label || '読み上げ', onclick: (e) => {
      e.stopPropagation();
      voice.unlock();
      const slow = Date.now() - last < 3000;
      last = Date.now();
      voice.speak(text, null, { lang, slow });
    } }, icon('volume-2'), label ? h('span', {}, label) : null);
  }
  const enBox = (en) => h('div', { class: 'ask-en', lang: 'en' }, h('p', {}, en), sayBtn(en, 'en-US', '聞く'));

  // ピヨ先生の ふきだし: { say, svg, en, fix }
  function piyoBubble(r) {
    const kids = [];
    if (mode === 'talk' && r.en) kids.push(enBox(r.en));
    if (r.say) kids.push(h('p', { class: mode === 'talk' ? 'ask-ja' : '' }, r.say));
    if (r.svg) kids.push(diagram(r.svg));
    if (mode !== 'talk' && r.en) kids.push(enBox(r.en));
    if (r.fix) kids.push(h('div', { class: 'ask-fix' }, h('small', {}, 'こう言うと もっと いいよ'), h('p', { lang: 'en' }, r.fix), sayBtn(r.fix, 'en-US')));
    const foot = r.say && mode !== 'talk' ? sayBtn(r.say, 'mix', '読んで') : null;
    return bubble('assistant', ...kids, foot ? h('div', { class: 'ask-foot' }, foot) : null);
  }

  function setMode(id) {
    if (!MODES[id]) return;
    voice.stopSpeak(); voice.stopListen(); setMic(false);
    mode = id; turn += 1; busy = false;
    messages = []; sticky = null;
    modeRow.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.mode === id));
    input.placeholder = MODES[id].ph;
    const fixed = MODES[id].subject;
    if (fixed && id !== 'zu') subj = fixed;
    else if (id === 'zu' && !subj) subj = fixed;
    subjRow.querySelectorAll('.pick').forEach((b) => b.classList.toggle('on', b.textContent === subj));
    subjRow.hidden = id === 'yomu' || id === 'talk';
    camBtn.hidden = libBtn.hidden = id === 'talk';   // 英会話は 声と文字だけ
    honkiBtn.hidden = id !== 'ask';   // 図では いつも じっくり。英語は ふつうで じゅうぶん
    layer.classList.toggle('honki', honki && id === 'ask');
    log.replaceChildren();
    if (id === 'talk') {
      messages.push({ role: 'assistant', text: MODES.talk.helloEn });
      piyoBubble({ en: MODES.talk.helloEn, say: MODES.talk.hello });
      voice.speak(MODES.talk.helloEn, () => { if (voiceOn && !closed && canListen && mode === 'talk') listen(); }, { lang: 'en-US' });
    } else bubble('assistant', MODES[id].hello);
  }

  async function ask() {
    const t = input.value.trim();
    if (busy || (!t && !photo)) return;
    voice.stopSpeak();
    if (aiLeft() <= 0) { toast('今日の しつもんは ここまで。また 明日ね'); return; }
    busy = true;
    const my = turn;
    const img = photo;
    if (img) sticky = img;
    input.value = ''; photo = null; thumb.hidden = true;
    const blank = mode === 'yomu' ? '（写真の 英語を 読んで）' : '（写真の 問題を 教えて）';
    messages.push({ role: 'user', text: t || blank });
    bubble('user', img ? h('img', { class: 'ask-photo', src: img, alt: '' }) : null, t);
    const wait = bubble('assistant thinking', mode === 'zu' ? '図を かいてるよ…' : honki && mode === 'ask' ? '本気で 考え中…' : '考え中…');
    try {
      const r = await askAI({ action: 'ask', mode, grade: gradeLabel(p), subject: subj, messages, image: sticky || undefined, smart: honki && mode === 'ask' }, { timeout: mode === 'zu' || mode === 'ask' ? 90000 : 45000 });
      wait.remove();
      if (closed || my !== turn) return;
      // 会話の つづきに つかう ことば（英会話は 英語のまま、ほかは 英文も つける）
      const text = mode === 'talk' ? (r.en || r.say || '') : [r.say, r.en].filter(Boolean).join('\n');
      messages.push({ role: 'assistant', text });
      const norm = (x) => x.toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9' ]/g, '').replace(/\s+/g, ' ').trim();
      const same = (a, b) => norm(a) === norm(b);
      if (r.fix && t && same(r.fix, t)) r.fix = '';   // 「.」がないだけ などは なおさない
      piyoBubble(r);
      const again = () => { if (voiceOn && !closed && canListen && my === turn) listen(); };
      if (mode === 'talk' && r.en) voice.speak(r.en, again, { lang: 'en-US' });
      else if (mode === 'yomu' && r.en) voice.speak(r.en, again, { lang: 'en-US' });
      else if (voiceOn && r.say) voice.speak(r.say, again, { lang: 'mix' });
    } catch (e) {
      wait.remove();
      if (my !== turn) return;
      messages.pop();   // 送れなかった質問は もどす
      bubble('assistant err', aiErrorText(e).replace('ヒント', 'しつもん'));
      input.value = t;
    } finally {
      if (my === turn) busy = false;
    }
  }

  setMode(mode);
}
