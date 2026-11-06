// 勉強タイマー。たまの勉強タイマーの作りを持ってきた。
// - 種類（宿題・チャレンジ・自主学習・テスト勉強）と教科を選んで、集中（時間をきめる）か計るだけ
// - 1分 = 1ポイント。集中を最後までやりきると +10
// - 時計は「始めた時刻」から数えるので、画面を消しても正しく進む
// - 20分ごとに休けいの声かけ（時間は 20・40・60分）。1回は最大90分
// - ひよこマーク: しつもん・れんしゅう もんだい・20分クイズチャレンジ（js/challenge.js）
// - 記録はあとから種類・教科・時間を直せる（ポイントも合わせて直る）
import { h, toast } from './ui.js';
import { today, toISO, save, currentProfile } from './store.js';
import { subjectNames, subjectColor, editSubjectsLink } from './subjects.js';
import * as bgm from './bgm.js';
import { openPiyo, piyoButton } from './challenge.js';
import { icon } from './icons.js';

export const KINDS = [
  { id: 'homework', label: '宿題', ic: 'notebook-text' },
  { id: 'challenge', label: 'チャレンジ', ic: 'medal' },
  { id: 'self', label: '自主学習', ic: 'book-open' },
  { id: 'testprep', label: 'テスト勉強', ic: 'target' },
];
const PRESETS = [20, 40, 60];
const MAX_MIN = 90;
const BREAK_EVERY = 20;
const BONUS = 10;

const kindOf = (id) => KINDS.find((k) => k.id === id) || KINDS[2];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

function prefs(p) {
  const names = subjectNames(p);
  if (!p.timerPrefs) p.timerPrefs = { kind: 'self', subject: names[0], mode: 'focus', minutes: 25, bgm: true };
  if (!names.includes(p.timerPrefs.subject)) p.timerPrefs.subject = names[0];
  if (!PRESETS.includes(p.timerPrefs.minutes)) p.timerPrefs.minutes = PRESETS.reduce((a, b) => (Math.abs(b - p.timerPrefs.minutes) < Math.abs(a - p.timerPrefs.minutes) ? b : a));
  return p.timerPrefs;
}

export function sessions(p) { if (!p.sessions) p.sessions = []; return p.sessions; }
export function minutesOn(p, iso) { return sessions(p).filter((s) => s.date === iso).reduce((n, s) => n + s.minutes, 0); }

// ---- タイマーのタブ ------------------------------------------------------------

export function renderTimerTab(panel, p, deps) {
  const pf = prefs(p);
  const all = sessions(p);
  const todayMin = minutesOn(p, today());
  const wk = weekDays();
  const weekMin = wk.reduce((n, d) => n + minutesOn(p, d.iso), 0);
  const total = all.reduce((n, s) => n + s.minutes, 0);

  const chip = (on, label, onclick, color) => h('button', { class: `pick ${on ? 'on' : ''}`, onclick, style: color ? `--c:${color}` : null }, label);
  const rerender = () => renderTimerTab(panel, p, deps);
  const set = (k, v) => { pf[k] = v; save(); rerender(); };

  const bgmName = h('span', { class: 'bgm-name' }, '…');
  bgm.listTracks().then((ts) => { bgmName.textContent = (ts.find((t) => t.id === bgm.selectedId()) || ts[0]).name; });

  deps.fill(panel,
    h('div', { class: 'card stat3' },
      h('div', {}, h('small', {}, 'きょう'), h('p', { class: 'n' }, h('b', {}, todayMin), h('span', {}, '分'))),
      h('div', {}, h('small', {}, '今週'), h('p', { class: 'n' }, h('b', {}, weekMin), h('span', {}, '分'))),
      h('div', {}, h('small', {}, 'るいけい'), h('p', { class: 'n' }, h('b', {}, total), h('span', {}, '分')))),

    h('div', { class: 'card setup' },
      h('p', { class: 'label' }, 'なにをする？'),
      h('div', { class: 'picks kinds' }, KINDS.map((k) => chip(pf.kind === k.id, [icon(k.ic), ` ${k.label}`], () => set('kind', k.id)))),
      h('div', { class: 'label-row' }, h('p', { class: 'label' }, p.grade === 'adult' ? 'ジャンル' : 'きょうか'), editSubjectsLink(p, rerender)),
      h('div', { class: 'picks subjects' }, subjectNames(p).map((s) => chip(pf.subject === s, s, () => set('subject', s), subjectColor(p, s)))),
      h('div', { class: 'seg' },
        h('button', { class: pf.mode === 'focus' ? 'on' : '', onclick: () => set('mode', 'focus') }, '集中'),
        h('button', { class: pf.mode === 'free' ? 'on' : '', onclick: () => set('mode', 'free') }, '計るだけ')),
      pf.mode === 'focus' ? h('div', { class: 'picks times' }, PRESETS.map((m) => chip(pf.minutes === m, `${m}分`, () => set('minutes', m)))) : null,
      h('div', { class: 'bgm-row' },
        h('button', { class: `bgm-toggle ${pf.bgm ? 'on' : ''}`, 'aria-label': 'BGM', onclick: () => set('bgm', !pf.bgm) }, icon('music-2')),
        bgmName,
        h('button', { class: 'link', onclick: () => openBgmPicker(rerender) }, 'えらぶ')),
      h('div', { class: 'start-row' },
        h('button', { class: 'btn primary start', onclick: () => startTimer(p, {}, deps) }, icon('play'), ' スタート'),
        piyoButton(p, deps, { subject: pf.subject }))),

    weekChart(p, wk),
    todayList(p, deps, rerender),
  );
}

