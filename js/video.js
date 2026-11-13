// 理科の 動画（mp4）と、動画に 合わせた 問題の メニュー。
// 動画 → 学習メニュー（かくにん・れんしゅう・しあげテスト・プリント）。問題は 小テストと 同じ runner で 出す。
import { h } from './ui.js';
import { icon } from './icons.js';
import { runQuestions } from './runner.js';
import { recordResults } from './review.js';
import { save } from './store.js';
import { POINTS_PER_CORRECT } from './quests.js';
import { MAGNET_VIDEO, MAGNET_SETS, MAGNET_PRINT_ONLY } from './data/science-magnet.js';

export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, '0')}`;

// 全画面で 動画を 見る。startAt（秒）から。見おわる か「問題に すすむ」で onDone()
export function openVideo(video, { startAt = 0, onDone } = {}) {
  const v = h('video', { class: 'vd-video', controls: true, playsinline: true, preload: 'metadata', src: video.src, poster: video.poster || null });
  const note = h('p', { class: 'vd-note', hidden: true }, '動画を 読みこめなかったよ。ネットに つながっているか 見てね');
  const jump = (t) => { try { v.currentTime = t; v.play().catch(() => {}); } catch { /* まだ 読みこみ中 */ } };
  const chaps = video.chapters.map((c) => h('button', { type: 'button', class: 'vd-chap', onclick: () => jump(c.at) }, h('small', {}, mmss(c.at)), c.label));
  const go = h('button', { type: 'button', class: 'btn primary vd-go', onclick: () => { close(); onDone?.(); } }, '問題に すすむ', icon('chevron-right'));
  const el = h('div', { class: 'story vd', lang: 'ja' },
    h('div', { class: 'st-top' }, h('b', {}, video.title), h('button', { type: 'button', class: 'st-btn', 'aria-label': 'とじる', onclick: close }, icon('x'))),
    h('div', { class: 'vd-box' }, v, note),
    h('div', { class: 'vd-foot' }, h('div', { class: 'vd-chaps' }, chaps), go));
  function close() { v.pause(); el.remove(); }
  v.addEventListener('error', () => { note.hidden = false; });
  v.addEventListener('ended', () => { close(); onDone?.(); });
  v.addEventListener('timeupdate', () => {
    const t = v.currentTime;
    chaps.forEach((b, i) => b.classList.toggle('on', t >= video.chapters[i].at && t < (video.chapters[i + 1]?.at ?? Infinity)));
  });
  if (startAt) v.addEventListener('loadedmetadata', () => { v.currentTime = startAt; }, { once: true });
  document.body.append(el);
  v.play().catch(() => { /* 自動で 再生できない 端末は ▶ を おしてもらう */ });
}

const setState = (p, id) => {
  if (!p) return {};
  if (!p.videoSets || typeof p.videoSets !== 'object') p.videoSets = {};
  return (p.videoSets[`${MAGNET_VIDEO.id}:${id}`] ||= {});
};

// 学習メニュー。deps: { p, gain(p, n, reason), render() }
export function openMagnetMenu(deps = {}) {
  const { p } = deps;
  const close = () => el.remove();
  const misses = [...new Set(MAGNET_SETS.flatMap((s) => (p?.videoSets?.[`${MAGNET_VIDEO.id}:${s.id}`]?.miss || [])))].sort((a, b) => a - b);
  const setBtn = (s, n) => {
    const st = p?.videoSets?.[`${MAGNET_VIDEO.id}:${s.id}`];
    return h('button', { type: 'button', class: `btn vd-set${st?.cleared ? ' done' : ''}`, onclick: () => { close(); startSet(s, deps); } },
      h('span', { class: 'vd-step' }, String(n + 1)),
      h('span', { class: 'vd-set-text' }, h('b', {}, s.label), h('small', {}, `${s.sub}・${s.questions.length}もん`)),
      st?.cleared ? h('span', { class: 'vd-clear' }, icon('check'), 'クリア') : st?.best != null ? h('small', {}, `さいこう ${st.best}/${s.questions.length}`) : null);
  };
  const el = h('div', { class: 'sheet', onclick: (e) => { if (e.target === el) close(); } },
    h('div', { class: 'sheet-card vd-menu' },
      h('h3', { class: 'sheet-title' }, MAGNET_VIDEO.title),
      h('p', { class: 'sheet-sub' }, '動画を 見てから、上から じゅんに やろう。8わり せいかいで クリア'),
      h('button', { type: 'button', class: 'btn', onclick: () => { close(); openVideo(MAGNET_VIDEO, { onDone: () => openMagnetMenu(deps) }); } }, icon('play'), ' 動画を 見る（4分）'),
      ...MAGNET_SETS.map(setBtn),
      misses.length ? h('div', { class: 'vd-again' },
        h('p', {}, 'まちがえた ところを 動画で 見直そう'),
        h('div', { class: 'vd-times' }, misses.map((t) => h('button', { type: 'button', class: 'vd-chap', onclick: () => { close(); openVideo(MAGNET_VIDEO, { startAt: t, onDone: () => openMagnetMenu(deps) }); } }, `${mmss(t)} から`)))) : null,
      h('div', { class: 'vd-print' },
        h('p', {}, h('b', {}, 'プリントで やってみよう')),
        h('small', {}, `${MAGNET_PRINT_ONLY}は 紙に 書いて 答えよう。時間を はかる しあげテスト（50点）も プリントに あるよ`),
        h('a', { class: 'btn small', href: MAGNET_VIDEO.print.mondai, target: '_blank', rel: 'noopener' }, icon('notebook-text'), ' 問題編（PDF）'),
        h('small', {}, 'とき おわってから ひらこう'),
        h('a', { class: 'btn small', href: MAGNET_VIDEO.print.kaitou, target: '_blank', rel: 'noopener' }, icon('circle-check'), ' 解答・解説編（PDF）')),
      h('button', { class: 'link', onclick: close }, 'とじる')));
  document.body.append(el);
}

function startSet(set, deps) {
  const { p, gain, render } = deps;
  const title = `電流と磁界 ${set.label}`;
  runQuestions(title, set.questions, (score, total, results) => {
    if (p) recordResults(p, results, title);
    const st = setState(p, set.id);
    st.best = Math.max(st.best || 0, score);
    st.miss = [...new Set(results.filter((r) => !r.ok).map((r) => r.q.at))].sort((a, b) => a - b);
    const back = st.miss.length ? `まちがえたら 動画の ${st.miss.map(mmss).join('・')} を もういちど 見よう` : '';
    const say = (head) => [head, back].filter(Boolean).join('。');
    if (score * 5 < total * 4) { save(); return say('8わり せいかいで クリア！もういちど やってみよう'); }
    if (st.cleared) { save(); return say('れんしゅうなので ポイントはないよ'); }
    st.cleared = true;
    if (p && gain) gain(p, score * POINTS_PER_CORRECT, title); else save();
    render?.();
    return say(`クリア！ +${score * POINTS_PER_CORRECT} ポイント`);
  }, { again: { label: '学習メニューへ', onClick: () => openMagnetMenu(deps) } });
}
