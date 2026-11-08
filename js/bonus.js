// ボーナス（原神のデイリー・イベントのような、えらべる追加のクエスト）。
// 上のギフトのボタンからひらく。
// - 見るだけ: 「きょうのおすすめ」「すすみ表」をひらくと少しポイント（1日1回ずつ）
// - ドリル: 漢字・英単語・計算を5もんずつ（1日1回ずつポイント。そのあとは練習）
// - きょうのチャレンジ: タイマー30分
// - 今週のイベント: スタンプ5日・120分・クエスト5回。できたら「うけとる」
import { h, toast, daysLabel } from './ui.js';
import { today, toISO, daysUntil, save, gradeBucket } from './store.js';
import { DRILLS as ALL_DRILLS, buildDrill } from './quests.js';
import { isAdult } from './adult.js';
// おとなには 子ども用のドリルを出さない
const drillsFor = (p) => (isAdult(p) ? [] : ALL_DRILLS);
import { runQuestions } from './runner.js';
import { buildSteps } from './planner.js';
import { levelOf, streak, week } from './progress.js';
import { minutesOn, sessions } from './timer.js';
import { subjectColor } from './subjects.js';
import { icon } from './icons.js';
import { recordResults, dueReview, startReview, REVIEW_MAX, REVIEW_PER_CORRECT, REVIEW_CLEAR } from './review.js';
import { openWeak, startWeak, openTestEntry, WEAK_PER_CORRECT, WEAK_CLEAR } from './tests.js';

export const LOOK_POINTS = 3;
const DRILL_PER_CORRECT = 5;
const DRILL_CLEAR = 10;

// 月曜日の日付（週の名前）
function weekKey(d = new Date()) {
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));
}
function weekDates() {
  const [y, m, d] = weekKey().split('-').map(Number);
  return Array.from({ length: 7 }, (_, i) => toISO(new Date(y, m - 1, d + i)));
}

function state(p) {
  if (!p.bonus) p.bonus = { days: {}, weeks: {} };
  const t = today();
  const wk = weekKey();
  if (!p.bonus.days[t]) p.bonus.days[t] = {};
  if (!p.bonus.weeks[wk]) p.bonus.weeks[wk] = {};
  return { day: p.bonus.days[t], wk: p.bonus.weeks[wk] };
}

// 毎日・毎週のごほうび。progress() は [いま, もくひょう]
function goals(p) {
  const dates = weekDates();
  const weekMin = dates.reduce((n, d) => n + minutesOn(p, d), 0);
  const stamps = week(p).filter((d) => d.done).length;
  const quests = dates.filter((d) => p.daily?.[d]).length;
  // おとなは まいにちクエストのかわりに「ルーティーンをやった日」
  const adult = isAdult(p);
  const routineDays = dates.filter((d) => Object.keys(p.routineLog?.[d] || {}).length).length;
  return {
    daily: [
      { id: 'min30', ic: 'clock-3', label: 'タイマーで 30分 勉強', tab: 'timer', now: minutesOn(p, today()), goal: 30, reward: 15 },
    ],
    weekly: [
      { id: 'stamp5', ic: 'calendar-check', label: 'スタンプを 5日 あつめる', tab: 'home', now: stamps, goal: 5, reward: 50 },
      { id: 'min120', ic: 'timer', label: '今週 120分 勉強', tab: 'timer', now: weekMin, goal: 120, reward: 50 },
      adult
        ? { id: 'routine5', ic: 'trophy', label: 'ルーティーンを 5日 やる', tab: 'quest', now: routineDays, goal: 5, reward: 30 }
        : { id: 'quest5', ic: 'trophy', label: 'まいにちクエストを 5回', tab: 'quest', now: quests, goal: 5, reward: 30 },
    ],
  };
}

// ギフトについた数字（いま受けとれる・やれるもの）
export function bonusCount(p) {
  const { day, wk } = state(p);
  const g = goals(p);
  let n = 0;
  if (!day.lookRec) n += 1;
  if (!day.lookProg) n += 1;
  drillsFor(p).forEach((d) => { if (!day[`drill:${d.id}`]) n += 1; });
  if (dueReview(p).length) n += 1;
  g.daily.forEach((x) => { if (!day[x.id] && x.now >= x.goal) n += 1; });
  g.weekly.forEach((x) => { if (!wk[x.id] && x.now >= x.goal) n += 1; });
  return n;
}

// 見るだけのポイント（1日1回）
function lookReward(p, key, deps) {
  const { day } = state(p);
  if (day[key]) return;
  day[key] = true;
  deps.gain(p, LOOK_POINTS, key === 'lookRec' ? 'きょうのおすすめを見た' : 'すすみ表を見た', { study: false });
}

function sheet(cls, ...kids) {
  const close = () => el.remove();
  const el = h('div', { class: 'sheet', onclick: (e) => { if (e.target === el) close(); } },
    h('div', { class: `sheet-card ${cls}` }, ...kids, h('button', { class: 'link', onclick: close }, 'とじる')));
  document.body.append(el);
  return { el, close };
}