function weekDays() {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return ['月', '火', '水', '木', '金', '土', '日'].map((label, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return { label, iso: toISO(d), md: `${d.getMonth() + 1}/${d.getDate()}` };
  });
}

function weekChart(p, wk) {
  const per = wk.map((d) => {
    const by = {};
    sessions(p).filter((s) => s.date === d.iso).forEach((s) => { by[s.subject] = (by[s.subject] || 0) + s.minutes; });
    return { ...d, by, sum: Object.values(by).reduce((a, b) => a + b, 0) };
  });
  const max = Math.max(60, ...per.map((d) => d.sum));
  const t = today();
  return h('div', { class: 'card chart' },
    h('p', { class: 'label' }, '今週の勉強時間'),
    h('div', { class: 'bars' }, per.map((d) => h('div', { class: `col ${d.iso === t ? 'today' : ''}` },
      h('small', { class: 'min' }, d.sum ? `${d.sum}` : ''),
      h('div', { class: 'bar' }, Object.entries(d.by).map(([sub, m]) => h('i', { style: `height:${(m / max) * 100}%;background:${subjectColor(p, sub)}` }))),
      h('small', {}, d.label)))),
    h('div', { class: 'legend' }, subjectNames(p).map((s) => h('span', {}, h('i', { style: `background:${subjectColor(p, s)}` }), s))));
}

function todayList(p, deps, rerender) {
  const list = sessions(p).filter((s) => s.date === today());
  if (!list.length) return h('p', { class: 'empty' }, 'きょうの記録は まだないよ');
  return h('div', { class: 'card records' },
    h('p', { class: 'label' }, 'きょうの記録'),
    h('ul', {}, list.slice().reverse().map((s) => recordRow(p, s, deps, rerender))));
}

function recordRow(p, s, deps, rerender) {
  const k = kindOf(s.kind);
  const row = h('li', { class: 'rec' },
    h('i', { class: 'dot', style: `background:${subjectColor(p, s.subject)}` }),
    h('span', { class: 'what' }, icon(k.ic), ` ${k.label}・${s.subject}`),
    h('b', {}, `${s.minutes}分`),
    h('button', { class: 'link', onclick: () => row.replaceWith(editRow(p, s, deps, rerender)) }, 'なおす'));
  return row;
}

