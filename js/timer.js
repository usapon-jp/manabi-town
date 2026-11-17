// 勉強タイマー。たまの勉強タイマーの作りを持ってきた。
// - 種類（宿題・チャレンジ・自主学習・テスト勉強）と教科を選んで、集中（時間をきめる）か計るだけ
// - 1分 = 1ポイント。集中を最後までやりきると +10
// - 時計は「始めた時刻」から数えるので、画面を消しても正しく進む
// - アプリが落ちても、開きなおすと つづきから（始めた時刻を べつの場所にも とっておく）
// - 20分ごとに休けいの声かけ（時間は 20・40・60分）。1回は最大90分
// - ひよこマーク: しつもん・れんしゅう もんだい・20分クイズチャレンジ（js/challenge.js）
// - 記録はあとから種類・教科・時間を直せる（ポイントも合わせて直る）
// - タイマーを うっかり 消したときは「あとから たす」で きょう・きのうの 分を 入れられる（1日 90分まで。2026-11-17）
// - 「やめる」は 確かめの 画面を 出す。いちばん 目立つのは「◯分 記録して おわる」（けすのは 小さく）
import { h, toast } from './ui.js';
import { today, toISO, save, currentProfile } from './store.js';
import { subjectNames, subjectColor, editSubjectsLink } from './subjects.js';
import * as bgm from './bgm.js';
import { openPiyo, piyoButton } from './challenge.js';
import { studyButton } from './study.js';
import { icon } from './icons.js';

export const KINDS = [
  { id: 'homework', label: '宿題', ic: 'notebook-text' },
  { id: 'challenge', label: 'チャレンジ', ic: 'medal' },
  { id: 'self', label: '自主学習', ic: 'book-open' },
  { id: 'testprep', label: 'テスト勉強', ic: 'target' },
];
// おとなは 今ある しくみ（ルーティーン・TODO・資格）で わける
export const ADULT_KINDS = [
  { id: 'routine', label: 'ルーティーン', ic: 'repeat' },
  { id: 'todo', label: 'TODO', ic: 'list-checks' },
  { id: 'study', label: '資格・勉強', ic: 'book-open' },
  { id: 'free', label: 'じゆう', ic: 'sparkles' },
];
const isAdultP = (p) => p?.grade === 'adult';
const kindsFor = (p) => (isAdultP(p) ? ADULT_KINDS : KINDS);
const PRESETS = [20, 40, 60];
const MAX_MIN = 90;
const BREAK_EVERY = 20;
const BONUS = 10;

const kindOf = (id) => KINDS.find((k) => k.id === id) || ADULT_KINDS.find((k) => k.id === id) || KINDS[2];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

function prefs(p) {
  const names = subjectNames(p);
  if (!p.timerPrefs) p.timerPrefs = { kind: 'self', subject: names[0], mode: 'focus', minutes: 25, bgm: true };
  if (!names.includes(p.timerPrefs.subject)) p.timerPrefs.subject = names[0];
  if (!kindsFor(p).some((k) => k.id === p.timerPrefs.kind)) p.timerPrefs.kind = isAdultP(p) ? 'free' : 'self';
  if (!PRESETS.includes(p.timerPrefs.minutes)) p.timerPrefs.minutes = PRESETS.reduce((a, b) => (Math.abs(b - p.timerPrefs.minutes) < Math.abs(a - p.timerPrefs.minutes) ? b : a));
  return p.timerPrefs;
}

