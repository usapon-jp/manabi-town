// 理科の 短い動画（mp4。単元ごとに 1本）と、動画に 合わせた 問題の メニュー（ステップの道）。
// 単元 1〜6: 動画を 見る → その単元の 問題（2〜3もん）→ メニューに もどる、を くりかえす。
// そのあと れんしゅう・まとめ動画・しあげテスト・プリント。問題は 小テストと 同じ runner で 出す。
// ロックは しない（どこからでも ひらける）。まだ クリアしていない いちばん上の 単元を「つぎは ここ」に する。
import { h } from './ui.js';
import { icon } from './icons.js';
import { runQuestions } from './runner.js';
import { recordResults } from './review.js';
import { save } from './store.js';
import { POINTS_PER_CORRECT } from './quests.js';
import { MAGNET, MAGNET_UNITS, MAGNET_SETS, MAGNET_PRINT_ONLY } from './data/science-magnet.js';

const VIDEOS = MAGNET.videos;
const MATOME = VIDEOS.length; // 7 = まとめ動画
const about = (sec) => (sec >= 45 ? '約1分' : `約${Math.round(sec / 10) * 10}秒`);

// 全画面で 動画を 見る。見おわる か「問題に すすむ」で onDone()。goLabel でボタンの 文字を かえる
export function openVideo(video, { onDone, goLabel = '問題に すすむ', onSeen } = {}) {
  const v = h('video', { class: 'vd-video', controls: true, playsinline: true, preload: 'metadata', src: video.src, poster: video.poster || null });
  const note = h('p', { class: 'vd-note', hidden: true }, '動画を 読みこめなかったよ。ネットに つながっているか 見てね');
  const go = h('button', { type: 'button', class: 'btn primary vd-go', onclick: () => { close(); onDone?.(); } }, goLabel, icon('chevron-right'));
  const el = h('div', { class: 'story vd', lang: 'ja' },
    h('div', { class: 'st-top' }, h('b', {}, `動画${video.n}　${video.title}`), h('button', { type: 'button', class: 'st-btn', 'aria-label': 'とじる', onclick: close }, icon('x'))),
    h('div', { class: 'vd-box' }, v, note),
    h('div', { class: 'vd-foot' }, go));
  let seen = false;
  const markSeen = () => { if (!seen) { seen = true; onSeen?.(); } };
  function close() { v.pause(); el.remove(); }
  v.addEventListener('error', () => { note.hidden = false; });
  // 8わり 見たら「見た」に する（さいごの「つぎの動画」の あたりで とじても 見たことに）
  v.addEventListener('timeupdate', () => { if (v.duration && v.currentTime > v.duration * 0.8) markSeen(); });
  v.addEventListener('ended', () => { markSeen(); close(); onDone?.(); });
  document.body.append(el);
  v.play().catch(() => { /* 自動で 再生できない 端末は ▶ を おしてもらう */ });
}

const KEY = (id) => `${MAGNET.id}:${id}`;
const getState = (p, id) => p?.videoSets?.[KEY(id)];
const setState = (p, id) => {
  if (!p) return {};
  if (!p.videoSets || typeof p.videoSets !== 'object') p.videoSets = {};
  return (p.videoSets[KEY(id)] ||= {});
};
// 見た 動画の 番号（'denryu-jikai:videos' の seen）
const seenList = (p) => (Array.isArray(getState(p, 'videos')?.seen) ? getState(p, 'videos').seen : []);
function markSeen(p, n) {
  if (!p) return;
  const st = setState(p, 'videos');
  const list = Array.isArray(st.seen) ? st.seen : [];
  if (!list.includes(n)) { st.seen = [...list, n].sort((a, b) => a - b); save(); }
}
// まちがえて 見直す 動画の 番号（前の 1本の 動画の ころの 秒の 記録は つかわない）
const missVideos = (st) => (st?.miss || []).filter((n) => Number.isInteger(n) && n >= 1 && n <= MATOME);

function watch(n, deps, onDone, goLabel) {
  const { p } = deps;
  openVideo(VIDEOS[n - 1], { onDone, goLabel, onSeen: () => markSeen(p, n) });
}