function editRow(p, s, deps, rerender) {
  const kind = h('select', {}, KINDS.map((k) => h('option', { value: k.id }, k.label)));
  kind.value = s.kind;
  const subject = h('select', {}, [...new Set([...subjectNames(p), s.subject])].map((x) => h('option', { value: x }, x)));
  subject.value = s.subject;
  const minutes = h('input', { type: 'number', min: 1, max: MAX_MIN, value: s.minutes, inputmode: 'numeric' });
  return h('li', { class: 'rec edit' },
    h('div', { class: 'row' }, kind, subject, h('label', { class: 'min-in' }, minutes, '分')),
    h('div', { class: 'row' },
      h('button', { class: 'btn small primary', onclick: () => {
        const m = Math.max(1, Math.min(MAX_MIN, Math.round(Number(minutes.value) || s.minutes)));
        const delta = m - s.minutes;
        Object.assign(s, { kind: kind.value, subject: subject.value, minutes: m, points: s.points + delta });
        if (delta) deps.addPoints(p, delta, 'タイマーの記録をなおした');
        save();
        rerender();
      } }, 'ほぞん'),
      h('button', { class: 'btn small', onclick: rerender }, 'やめる'),
      deps.deleteButton(() => {
        p.sessions = sessions(p).filter((x) => x.id !== s.id);
        deps.addPoints(p, -s.points, 'タイマーの記録をけした');
        save();
        rerender();
      })));
}

// ---- BGM をえらぶ --------------------------------------------------------------

// live: タイマー中にひらく。曲をえらんでも とまらず、そのまま ながれる
async function openBgmPicker(onClose, live = false) {
  const tracks = await bgm.listTracks();
  const close = () => { if (!live) bgm.stop(); sheet.remove(); onClose?.(); };
  const status = h('p', { class: 'sheet-sub' }, '');
  const fileIn = h('input', { type: 'file', accept: 'audio/*,video/*,.m4a,.mp3,.aac,.wav,.ogg,.mp4,.mov', hidden: true, onchange: async () => {
    const f = fileIn.files[0]; if (!f) return;
    status.textContent = 'とりこみ中…（動画は音だけ取り出すよ）';
    try { const t = await bgm.importFile(f); status.textContent = `「${t.name}」を入れたよ`; close(); openBgmPicker(onClose, live); } catch (e) { status.textContent = 'とりこめなかった…ほかのファイルでためしてね'; }
  } });
  const libIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async () => {
    const f = libIn.files[0]; if (!f) return;
    status.textContent = '読みこみ中…';
    try { const n = await bgm.importLibrary(f); status.textContent = `${n}曲 入れたよ`; close(); openBgmPicker(onClose, live); } catch (e) { status.textContent = '読めなかった…前のタイマーの「書き出し」ファイルを選んでね'; }
  } });
  const again = () => {
    if (live) { if (bgm.isPlaying()) bgm.play().catch(() => {}); } else bgm.stop();
    sheet.remove(); openBgmPicker(onClose, live);
  };
  const list = bgm.playlist();
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const modes = [['one', '1きょく', 'repeat-1'], ['all', 'じゅんばん', 'repeat'], ['shuffle', 'シャッフル', 'shuffle']];
  const listBox = h('div', { class: 'bgm-list' },
    h('p', { class: 'label' }, icon('list-music'), ' プレイリスト（ながく きく・くりかえし）'),
    list.length ? [
      h('label', { class: 'bgm-use' }, h('input', { type: 'checkbox', checked: bgm.useList() || null, onchange: (e) => { bgm.setUseList(e.target.checked); again(); } }), ' リストで ながす'),
      h('div', { class: 'bgm-modes' }, modes.map(([m, label, ic]) => h('button', { type: 'button', class: `bgm-mode ${bgm.mode() === m ? 'on' : ''}`, onclick: () => { bgm.setMode(m); again(); } }, icon(ic), h('span', {}, label)))),
      h('ol', { class: 'bgm-order' }, list.filter((id) => byId.has(id)).map((id, i, a) => h('li', {},
        h('span', { class: 'bgm-n' }, `${i + 1}`), h('span', { class: 'bgm-t' }, byId.get(id).name),
        h('button', { type: 'button', 'aria-label': 'うえへ', disabled: i === 0 || null, onclick: () => { bgm.movePlaylist(id, -1); again(); } }, icon('chevron-up')),
        h('button', { type: 'button', 'aria-label': 'したへ', disabled: i === a.length - 1 || null, onclick: () => { bgm.movePlaylist(id, 1); again(); } }, icon('chevron-down')),
        h('button', { type: 'button', 'aria-label': 'リストから はずす', onclick: () => { bgm.togglePlaylist(id); again(); } }, icon('x')))))]
      : h('p', { class: 'sheet-sub' }, '曲の「＋」を おすと、リストに入るよ'));
  const sel = bgm.selectedId();
  const groups = [['standard', 'いつものBGM'], ['old', '前のタイマーの曲'], ['own', 'とりこんだ曲']];
  const sheet = h('div', { class: 'sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card bgm-card' },
      h('p', { class: 'sheet-title' }, icon('music-2'), ' BGM'),
      listBox,
      groups.map(([from, label]) => {
        const ts = tracks.filter((t) => t.from === from);
        if (!ts.length) return null;
        return h('div', { class: 'bgm-group' }, h('p', { class: 'label' }, label), ts.map((t) => h('div', { class: `bgm-item ${t.id === sel ? 'on' : ''}` },
          h('button', { class: 'play', 'aria-label': 'ためしにきく', onclick: () => { bgm.play(t.id).catch(() => { status.textContent = 'ならせなかった…'; }); } }, icon('play')),
          h('button', { class: 'name', onclick: () => { bgm.setSelected(t.id); if (live) { bgm.setUseList(false); bgm.play(t.id).catch(() => {}); } close(); } }, t.kind === 'video' ? icon('film') : null, ` ${t.name}`),
          h('button', { class: `add ${list.includes(t.id) ? 'on' : ''}`, 'aria-label': list.includes(t.id) ? 'リストから はずす' : 'リストに入れる', onclick: () => { bgm.togglePlaylist(t.id); again(); } }, icon(list.includes(t.id) ? 'list-music' : 'plus')),
          t.id === sel ? h('span', { class: 'check' }, icon('check')) : null,
          t.from === 'own' ? h('button', { class: 'link', onclick: async () => { await bgm.removeTrack(t.id); close(); openBgmPicker(onClose, live); } }, 'けす') : null)));
      }),
      live ? h('button', { class: 'btn small', onclick: () => { bgm.stop(); close(); } }, icon('volume-x'), ' おんがくを とめる') : null,
      h('label', { class: 'vol' }, '音の大きさ', h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: bgm.volume(), oninput: (e) => bgm.setVolume(Number(e.target.value)) })),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => fileIn.click() }, '＋ 曲や動画から入れる'),
        h('button', { class: 'btn small', onclick: () => libIn.click() }, '前のタイマーの書き出し')),
      fileIn, libIn, status,
      h('button', { class: 'btn primary', onclick: close }, 'とじる')));
  document.body.append(sheet);
}