// 動いているタイマーの写し（人ごと）。iPhone などで アプリが急に消えると、
// さいごの保存が とぶことがあるので、小さく べつに とっておいて 何回も書く
const RUN_KEY = 'manabi-timer-run';
const RUN_MAX_MS = 12 * 3600 * 1000; // 12時間より前のものは もどさない
function readRuns() { try { return JSON.parse(localStorage.getItem(RUN_KEY) || '{}') || {}; } catch (e) { return {}; } }
function keepRun(p) {
  try {
    const runs = readRuns();
    if (p.timer) runs[p.id] = p.timer; else delete runs[p.id];
    if (Object.keys(runs).length) localStorage.setItem(RUN_KEY, JSON.stringify(runs)); else localStorage.removeItem(RUN_KEY);
  } catch (e) { /* 書けないときは 本体の保存だけ */ }
}
// 開いたときに よぶ。本体から タイマーが消えていたら、写しから もどす（もう記録ずみなら もどさない）
export function restoreTimers(profiles) {
  const runs = readRuns();
  let changed = false;
  (profiles || []).forEach((p) => {
    const t = runs[p.id];
    if (p.timer) { if (!t || t.start !== p.timer.start) keepRun(p); return; }
    if (!t || typeof t.start !== 'number') return;
    const done = sessions(p).some((s) => s.start === t.start);
    if (done || Date.now() - t.start > RUN_MAX_MS) { keepRun(p); return; }
    p.timer = t;
    changed = true;
  });
  if (changed) save();
  return changed;
}

// 同期で そろったあとに よぶ。クラウドの中身が正しいので、写しも それに合わせる
// （ほかの端末で「やめる」したタイマーを、あとで写しから もどさないように）
export function matchRuns(profiles) { (profiles || []).forEach(keepRun); }

export function sessions(p) { if (!p.sessions) p.sessions = []; return p.sessions; }

// ---- あとから たす（タイマーを うっかり 消したとき） --------------------------------
// - えらべる 日は きょう と きのう だけ。1回 90分まで、あとから たすのは 1日 90分まで（タイマー1回ぶん）
// - 1分 = 1ポイント（やりきりの +10 は なし）。記録・グラフ・「30分」「今週120分」の お題・たまごには タイマーと 同じに 数える
// - 記録に manual: true を つけて「あとから」と 出す（おうちの人が 見て わかるように）
// - 🔥の 勉強した日は えらんだ 日に つける（きのうの 分なら きのう。2026-11-17 自動レビューの 指摘）
export const MANUAL_DAY_MAX = 90;
const dayIso = (now, back = 0) => { const d = new Date(now); return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back)); };
export const manualOn = (p, iso) => sessions(p).filter((s) => s.manual && s.date === iso).reduce((n, s) => n + s.minutes, 0);
// その日に あと 何分 たせるか（1回の 上限 90分も ふくめて）
export function manualRoom(p, iso, now = Date.now()) {
  if (iso !== dayIso(now) && iso !== dayIso(now, 1)) return 0;
  return Math.max(0, Math.min(MAX_MIN, MANUAL_DAY_MAX - manualOn(p, iso)));
}
// 記録を 1つ ふやして かえす（ポイントは よぶ がわで）。たせないときは null
export function addManual(p, { date, minutes, kind, subject }, now = Date.now()) {
  const room = manualRoom(p, date, now);
  const m = Math.min(room, Math.round(Number(minutes) || 0));
  if (m < 1 || !subject) return null;
  // おわりの 時刻: きょうは いま、きのうは 夜の 8時（たまごの 数え方で つかう）
  const [y, mo, d] = date.split('-').map(Number);
  const end = date === dayIso(now) ? now : new Date(y, mo - 1, d, 20).getTime();
  const s = { id: uid(), date, start: end - m * 60000, minutes: m, kind: kind || 'self', subject, points: m, manual: true };
  sessions(p).push(s);
  // 勉強した日（🔥 れんぞく日数）は えらんだ 日に つける（きのうの 分で きょうを つけない）
  p.activeDays = { ...(p.activeDays || {}), [date]: true };
  return s;
}
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
  bgm.listTracks().then((ts) => { bgmName.textContent = bgm.summary(ts); });

  deps.fill(panel,
    h('div', { class: 'card stat3' },
      h('div', {}, h('small', {}, 'きょう'), h('p', { class: 'n' }, h('b', {}, todayMin), h('span', {}, '分'))),
      h('div', {}, h('small', {}, '今週'), h('p', { class: 'n' }, h('b', {}, weekMin), h('span', {}, '分'))),
      h('div', {}, h('small', {}, 'るいけい'), h('p', { class: 'n' }, h('b', {}, total), h('span', {}, '分')))),

    h('div', { class: 'card setup' },
      h('p', { class: 'label' }, 'なにをする？'),
      h('div', { class: 'picks kinds' }, kindsFor(p).map((k) => chip(pf.kind === k.id, [icon(k.ic), ` ${k.label}`], () => set('kind', k.id)))),
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
        piyoButton(p, deps, { subject: pf.subject })),
      // タイマーを セットしたら つぎは「何を やろう？」→ ここから すぐ（2026-11-15）
      studyButton(p, deps, { small: true })),

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
  const t = today();
  const yday = dayIso(Date.now(), 1);
  // きょうの 記録と、きのう あとから たした 記録（まちがえたら なおせるように）
  const list = sessions(p).filter((s) => s.date === t || (s.manual && s.date === yday));
  return h('div', { class: 'card records' },
    h('div', { class: 'label-row' },
      h('p', { class: 'label' }, 'きょうの記録'),
      h('button', { class: 'link add-time', onclick: () => openAddTime(p, deps, deps.render) }, icon('plus'), ' あとから たす')),
    list.length
      ? h('ul', {}, list.slice().sort((a, b) => (b.start || 0) - (a.start || 0)).map((s) => recordRow(p, s, deps, rerender)))
      : h('p', { class: 'empty' }, 'きょうの記録は まだないよ'));
}