// 学習メニュー（ステップの道）。deps: { p, gain(p, n, reason), render() }
export function openMagnetMenu(deps = {}) {
  const { p } = deps;
  const close = () => el.remove();
  const seen = seenList(p);
  const nextUnit = MAGNET_UNITS.find((u) => !getState(p, u.id)?.cleared);
  const back = () => openMagnetMenu(deps);

  const unitRow = (u) => {
    const st = getState(p, u.id);
    const isNext = u === nextUnit;
    const status = st?.cleared ? h('span', { class: 'vd-clear' }, icon('check'), 'クリア')
      : st?.best != null ? h('small', { class: 'vd-best' }, `さいこう ${st.best}/${u.questions.length}`)
        : seen.includes(u.video) ? h('small', { class: 'vd-best' }, icon('eye'), '見た') : null;
    return h('div', { class: `vd-row${st?.cleared ? ' done' : ''}${isNext ? ' next' : ''}` },
      h('button', { type: 'button', class: 'btn vd-set', onclick: () => { close(); watch(u.video, deps, () => startSet(u, deps)); } },
        h('span', { class: 'vd-step' }, String(u.n)),
        h('span', { class: 'vd-set-text' },
          isNext ? h('em', { class: 'vd-next' }, 'つぎは ここ') : null,
          h('b', {}, u.label),
          h('small', {}, icon('play'), `動画（${about(VIDEOS[u.video - 1].sec)}）→ もんだい ${u.questions.length}もん`)),
        status),
      h('button', { type: 'button', class: 'vd-qonly', 'aria-label': `${u.label} の もんだいだけ`, onclick: () => { close(); startSet(u, deps); } }, icon('pencil'), h('small', {}, 'もんだい')));
  };
  const setRow = (s, mark) => {
    const st = getState(p, s.id);
    return h('button', { type: 'button', class: `btn vd-set${st?.cleared ? ' done' : ''}`, onclick: () => { close(); startSet(s, deps); } },
      h('span', { class: 'vd-step' }, mark),
      h('span', { class: 'vd-set-text' }, h('b', {}, s.label), h('small', {}, `${s.sub}・${s.questions.length}もん`)),
      st?.cleared ? h('span', { class: 'vd-clear' }, icon('check'), 'クリア') : st?.best != null ? h('small', { class: 'vd-best' }, `さいこう ${st.best}/${s.questions.length}`) : null);
  };
  const matome = VIDEOS[MATOME - 1];
  const matomeRow = h('button', { type: 'button', class: 'btn vd-set', onclick: () => { close(); watch(MATOME, deps, back, 'メニューに もどる'); } },
    h('span', { class: 'vd-step' }, icon('play')),
    h('span', { class: 'vd-set-text' }, h('b', {}, 'まとめ動画'), h('small', {}, `テスト直前チェック（${about(matome.sec)}）。しあげテストの 前に`)),
    seen.includes(MATOME) ? h('small', { class: 'vd-best' }, icon('eye'), '見た') : null);

  const misses = [...new Set([...MAGNET_UNITS, ...MAGNET_SETS].flatMap((s) => missVideos(getState(p, s.id))))].sort((a, b) => a - b);
  const el = h('div', { class: 'sheet', onclick: (e) => { if (e.target === el) close(); } },
    h('div', { class: 'sheet-card vd-menu' },
      h('h3', { class: 'sheet-title' }, MAGNET.title),
      h('p', { class: 'sheet-sub' }, '短い 動画を 1本 見たら、すぐ 問題。これを 6回 くりかえそう'),
      h('p', { class: 'vd-label' }, 'ステップ1・2　単元ごとに 動画 → もんだい'),
      ...MAGNET_UNITS.map(unitRow),
      h('p', { class: 'vd-label' }, 'ステップ3・4　まとめて ためす'),
      setRow(MAGNET_SETS[0], '練'),
      matomeRow,
      setRow(MAGNET_SETS[1], '★'),
      h('p', { class: 'vd-rule' }, '8わり せいかいで クリア。1もん 10ポイント（はじめての クリアだけ）'),
      misses.length ? h('div', { class: 'vd-again' },
        h('p', {}, 'まちがえた ところを 動画で 見直そう'),
        h('div', { class: 'vd-times' }, misses.map((n) => h('button', { type: 'button', class: 'vd-chap', onclick: () => { close(); watch(n, deps, back, 'メニューに もどる'); } }, icon('play'), `動画${n} を 見る`)))) : null,
      h('div', { class: 'vd-print' },
        h('p', {}, h('b', {}, 'プリントで やってみよう')),
        h('small', {}, `${MAGNET_PRINT_ONLY}は 紙に 書いて 答えよう。時間を はかる しあげテスト（50点）も プリントに あるよ`),
        h('a', { class: 'btn small', href: MAGNET.print.mondai, target: '_blank', rel: 'noopener' }, icon('notebook-text'), ' 問題編（PDF）'),
        h('small', {}, 'とき おわってから ひらこう'),
        h('a', { class: 'btn small', href: MAGNET.print.kaitou, target: '_blank', rel: 'noopener' }, icon('circle-check'), ' 解答・解説編（PDF）')),
      h('button', { class: 'link', onclick: close }, 'とじる')));
  document.body.append(el);
  el.querySelector('.vd-row.next')?.scrollIntoView?.({ block: 'nearest' });
}

// 単元の 問題・れんしゅう・しあげテスト を とく
function startSet(set, deps) {
  const { p, gain, render } = deps;
  const title = `電流と磁界 ${set.n ? `${set.n} ${set.label}` : set.label}`;
  let miss = [];
  runQuestions(title, set.questions, (score, total, results) => {
    if (p) recordResults(p, results, title);
    const st = setState(p, set.id);
    st.best = Math.max(st.best || 0, score);
    miss = [...new Set(results.filter((r) => !r.ok).map((r) => r.q.v))].sort((a, b) => a - b);
    st.miss = miss;
    const backTo = miss.length ? `まちがえたら 動画${miss.join('・動画')} を もういちど 見よう` : '';
    const say = (head) => [head, backTo].filter(Boolean).join('。');
    if (score * 5 < total * 4) { save(); return say('8わり せいかいで クリア！もういちど やってみよう'); }
    if (st.cleared) { save(); return say('れんしゅうなので ポイントはないよ'); }
    st.cleared = true;
    if (p && gain) gain(p, score * POINTS_PER_CORRECT, title); else save();
    render?.();
    return say(`クリア！ +${score * POINTS_PER_CORRECT} ポイント`);
  }, {
    again: { label: '学習メニューへ', onClick: () => openMagnetMenu(deps) },
    // まちがえた 単元の 動画を 見なおす。単元の 問題なら 見たあと もういちど その問題へ
    more: () => miss.map((n) => ({
      label: `動画${n} を 見る`,
      onClick: () => (set.n
        ? watch(n, deps, () => startSet(set, deps), 'もういちど 問題へ')
        : watch(n, deps, () => openMagnetMenu(deps), 'メニューに もどる')),
    })),
  });
}
