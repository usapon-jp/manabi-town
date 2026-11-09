// 社会の「ながれ動画」: ピヨちゃんが 紙芝居で ざっと 流れを 説明する（読み上げは 端末の機能。料金なし）。
// 自動で すすむ・タップで 一時停止／つぎへ・字幕つき。
import { h } from './ui.js';
import { createVoice, canSpeak } from './voice.js';
import { STORIES } from './data/stories.js';

export const storyFor = (bookId) => STORIES.find((s) => s.book === bookId) || null;

// onDone(): さいごまで 見て「問題に チャレンジ！」を おしたとき
export function openStory(story, { onDone } = {}) {
  let i = 0; let paused = false; let timer = null; let ended = false; let sound = false;   // 字幕が 主役。🔊を おすと 読み上げ
  const voice = createVoice({ onSpeaking: (on) => piyo.classList.toggle('talk', on) });
  const piyo = h('img', { class: 'st-piyo', src: 'assets/brain/piyo.webp', alt: '', draggable: 'false' });
  const year = h('div', { class: 'st-year' });
  const head = h('h2', { class: 'st-head' });
  const art = h('div', { class: 'st-art' });
  const say = h('p', { class: 'st-say' });
  const dots = h('div', { class: 'st-dots' }, story.scenes.map(() => h('i')));
  const stage = h('div', { class: 'st-stage' }, year, head, art, say);
  const pauseBtn = h('button', { type: 'button', class: 'st-btn', onclick: (e) => { e.stopPropagation(); togglePause(); } }, '⏸');
  const soundBtn = h('button', { type: 'button', class: 'st-btn', hidden: !canSpeak, onclick: (e) => { e.stopPropagation(); sound = !sound; soundBtn.textContent = sound ? '🔊' : '🔇'; if (!sound) voice.stopSpeak(); } }, '🔇');
  const closeBtn = h('button', { type: 'button', class: 'st-btn', onclick: (e) => { e.stopPropagation(); close(); } }, '✕');
  const nextBtn = h('button', { type: 'button', class: 'st-btn', onclick: (e) => { e.stopPropagation(); go(i + 1); } }, '▶');
  const prevBtn = h('button', { type: 'button', class: 'st-btn', onclick: (e) => { e.stopPropagation(); go(i - 1); } }, '◀');
  const top = h('div', { class: 'st-top' }, h('b', {}, story.title), closeBtn);
  const bar = h('div', { class: 'st-bar' }, prevBtn, pauseBtn, nextBtn, soundBtn);
  const endBox = h('div', { class: 'st-end', hidden: true },
    h('p', {}, 'これで ながれは おしまい！'),
    h('button', { type: 'button', class: 'btn primary', onclick: (e) => { e.stopPropagation(); close(); onDone?.(); } }, 'とじて 問題に すすむ'),
    h('button', { type: 'button', class: 'link', onclick: (e) => { e.stopPropagation(); go(0); } }, 'もう一度 見る'));
  const el = h('div', { class: 'story', onclick: () => { if (!ended) togglePause(); } }, top, stage, endBox, dots, piyo, bar);
  document.body.append(el);

  function close() { clearTimeout(timer); voice.stopSpeak(); el.remove(); }
  function togglePause() {
    paused = !paused; pauseBtn.textContent = paused ? '▶▶' : '⏸'; el.classList.toggle('paused', paused);
    if (paused) { clearTimeout(timer); voice.stopSpeak(); } else show();
  }
  function go(n) {
    if (n < 0) n = 0;
    if (n >= story.scenes.length) { finish(); return; }
    i = n; ended = false; endBox.hidden = true; stage.hidden = false; show();
  }
  function finish() {
    clearTimeout(timer); voice.stopSpeak(); ended = true; stage.hidden = true; endBox.hidden = false;
    dots.querySelectorAll('i').forEach((d) => d.classList.add('on'));
  }
  function show() {
    clearTimeout(timer); voice.stopSpeak();
    const s = story.scenes[i];
    year.textContent = s.year; head.textContent = s.head; say.textContent = s.say;
    art.replaceChildren(...s.art.map((a, k) => h('span', { style: `animation-delay:${k * 0.25}s` }, a)));
    stage.classList.remove('in'); void stage.offsetWidth; stage.classList.add('in');
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k <= i));
    if (paused) return;
    const next = () => { if (!paused && !ended) go(i + 1); };
    const wait = Math.max(5000, s.say.length * 220);   // 音なしでも 読める長さ
    if (sound && canSpeak) {
      let done = false; const once = () => { if (done) return; done = true; clearTimeout(timer); timer = setTimeout(next, 600); };
      voice.speak(`${s.head}。${s.say}`, once);
      timer = setTimeout(once, wait + 8000);   // 読み上げが 止まったとき用
    } else timer = setTimeout(next, wait);
  }
  voice.unlock();
  show();
}

// ながれ動画の 一覧（だれでも えらんで 見られる）。まちの 映画館・図書館の 入口からも これを よぶ。
export function openStoryList() {
  const close = () => el.remove();
  const el = h('div', { class: 'sheet', onclick: (e) => { if (e.target === el) close(); } },
    h('div', { class: 'sheet-card' },
      h('h3', { class: 'sheet-title' }, 'ながれ動画'),
      h('p', { class: 'sheet-sub' }, 'ピヨちゃんが 社会の 流れを ざっと 説明するよ'),
      ...STORIES.map((s) => h('button', { type: 'button', class: 'btn', onclick: () => { close(); openStory(s); } }, `▶ ${s.title}`)),
      h('button', { class: 'link', onclick: close }, 'とじる')));
  document.body.append(el);
}