const bar = (now, goal) => h('span', { class: 'gbar' }, h('i', { style: `width:${Math.min(100, Math.round((now / goal) * 100))}%` }));

// ---- ボーナスの一覧 -----------------------------------------------------------

export function openBonus(p, deps) {
  document.querySelector('.sheet.bonus-sheet')?.remove();
  const { day, wk } = state(p);
  const g = goals(p);

  const row = ({ ic, label, sub, reward, done, ready, onTap, progress }) => h('li', { class: `quest-row ${done ? 'done' : ''} ${ready ? 'ready' : ''}`, ...(done ? {} : { onclick: onTap, style: 'cursor:pointer' }) },
    h('span', { class: 'q-ic' }, icon(ic)),
    h('span', { class: 'q-main' }, h('b', {}, label), progress || (sub ? h('small', {}, sub) : null)),
    done
      ? h('span', { class: 'q-done' }, icon('check'))
      : h('button', { class: `q-go ${ready ? 'claim' : ''}`, 'aria-label': label }, ready ? 'うけとる' : [icon('sprout'), `${reward}`]));

  const reopen = () => { s.close(); deps.render(); openBonus(p, deps); };

  const look = [
    row({ ic: 'eye', label: 'きょうのおすすめを 見る', reward: LOOK_POINTS, done: day.lookRec,
      onTap: () => { s.close(); deps.openRecommend(); } }),
    row({ ic: 'chart-column', label: 'すすみ表を 見る', reward: LOOK_POINTS, done: day.lookProg,
      onTap: () => { s.close(); openProgress(p, deps); } }),
  ];

  const drills = drillsFor(p).map((d) => {
    const key = `drill:${d.id}`;
    const res = day[key];
    return row({ ic: d.ic, label: `${d.label} 5もん`, reward: `${DRILL_PER_CORRECT * 5 + DRILL_CLEAR}`,
      sub: res ? `${res.score} / ${res.total}` : '1もん5・ぜんぶで +10', done: !!res,
      onTap: () => { s.close(); startDrill(p, d, deps); } });
  });

  // やりなおし・にがて（成績につながるクエスト）
  const due = dueReview(p).length;
  const fix = [
    due ? row({ ic: 'notebook-pen', label: `やりなおし ${Math.min(due, REVIEW_MAX)}もん`, sub: `まちがえた問題を もういちど・1もん${REVIEW_PER_CORRECT}`,
      reward: Math.min(due, REVIEW_MAX) * REVIEW_PER_CORRECT + REVIEW_CLEAR, onTap: () => { s.close(); startReview(p, deps); } }) : null,
    ...openWeak(p).slice(0, 3).map((w) => row({ ic: 'target', label: `にがて: ${w.topic}`, sub: `${w.subject}・ピヨ先生の 3もん`,
      reward: 3 * WEAK_PER_CORRECT + WEAK_CLEAR, onTap: (e) => { s.close(); startWeak(p, w, deps); } })),
    isAdult(p) ? null : row({ ic: 'trophy', label: '実力テストの点を 入れる', sub: 'テストが かえってきたら', reward: '30〜100',
      onTap: () => { s.close(); openTestEntry(p, deps); } }),
  ];

  const goalRow = (x, store) => {
    const done = !!store[x.id];
    const ready = !done && x.now >= x.goal;
    return row({ ic: x.ic, label: x.label, reward: x.reward, done, ready,
      progress: h('span', { class: 'q-prog' }, bar(x.now, x.goal), h('small', {}, `${Math.min(x.now, x.goal)} / ${x.goal}`)),
      onTap: () => {
        if (!ready) {   // まだなら、そのページへ とぶ
          s.close();
          deps.goTab?.(x.tab);
          toast(`あと ${x.goal - x.now}${x.id.startsWith('min') ? '分' : ''}！`);
          return;
        }
        store[x.id] = true;
        deps.gain(p, x.reward, `ボーナス: ${x.label}`, { study: false });
        reopen();
      } });
  };

  // 週のおわりまで
  const left = 6 - ((new Date().getDay() + 6) % 7);
  const s = sheet('bonus-card',
    h('p', { class: 'sheet-title' }, icon('gift'), ' ボーナス'),
    h('p', { class: 'sheet-sub' }, 'もっと ポイントを あつめたいときに'),
    h('div', { class: 'q-group' }, h('h4', {}, 'きょう'), h('ul', { class: 'quest-list' }, look, drills, g.daily.map((x) => goalRow(x, day)))),
    fix.some(Boolean) ? h('div', { class: 'q-group' }, h('h4', {}, 'せいせきアップ'), h('ul', { class: 'quest-list' }, fix)) : null,
    h('div', { class: 'q-group event' }, h('h4', {}, '今週のイベント', h('small', {}, left ? `のこり${left}日` : 'きょうまで')),
      h('ul', { class: 'quest-list' }, g.weekly.map((x) => goalRow(x, wk)))),
  );
  s.el.classList.add('bonus-sheet');
}