// ---- 計っているところ ----------------------------------------------------------

// opts: { kind, subject, item, stepLabel } 「つぎはこれ」から始めるときに入る
export function startTimer(p, opts, deps) {
  const pf = prefs(p);
  p.timer = {
    start: Date.now(), pausedTotal: 0, pausedAt: null,
    kind: opts.kind || pf.kind, subject: opts.subject || pf.subject,
    mode: pf.mode, planned: pf.mode === 'focus' ? pf.minutes : null,
    itemId: opts.item?.id || null, stepLabel: opts.stepLabel || null, lastBreak: 0,
  };
  save();
  if (pf.bgm) bgm.play().catch(() => {});
  openRunning(p, deps);
}

export function resumeIfRunning(p, deps) {
  if (p?.timer) openRunning(p, deps);
}

const CHEERS = ['ピヨ先生も いっしょに がんばるよ', 'いいしゅうちゅう！', 'こつこつが いちばん つよい', 'あと少し、いいかんじ！', 'のみもの のんでもいいよ'];

function openRunning(p, deps) {
  document.querySelector('.timer-run')?.remove();
  const t = p.timer;
  const k = kindOf(t.kind);
  const elapsedSec = () => Math.max(0, (Date.now() - t.start - t.pausedTotal - (t.pausedAt ? Date.now() - t.pausedAt : 0)) / 1000);

  const R = 92; const C = 2 * Math.PI * R;
  const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  arc.setAttribute('class', 'arc'); arc.setAttribute('cx', 110); arc.setAttribute('cy', 110); arc.setAttribute('r', R);
  arc.setAttribute('stroke-dasharray', C);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 220 220'); svg.setAttribute('class', 'ring');
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('class', 'track'); bg.setAttribute('cx', 110); bg.setAttribute('cy', 110); bg.setAttribute('r', R);
  svg.append(bg, arc);

  const time = h('b', { class: 'time' }, '00:00');
  const sub = h('small', {}, t.mode === 'focus' ? 'のこり' : 'けいか');
  const cheer = h('p', { class: 'cheer' }, CHEERS[0]);
  const ptsBar = h('i', {});
  const ptsText = h('b', {}, '+0pt');
  const pauseBtn = h('button', { class: 'btn' }, icon('pause'), ' 一時停止');
  const doneBtn = h('button', { class: 'btn primary' }, icon('check'), ' 完了');
  const music = h('button', { class: `bgm-toggle ${bgm.isPlaying() ? 'on' : ''}`, 'aria-label': 'BGM' }, icon('music-2'));
  const askBtn = piyoButton(p, deps, { subject: t.subject, fromTimer: true });
  const layer = h('div', { class: 'runner timer-run' },
    h('div', { class: 'runner-card' },
      h('div', { class: 'runner-top' },
        h('span', { class: 'chip', style: `background:${subjectColor(p, t.subject)}` }, t.subject),
        h('span', { class: 'chip soft' }, icon(k.ic), ` ${k.label}`),
        h('span', { class: 'spacer' }),
        askBtn,
        music),
      t.stepLabel ? h('p', { class: 'step-label' }, t.stepLabel) : null,
      h('div', { class: 'clock' }, svg, h('div', { class: 'face' }, time, sub)),
      h('div', { class: 'study-pic' }, h('img', { src: 'assets/icons/icon-192.png', alt: '' }), cheer),
      h('div', { class: 'pts' }, h('span', {}, icon('sprout'), ' かくとくポイント'), ptsText, h('div', { class: 'pts-bar' }, ptsBar)),
      h('div', { class: 'timer-btns' }, pauseBtn, doneBtn),
      h('button', { class: 'link reset' }, 'やめる（記録しない）')));
  document.body.append(layer);

  // 右上の♪：曲やプレイリストをえらびなおせる（えらぶと そのまま ながれる）
  music.addEventListener('click', () => {
    openBgmPicker(() => music.classList.toggle('on', bgm.isPlaying()), true);
  });
  pauseBtn.addEventListener('click', () => {
    if (t.pausedAt) { t.pausedTotal += Date.now() - t.pausedAt; t.pausedAt = null; bgm.resume(); } else { t.pausedAt = Date.now(); bgm.pause(); }
    save(); tick();
  });
  doneBtn.addEventListener('click', () => finish(false));
  let armed = false;
  const reset = layer.querySelector('.reset');
  reset.addEventListener('click', () => {
    if (!armed) { armed = true; reset.textContent = 'ほんとうに やめる？（もう1回おす）'; setTimeout(() => { armed = false; reset.textContent = 'やめる（記録しない）'; }, 3000); return; }
    ended = true; stopAll(); p.timer = null; save(); deps.render();
  });

  let timerId = 0;
  let breakShown = false;
  let ended = false;
  function tick() {
    if (ended) return;
    const sec = elapsedSec();
    const min = Math.floor(sec / 60);
    const plannedSec = t.planned ? t.planned * 60 : 0;
    if (t.mode === 'focus') {
      const left = Math.max(0, plannedSec - sec);
      time.textContent = mmss(left);
      arc.style.strokeDashoffset = String(C * (1 - left / plannedSec));
      if (left <= 0) { chime(); finish(true); return; }
    } else {
      time.textContent = mmss(sec);
      arc.style.strokeDashoffset = String(C * (1 - ((sec % (BREAK_EVERY * 60)) / (BREAK_EVERY * 60))));
    }
    const pts = Math.min(MAX_MIN, min);
    ptsText.textContent = `+${pts}pt`;
    ptsBar.style.width = `${Math.min(100, (sec / ((t.planned || BREAK_EVERY) * 60)) * 100)}%`;
    pauseBtn.replaceChildren(icon(t.pausedAt ? 'play' : 'pause'), t.pausedAt ? ' さいかい' : ' 一時停止');
    layer.classList.toggle('paused', !!t.pausedAt);
    cheer.textContent = t.pausedAt ? 'ひとやすみ中' : CHEERS[Math.floor(sec / 300) % CHEERS.length];
    if (min >= MAX_MIN) { finish(false); return; }
    // 25分ごとに休けいの声かけ（計るだけのとき）
    if (t.mode === 'free' && !t.pausedAt && min >= (t.lastBreak || 0) + BREAK_EVERY && !breakShown) { breakShown = true; askBreak(); }
  }

  function askBreak() {
    chime();
    const card = h('div', { class: 'sheet' }, h('div', { class: 'sheet-card' },
      h('p', { class: 'sheet-title' }, `${BREAK_EVERY}分 がんばったね！`),
      h('p', { class: 'sheet-sub' }, '5分 ひとやすみする？'),
      h('button', { class: 'btn primary', onclick: () => { t.lastBreak = Math.floor(elapsedSec() / 60); t.pausedAt = Date.now(); bgm.pause(); save(); card.remove(); breakShown = false; tick(); } }, 'ひとやすみ'),
      h('button', { class: 'btn', onclick: () => { t.lastBreak = Math.floor(elapsedSec() / 60); save(); card.remove(); breakShown = false; } }, 'まだやる'),
      h('button', { class: 'link', onclick: () => { card.remove(); finish(false); } }, 'ここで おわる')));
    document.body.append(card);
  }

  function stopAll() { clearInterval(timerId); document.removeEventListener('visibilitychange', tick); bgm.stop(); layer.remove(); }

  function finish(completed) {
    if (ended) return;
    ended = true;
    const sec = elapsedSec();
    // 集中モードは 決めた時間まで（アプリを閉じて あとで開いても、それ以上は記録しない）
    const cap = t.mode === 'focus' && t.planned ? Math.min(MAX_MIN, t.planned) : MAX_MIN;
    const minutes = Math.min(cap, Math.floor(sec / 60));
    stopAll();
    p.timer = null;
    if (minutes < 1) { save(); toast('1分より短いので 記録しなかったよ'); deps.render(); return; }
    const bonus = completed && t.mode === 'focus' ? BONUS : 0;
    const s = { id: uid(), date: toISO(new Date(t.start)), start: t.start, minutes, kind: t.kind, subject: t.subject, points: minutes + bonus };
    sessions(p).push(s);
    deps.gain(p, s.points, `タイマー ${minutes}分（${t.subject}）`);
    save();
    showDone(p, s, t, bonus, deps);
  }

  timerId = setInterval(tick, 500);
  tick();
  document.addEventListener('visibilitychange', tick);
}