function recordRow(p, s, deps, rerender) {
  const k = kindOf(s.kind);
  const row = h('li', { class: 'rec' },
    h('i', { class: 'dot', style: `background:${subjectColor(p, s.subject)}` }),
    h('span', { class: 'what' }, icon(k.ic), ` ${k.label}・${s.subject}`,
      s.manual ? h('small', { class: 'rec-tag' }, s.date === today() ? 'あとから' : 'きのう・あとから') : null),
    h('b', {}, `${s.minutes}分`),
    h('button', { class: 'link', onclick: () => row.replaceWith(editRow(p, s, deps, rerender)) }, 'なおす'));
  return row;
}

function editRow(p, s, deps, rerender) {
  const kind = h('select', {}, [...kindsFor(p), ...(kindsFor(p).some((k) => k.id === s.kind) ? [] : [kindOf(s.kind)])].map((k) => h('option', { value: k.id }, k.label)));
  kind.value = s.kind;
  const subject = h('select', {}, [...new Set([...subjectNames(p), s.subject])].map((x) => h('option', { value: x }, x)));
  subject.value = s.subject;
  // あとから たした 記録は、なおしても 1日 90分の わくを こえない
  const max = s.manual ? Math.max(1, Math.min(MAX_MIN, s.minutes + MANUAL_DAY_MAX - manualOn(p, s.date))) : MAX_MIN;
  const minutes = h('input', { type: 'number', min: 1, max, value: s.minutes, inputmode: 'numeric' });
  return h('li', { class: 'rec edit' },
    h('div', { class: 'row' }, kind, subject, h('label', { class: 'min-in' }, minutes, '分')),
    h('div', { class: 'row' },
      h('button', { class: 'btn small primary', onclick: () => {
        const m = Math.max(1, Math.min(max, Math.round(Number(minutes.value) || s.minutes)));
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

// ---- あとから たす シート ----------------------------------------------------------

const QUICK_MIN = [10, 20, 30, 60];
export function openAddTime(p, deps, onDone) {
  document.querySelector('.sheet.add-time-sheet')?.remove();
  const pf = prefs(p);
  const now = Date.now();
  const days = [['きょう', dayIso(now)], ['きのう', dayIso(now, 1)]];
  const st = { date: days[0][1], kind: pf.kind, subject: pf.subject, minutes: 20 };
  const close = () => sheet.remove();
  const card = h('div', { class: 'sheet-card add-time-card' });
  const sheet = h('div', { class: 'sheet add-time-sheet', onclick: (e) => { if (e.target === sheet) close(); } }, card);
  const chip = (on, label, onclick, color) => h('button', { type: 'button', class: `pick ${on ? 'on' : ''}`, onclick, style: color ? `--c:${color}` : null }, label);
  const set = (k, v) => { st[k] = v; paint(); };

  function paint() {
    const room = manualRoom(p, st.date);
    st.minutes = Math.max(room ? 1 : 0, Math.min(room, st.minutes));
    const step = (d) => set('minutes', Math.max(1, Math.min(room, (d > 0 ? Math.floor(st.minutes / 5) * 5 : Math.ceil(st.minutes / 5) * 5) + d)));
    card.replaceChildren(...[
      h('p', { class: 'sheet-title' }, icon('clock-3'), ' 勉強した 時間を たす'),
      h('p', { class: 'sheet-sub' }, 'タイマーが きえちゃった ときに'),
      h('div', { class: 'seg' }, days.map(([label, iso]) => h('button', { type: 'button', class: st.date === iso ? 'on' : '', onclick: () => set('date', iso) }, label))),
      h('div', { class: 'picks kinds' }, kindsFor(p).map((k) => chip(st.kind === k.id, [icon(k.ic), ` ${k.label}`], () => set('kind', k.id)))),
      h('div', { class: 'picks subjects' }, subjectNames(p).map((x) => chip(st.subject === x, x, () => set('subject', x), subjectColor(p, x)))),
      room ? [
        h('div', { class: 'min-step' },
          h('button', { type: 'button', class: 'round', 'aria-label': '5分 へらす', disabled: st.minutes <= 1 || null, onclick: () => step(-5) }, icon('minus')),
          h('p', { class: 'big-num' }, `${st.minutes}`, h('small', {}, '分')),
          h('button', { type: 'button', class: 'round', 'aria-label': '5分 ふやす', disabled: st.minutes >= room || null, onclick: () => step(5) }, icon('plus'))),
        h('div', { class: 'picks times' }, QUICK_MIN.filter((m) => m <= room).map((m) => chip(st.minutes === m, `${m}分`, () => set('minutes', m)))),
        h('button', { type: 'button', class: 'btn primary', onclick: () => {
          const s = addManual(p, st);
          if (!s) return;
          if (st.kind !== pf.kind || st.subject !== pf.subject) Object.assign(pf, { kind: st.kind, subject: st.subject });
          const when = s.date === dayIso(Date.now()) ? '' : 'きのう ';
          deps.gain(p, s.points, `あとから たした ${when}${s.minutes}分（${s.subject}）`, { study: false });
          save();
          close();
          onDone?.();
        } }, icon('plus'), ` たす `, icon('sprout'), `+${st.minutes}`),
        h('small', { class: 'add-time-note' }, `あとから たせるのは 1日 ${MANUAL_DAY_MAX}分まで`),
      ] : h('p', { class: 'empty' }, `${days.find(([, iso]) => iso === st.date)[0]}の ぶんは もう たせないよ（1日 ${MANUAL_DAY_MAX}分まで）`),
      h('button', { type: 'button', class: 'link', onclick: close }, 'やめる')].flat().filter(Boolean));
  }
  paint();
  document.body.append(sheet);
}

// ---- BGM をえらぶ --------------------------------------------------------------

// プレイリストの 名前入力（null | 'new' | 'rename'）と、けす ボタンの 2回おし確認
let bgmListEdit = null;
let bgmListDel = null;

// live: タイマー中にひらく。曲をえらんでも とまらず、そのまま ながれる
async function openBgmPicker(onClose, live = false) {
  const tracks = await bgm.listTracks();
  const close = () => { bgmListEdit = null; bgmListDel = null; if (!live) bgm.stop(); sheet.remove(); onClose?.(); };
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
  const reopen = () => { sheet.remove(); openBgmPicker(onClose, live); };
  const list = bgm.playlist();
  const style = bgm.playStyle();
  const sel = bgm.selectedId();
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const inList = list.filter((id) => byId.has(id));

  // ① ながしかた（大きな3つのボタン）
  const styles = [
    ['one', '1きょくだけ', 'repeat-1', '1曲を くりかえす'],
    ['all', 'じゅんばん', 'repeat', 'じゅんに ながす'],
    ['shuffle', 'シャッフル', 'shuffle', 'ランダムに'],
  ];
  const pickStyle = (m) => {
    bgm.setPlayStyle(m, tracks.map((t) => t.id));
    if (live && bgm.isPlaying()) bgm.play().catch(() => {});
    reopen();
  };
  const styleBox = h('div', { class: 'bgm-step' },
    h('p', { class: 'bgm-step-title' }, h('span', { class: 'bgm-num' }, '1'), ' ながしかたを えらぶ'),
    h('div', { class: 'bgm-modes' }, styles.map(([m, label, ic, sub]) => h('button', { type: 'button', class: `bgm-mode ${style === m ? 'on' : ''}`, 'aria-pressed': style === m ? 'true' : 'false', onclick: () => pickStyle(m) },
      icon(ic), h('b', {}, label), h('small', {}, sub)))));

  // ② 曲をえらぶ
  // ② プレイリストを えらぶ（じゅんばん・シャッフルの とき）。名前を つけて いくつでも 作れる
  const listName = bgm.activeListName();
  const editBox = () => {
    const isNew = bgmListEdit === 'new';
    const input = h('input', { type: 'text', class: 'bgm-name-in', maxlength: 16, placeholder: 'なまえ（れい：しゅうちゅう）', value: isNew ? '' : listName });
    const done = () => {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      if (isNew) bgm.createList(name); else bgm.renameList(bgm.activeListId(), name);
      bgmListEdit = null; reopen();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
    setTimeout(() => input.focus(), 50);
    return h('div', { class: 'bgm-edit' },
      h('p', { class: 'label' }, isNew ? 'あたらしい プレイリストの なまえ' : 'プレイリストの なまえを かえる'),
      input,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn small', onclick: () => { bgmListEdit = null; reopen(); } }, 'やめる'),
        h('button', { type: 'button', class: 'btn small primary', onclick: done }, isNew ? 'つくる' : 'かえる')));
  };
  const pls = bgm.playlists();
  const curList = bgm.activeListId();
  const pickList = (id) => {
    bgm.selectList(id);
    if (live && bgm.isPlaying()) bgm.play().catch(() => {});
    reopen();
  };
  const listStep = style === 'one' ? null : h('div', { class: 'bgm-step' },
    h('p', { class: 'bgm-step-title' }, h('span', { class: 'bgm-num' }, '2'), ' プレイリストを えらぶ'),
    h('div', { class: 'bgm-lists' },
      pls.map((l) => h('button', { type: 'button', class: `bgm-pl ${l.id === curList ? 'on' : ''}`, 'aria-pressed': l.id === curList ? 'true' : 'false', onclick: () => pickList(l.id) },
        icon('list-music'), h('b', {}, l.name), h('small', {}, `${l.count}きょく`))),
      bgm.canAddList() ? h('button', { type: 'button', class: 'bgm-pl add', onclick: () => { bgmListEdit = 'new'; reopen(); } }, icon('plus'), h('b', {}, 'つくる')) : null),
    bgmListEdit ? editBox() : h('div', { class: 'bgm-pl-tools' },
      h('button', { type: 'button', class: 'link', onclick: () => { bgmListEdit = 'rename'; reopen(); } }, icon('pencil'), ' なまえを かえる'),
      pls.length > 1 ? h('button', { type: 'button', class: 'link danger', onclick: () => {
        if (bgmListDel !== curList) { bgmListDel = curList; status.textContent = `もう一回 おすと「${listName}」を けすよ`; return; }
        bgmListDel = null; bgm.deleteList(curList);
        if (live && bgm.isPlaying()) bgm.play().catch(() => {});
        reopen();
      } }, icon('x'), ' このリストを けす') : null));

  // ③ 曲を えらぶ
  const hint = style === 'one'
    ? 'ながしたい曲を 1つ タップしてね'
    : `「${listName}」に 入れる曲に ✓ をつけてね（いま ${inList.length}きょく）`;
  const warn = style === 'one' ? null
    : !inList.length ? h('p', { class: 'bgm-warn' }, 'まだ 曲が 入っていないよ。✓ をつけてね')
      : style === 'shuffle' && inList.length < 2 ? h('p', { class: 'bgm-warn' }, '2きょく いじょう ✓ をつけると、まざって ながれるよ') : null;
  const tapSong = (t) => {
    if (style === 'one') {
      bgm.setSelected(t.id);
      if (live) bgm.play(t.id).catch(() => {});
      reopen();
      return;
    }
    bgm.togglePlaylist(t.id);
    // 0〜1曲の あいだを 行き来すると、ながす曲や くりかえし方が かわるので かけなおす
    const after = bgm.playlist().filter((id) => byId.has(id)).length;
    if (live && bgm.isPlaying() && (inList.length < 2 || after < 2)) bgm.play().catch(() => {});
    reopen();
  };
  const groups = [['standard', 'いつものBGM'], ['old', '前のタイマーの曲'], ['own', 'とりこんだ曲']];
  const songRows = groups.map(([from, label]) => {
    const ts = tracks.filter((t) => t.from === from);
    if (!ts.length) return null;
    return h('div', { class: 'bgm-group' }, h('p', { class: 'label' }, label), ts.map((t) => {
      const on = style === 'one' ? t.id === sel : list.includes(t.id);
      return h('div', { class: `bgm-item ${on ? 'on' : ''}` },
        h('button', { class: 'play', 'aria-label': 'ためしに きく', onclick: () => { bgm.play(t.id).catch(() => { status.textContent = 'ならせなかった…'; }); } }, icon('play')),
        h('button', { class: 'name', 'aria-pressed': on ? 'true' : 'false', onclick: () => tapSong(t) },
          h('span', { class: `bgm-mark ${style === 'one' ? 'radio' : 'box'} ${on ? 'on' : ''}` }, on ? icon('check') : null),
          t.kind === 'video' ? icon('film') : null, ` ${t.name}`),
        t.from === 'own' ? h('button', { class: 'link', onclick: async () => { await bgm.removeTrack(t.id); reopen(); } }, 'けす') : null);
    }));
  });
  // じゅんばんの ときだけ、ながれる じゅんを 入れかえられる
  const order = style === 'all' && inList.length > 1 ? h('div', { class: 'bgm-list' },
    h('p', { class: 'label' }, icon('list-music'), ' ながれる じゅんばん'),
    h('ol', { class: 'bgm-order' }, inList.map((id, i, a) => h('li', {},
      h('span', { class: 'bgm-n' }, `${i + 1}`), h('span', { class: 'bgm-t' }, byId.get(id).name),
      h('button', { type: 'button', 'aria-label': 'うえへ', disabled: i === 0 || null, onclick: () => { bgm.movePlaylist(id, -1); reopen(); } }, icon('chevron-up')),
      h('button', { type: 'button', 'aria-label': 'したへ', disabled: i === a.length - 1 || null, onclick: () => { bgm.movePlaylist(id, 1); reopen(); } }, icon('chevron-down')))))) : null;
  const songBox = h('div', { class: 'bgm-step' },
    h('p', { class: 'bgm-step-title' }, h('span', { class: 'bgm-num' }, style === 'one' ? '2' : '3'), ' 曲を えらぶ'),
    h('p', { class: 'sheet-sub bgm-hint' }, hint), warn, songRows, order);

  const sheet = h('div', { class: live ? 'sheet bgm-live' : 'sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card bgm-card' },
      h('p', { class: 'sheet-title' }, icon('music-2'), ' おんがく（BGM）'),
      styleBox,
      listStep,
      songBox,
      status,
      live ? h('button', { class: 'btn small', onclick: () => { bgm.stop(); close(); } }, icon('volume-x'), ' おんがくを とめる') : null,
      h('label', { class: 'vol' }, '音の大きさ', h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: bgm.volume(), oninput: (e) => bgm.setVolume(Number(e.target.value)) })),
      h('details', { class: 'bgm-more' }, h('summary', {}, '曲を ふやす（おうちの人と）'),
        h('div', { class: 'row' },
          h('button', { class: 'btn small', onclick: () => fileIn.click() }, '＋ 曲や動画から入れる'),
          h('button', { class: 'btn small', onclick: () => libIn.click() }, '前のタイマーの書き出し'))),
      fileIn, libIn,
      h('button', { class: 'btn primary', onclick: close }, 'とじる')));
  document.body.append(sheet);
}

// ---- 計っているところ ----------------------------------------------------------

// やること名から 教科をあてる（「英単語」→英語 など）。わからなければ null
const SUBJECT_HINTS = [['漢字', '国語'], ['音読', '国語'], ['作文', '国語'], ['単語', '英語'], ['英', '英語'], ['計算', '算数'], ['ドリル', '算数'], ['方程式', '数学'], ['図形', '算数']];
export function guessSubject(p, text) {
  const names = subjectNames(p);
  const hit = names.find((n) => text.includes(n));
  if (hit) return hit;
  for (const [k, sub] of SUBJECT_HINTS) {
    if (!text.includes(k)) continue;
    const alt = names.find((n) => (sub === '算数' || sub === '数学' ? /算数|数学/.test(n) : n.includes(sub)));
    if (alt) return alt;
  }
  return null;
}

// opts: { kind, subject, item, stepLabel, mineId, routineId } 「つぎはこれ」から始めるときに入る
// 教科がわからない やること(TODO・ルーティーン)は、名前から教科をあてる
export function startTimer(p, opts, deps) {
  const pf = prefs(p);
  if (!opts.subject && opts.stepLabel) opts = { ...opts, subject: guessSubject(p, opts.stepLabel) };
  p.timer = {
    start: Date.now(), pausedTotal: 0, pausedAt: null,
    kind: (isAdultP(p) && (opts.routineId ? 'routine' : opts.mineId ? 'todo' : opts.item ? 'study' : null)) || opts.kind || pf.kind, subject: opts.subject || pf.subject,
    mode: pf.mode, planned: pf.mode === 'focus' ? pf.minutes : null,
    itemId: opts.item?.id || null, stepLabel: opts.stepLabel || null, mineId: opts.mineId || null, routineId: opts.routineId || null, lastBreak: 0,
  };
  save();
  keepRun(p);
  if (pf.bgm) bgm.play().catch(() => {});
  openRunning(p, deps);
}

export function resumeIfRunning(p, deps) {
  if (!p) return;
  restoreTimers([p]);
  if (p.timer && !document.querySelector('.timer-run')) openRunning(p, deps);
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
      studyButton(p, deps, { fromTimer: true, small: true }),
      h('div', { class: 'pts' }, h('span', {}, icon('sprout'), ' かくとくポイント'), ptsText, h('div', { class: 'pts-bar' }, ptsBar)),
      h('div', { class: 'timer-btns' }, pauseBtn, doneBtn),
      h('button', { class: 'link reset' }, 'とちゅうで やめる')));
  document.body.append(layer);

  // 右上の♪：曲やプレイリストをえらびなおせる（えらぶと そのまま ながれる）
  music.addEventListener('click', () => {
    openBgmPicker(() => music.classList.toggle('on', bgm.isPlaying()), true);
  });
  pauseBtn.addEventListener('click', () => {
    if (t.pausedAt) { t.pausedTotal += Date.now() - t.pausedAt; t.pausedAt = null; bgm.resume(); } else { t.pausedAt = Date.now(); bgm.pause(); }
    save(); keepRun(p); tick();
  });
  doneBtn.addEventListener('click', () => finish(false));
  // やめる: すぐ けさずに 確かめる。いちばん 大きいのは「記録して おわる」（うっかり 消さないように。2026-11-17）
  layer.querySelector('.reset').addEventListener('click', askStop);
  function askStop() {
    document.querySelector('.timer-stop')?.remove();
    const cap = t.mode === 'focus' && t.planned ? Math.min(MAX_MIN, t.planned) : MAX_MIN;
    const min = Math.min(cap, Math.floor(elapsedSec() / 60));
    const off = () => card.remove();
    const card = h('div', { class: 'sheet timer-stop', onclick: (e) => { if (e.target === card) off(); } }, h('div', { class: 'sheet-card' },
      h('p', { class: 'sheet-title' }, 'タイマーを とめる？'),
      h('p', { class: 'sheet-sub' }, min >= 1 ? `いま ${min}分 がんばったよ` : 'まだ 1分に なっていないよ'),
      min >= 1 ? h('button', { class: 'btn primary', onclick: () => { off(); finish(false); } }, icon('check'), ` ${min}分 記録して おわる`) : null,
      h('button', { class: 'btn', onclick: off }, icon('play'), ' つづける'),
      h('button', { class: 'link danger', onclick: () => {
        off(); ended = true; stopAll(); p.timer = null; save(); keepRun(p); deps.render();
        toast(min >= 1 ? '記録しないで やめたよ（「あとから たす」で 入れられるよ）' : 'やめたよ', 3200);
      } }, '記録しないで けす')));
    document.body.append(card);
  }

  let timerId = 0;
  let breakShown = false;
  let ended = false;
  let keptAt = 0;
  function tick() {
    if (ended) return;
    // ほかの端末で おわらせて そろったときは、こちらも とじる
    if (!p.timer) { ended = true; stopAll(); keepRun(p); deps.render(); return; }
    // 15秒ごとに 写しを書きなおす（急に消えても のこるように）
    if (Date.now() - keptAt > 15000) { keptAt = Date.now(); keepRun(p); }
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
      h('button', { class: 'btn primary', onclick: () => { t.lastBreak = Math.floor(elapsedSec() / 60); t.pausedAt = Date.now(); bgm.pause(); save(); keepRun(p); card.remove(); breakShown = false; tick(); } }, 'ひとやすみ'),
      h('button', { class: 'btn', onclick: () => { t.lastBreak = Math.floor(elapsedSec() / 60); save(); keepRun(p); card.remove(); breakShown = false; } }, 'まだやる'),
      h('button', { class: 'link', onclick: () => { card.remove(); finish(false); } }, 'ここで おわる')));
    document.body.append(card);
  }

  // うらに回る・とじるときにも 写しを書く
  const keepNow = () => { if (!ended) keepRun(p); };
  function stopAll() { document.querySelector('.timer-stop')?.remove(); clearInterval(timerId); document.removeEventListener('visibilitychange', tick); window.removeEventListener('pagehide', keepNow); bgm.stop(); document.querySelectorAll('.bgm-live').forEach((el) => el.remove()); layer.remove(); }

  function finish(completed) {
    if (ended) return;
    ended = true;
    const sec = elapsedSec();
    // 集中モードは 決めた時間まで（アプリを閉じて あとで開いても、それ以上は記録しない）
    const cap = t.mode === 'focus' && t.planned ? Math.min(MAX_MIN, t.planned) : MAX_MIN;
    const minutes = Math.min(cap, Math.floor(sec / 60));
    stopAll();
    p.timer = null;
    keepRun(p);
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
  window.addEventListener('pagehide', keepNow);
}