export function startDrill(p, d, deps) {
  const key = `drill:${d.id}`;
  runQuestions(d.label, buildDrill(d.id, gradeBucket(p), `${p.id}:${today()}`), (score, total, results) => {
    recordResults(p, results, d.label);
    const { day } = state(p);
    if (day[key]) { save(); return 'れんしゅうなので ポイントはないよ'; }
    day[key] = { score, total };
    const pts = score * DRILL_PER_CORRECT + (score === total ? DRILL_CLEAR : 0);
    if (pts > 0) deps.gain(p, pts, d.label); else save();
    deps.render();
    return `+${pts} ポイント！`;
  });
}

// ---- きょうのおすすめ ---------------------------------------------------------------
// recs: [{ ic, text, sub, act }]（main.js がつくる）

export function openRecommend(p, recs, deps) {
  const s = sheet('rec-card',
    h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 56, height: 56 }),
    h('p', { class: 'sheet-title' }, 'きょうのおすすめ'),
    h('ol', { class: 'rec-list' }, recs.map((r, i) => h('li', {},
      h('button', { class: 'rec-item', style: `--i:${i}`, onclick: () => { s.close(); r.act(); } },
        h('span', { class: 'q-ic' }, icon(r.ic)),
        h('span', { class: 'q-main' }, h('b', {}, r.text), r.sub ? h('small', {}, r.sub) : null),
        h('span', { class: 'go-arrow' }, icon('chevron-right')))))),
  );
  lookReward(p, 'lookRec', deps);
}

// ---- すすみ表 ------------------------------------------------------------------------

// すすみ表の中身（勉強タブの「進み具合」でも そのまま使う）
export function progressParts(p) {
  const lv = levelOf(p);
  const st = streak(p);
  const weekMin = weekDates().reduce((n, d) => n + minutesOn(p, d), 0);
  const allMin = sessions(p).reduce((n, x) => n + x.minutes, 0);
  const items = p.items.filter((i) => !i.done).sort((a, b) => a.date.localeCompare(b.date));

  // 今週の教科べつの分
  const bySubject = {};
  weekDates().forEach((d) => sessions(p).filter((x) => x.date === d).forEach((x) => { bySubject[x.subject] = (bySubject[x.subject] || 0) + x.minutes; }));
  const subjects = Object.entries(bySubject).sort((a, b) => b[1] - a[1]);
  const maxSub = Math.max(1, ...subjects.map(([, m]) => m));

  return [
    h('div', { class: 'prog-lv' },
      h('span', { class: 'lv' }, `Lv${lv.lv}`),
      h('span', { class: 'q-main' }, bar(lv.into, lv.need), h('small', {}, `あと ${lv.left} で Lv${lv.lv + 1}`))),
    h('div', { class: 'stat4' },
      h('div', {}, h('b', {}, icon('flame'), `${st.n}`), h('small', {}, 'れんぞく')),
      h('div', {}, h('b', {}, `${weekMin}分`), h('small', {}, '今週')),
      h('div', {}, h('b', {}, `${allMin}分`), h('small', {}, 'るいけい')),
      h('div', {}, h('b', {}, icon('sprout'), `${p.points}`), h('small', {}, 'ポイント'))),
    h('div', { class: 'week' }, week(p).map((d) => h('div', { class: `day ${d.done ? 'done' : ''} ${d.today ? 'today' : ''} ${d.future ? 'future' : ''}` },
      h('span', { class: 'stamp' }, d.done ? icon('check') : ''), h('small', {}, d.label)))),
    h('div', { class: 'q-group' }, h('h4', {}, 'テスト・宿題・目標'),
      items.length
        ? h('ul', { class: 'prog-items' }, items.map((i) => {
          const total = buildSteps(i).length;
          const done = Math.min(total, i.stepsDone || 0);
          return h('li', {},
            h('span', { class: 'prog-head' },
              h('span', { class: 'chip' }, `${i.subject}${i.type === 'test' ? 'テスト' : i.type === 'goal' ? '目標' : '宿題'}`),
              h('b', {}, i.title), h('small', {}, daysLabel(daysUntil(i.date)))),
            h('span', { class: 'q-prog' }, bar(done, total), h('small', {}, `${done} / ${total}`)));
        }))
        : h('p', { class: 'empty' }, 'まだ ないよ')),
    subjects.length ? h('div', { class: 'q-group' }, h('h4', {}, '今週の教科'),
      h('ul', { class: 'prog-items' }, subjects.map(([sub, m]) => h('li', { class: 'sub-row' },
        h('span', { class: 'sub-name' }, sub),
        h('span', { class: 'gbar' }, h('i', { style: `width:${Math.round((m / maxSub) * 100)}%;background:${subjectColor(p, sub)}` })),
        h('small', {}, `${m}分`))))) : null,
  ].filter(Boolean);
}

export function openProgress(p, deps) {
  sheet('prog-card', h('p', { class: 'sheet-title' }, icon('chart-column'), ' すすみ表'), ...progressParts(p));
  lookReward(p, 'lookProg', deps);
}

// 勉強タブで「進み具合」を見たときも、すすみ表と同じ 見るだけポイント
export function lookProgress(p, deps) { lookReward(p, 'lookProg', deps); }