function showDone(p, s, t, bonus, deps) {
  const item = t.itemId ? p.items.find((i) => i.id === t.itemId) : null;
  const close = () => { card.remove(); deps.render(); };
  const card = h('div', { class: 'sheet' }, h('div', { class: 'sheet-card done-card' },
    h('p', { class: 'big-num' }, `${s.minutes}`, h('small', {}, '分')),
    h('p', { class: 'sheet-title' }, bonus ? 'さいごまで やりきった！' : 'おつかれさま！'),
    h('p', { class: 'reward' }, icon('sprout'), ` +${s.points}${bonus ? `（やりきり +${bonus}）` : ''}`),
    item && t.stepLabel ? h('p', { class: 'sheet-sub' }, `「${t.stepLabel}」は できた？`) : null,
    item && t.stepLabel ? h('button', { class: 'btn primary', onclick: () => { card.remove(); deps.completeStepFor(item, t.stepLabel); } }, 'できた！ ', icon('sprout'), '+10') : null,
    h('button', { class: `btn ${item && t.stepLabel ? '' : 'primary'}`, onclick: close }, item && t.stepLabel ? 'まだ（つづきは あとで）' : 'もどる')));
  document.body.append(card);
}

// 時間になったら「ポーン」
function chime() {
  try { navigator.vibrate?.([200, 100, 200]); } catch (e) { /* 無視 */ }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.25);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.25 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.25 + 0.9);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.25); o.stop(ctx.currentTime + i * 0.25 + 1);
    });
    setTimeout(() => ctx.close(), 1600);
  } catch (e) { /* 無視 */ }
}

export function kindForItem(item) {
  return item.type === 'test' ? 'testprep' : item.type === 'homework' ? 'homework' : 'challenge';
}