function showDone(p, s, t, bonus, deps) {
  const item = t.itemId ? p.items.find((i) => i.id === t.itemId) : null;
  const close = () => { card.remove(); deps.render(); };
  const own = !!(t.stepLabel && (t.mineId || t.routineId) && deps.completeOwn);
  const ask = own || !!(item && t.stepLabel);
  const card = h('div', { class: 'sheet' }, h('div', { class: 'sheet-card done-card' },
    h('p', { class: 'big-num' }, `${s.minutes}`, h('small', {}, '分')),
    h('p', { class: 'sheet-title' }, bonus ? 'さいごまで やりきった！' : 'おつかれさま！'),
    h('p', { class: 'reward' }, icon('sprout'), ` +${s.points}${bonus ? `（やりきり +${bonus}）` : ''}`),
    ask ? h('p', { class: 'sheet-sub' }, `「${t.stepLabel}」は できた？`) : null,
    item && t.stepLabel ? h('button', { class: 'btn primary', onclick: () => { card.remove(); deps.completeStepFor(item, t.stepLabel); } }, 'できた！ ', icon('sprout'), '+10') : null,
    own ? h('button', { class: 'btn primary', onclick: () => { card.remove(); deps.completeOwn(t); } }, 'できた！ ', icon('sprout')) : null,
    h('button', { class: `btn ${ask ? '' : 'primary'}`, onclick: close }, ask ? 'まだ（つづきは あとで）' : 'もどる')));
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
