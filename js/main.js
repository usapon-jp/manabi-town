import {
  GRADES, SUBJECTS, getState, currentProfile, addProfile, switchProfile, updateProfile,
  addPoints, addItem, removeItem, addQuiz, removeQuiz, gradeBucket, gradeLabel, today, daysUntil, save, exportData, importData,
} from './store.js';
import { buildDaily, quizQuestions, POINTS_PER_CORRECT, CLEAR_BONUS } from './quests.js';
import { runQuestions } from './runner.js';
import { parseImport } from './importer.js';
import { h, toast, daysLabel } from './ui.js';
import { todayTasks, completeStep, undoStep, buildSteps, migrateHomework, urgentHomework } from './planner.js';
import { startTutorial } from './tutorial.js';
import { bindControls } from './controls.js';
import { levelInfo, totalXp, streak, week } from './progress.js';
import { renderTimerTab, startTimer, resumeIfRunning, kindForItem, minutesOn } from './timer.js';
import { openBonus, bonusCount, openRecommend, openProgress, startDrill } from './bonus.js';
import { DRILLS } from './quests.js';
import { icon } from './icons.js';
import { askAI, aiLeft, DAY_LIMIT } from './ai.js';
import { recordResults, dueReview, startReview, reviewStats, REVIEW_PER_CORRECT } from './review.js';
import { openTestEntry, openWeak, startWeak, testHistory } from './tests.js';

const POINTS_HOMEWORK = 20;
const POINTS_TEST = 50;
const POINTS_STEP = 10;
const POINTS_PAGE = 5;   // 宿題は1ページずつなので、1ページ5
// ステップ1つのポイント
const stepPoints = (item) => (item?.type === 'homework' && item.perPage ? POINTS_PAGE : POINTS_STEP);

const panel = document.getElementById('panel');
const hud = document.getElementById('hud');
const bubble = document.getElementById('bubble');
const pad = document.getElementById('pad');
bindControls(pad);
let cardOpen = null;    // ホームの「きょうのカード」。null=開いておく（とじたら小さなクエストマーク）
let lastStamp = '';     // さっきスタンプをおしたマス（ポンと出す）
let listOpen = false;
let lastDone = '';
const tabs = document.querySelectorAll('.tabs button');
let world = null;

// null や false の子は入れない
const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
let tab = 'home';

// 起動画面は、勉強の画面ができたらすぐ消す。3Dの草原は そのあと裏で読み込む（起動を早くするため）
const splash = document.getElementById('splash');
function hideSplash() {
  if (!splash || splash.classList.contains('gone')) return;
  splash.classList.add('gone');
  setTimeout(() => splash.remove(), 500);
}
const worldEl = document.getElementById('world');
worldEl.classList.add('loading');
requestAnimationFrame(() => setTimeout(() => {
  hideSplash();
  // 起動画面が消えて 勉強の画面が見えてから、草原を作りはじめる
  setTimeout(() => {
    import('./world.js')
      .then((m) => {
        world = m.createWorld(worldEl);
        world.setActive(tab === 'home');
        requestAnimationFrame(() => worldEl.classList.replace('loading', 'ready'));
      })
      // 3D は読み込みに失敗してもアプリ自体は使えるようにする
      .catch(() => { worldEl.classList.remove('loading'); worldEl.classList.add('no-3d'); });
  }, 450);
}, 150));

// クエスト・タイマー・シートで草原が かくれている間は、3Dの描画を止める（電池と発熱のため）
function covered() { return document.body.classList.contains('running') || !!document.querySelector('.timer-run, .sheet'); }
let wasCovered = false;
new MutationObserver(() => {
  const c = covered();
  if (c === wasCovered) return;
  wasCovered = c;
  world?.setActive(tab === 'home' && !c);
}).observe(document.body, { childList: true, attributes: true, attributeFilter: ['class'] });

// 保存まわりのお知らせ
let saveWarned = 0;
window.addEventListener('manabi-save-error', () => {
  if (Date.now() - saveWarned < 60000) return; // 1分に1回まで
  saveWarned = Date.now();
  toast('ほぞんできなかったよ。おうちの人に「せってい」の「データを書き出す」を おねがいしてね', 6000);
});
window.addEventListener('manabi-restored', () => toast('データがこわれていたので、きのうまでの分に もどしたよ', 6000));
// ほかのタブで進んだら、こちらの画面も新しくする
window.addEventListener('manabi-synced', () => render());

// オフラインでも開けるようにする（https か localhost のときだけ動く）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

tabs.forEach((b) => b.addEventListener('click', () => { document.body.classList.remove('menu-open'); show(b.dataset.tab); }));

// 横向き（遊ぶ画面）では、タブを左にしまっておき メニューのボタンで出す
const menuBtn = document.getElementById('menuBtn');
menuBtn.append(icon('menu'));
document.querySelectorAll('.tabs [data-ic]').forEach((el) => el.append(icon(el.dataset.ic)));
menuBtn.addEventListener('click', () => {
  const open = document.body.classList.toggle('menu-open');
  menuBtn.replaceChildren(icon(open ? 'x' : 'menu'));
});

function gain(p, n, reason, opts) {
  const before = levelInfo(totalXp(p)).lv;
  addPoints(p, n, reason, opts);
  const after = levelInfo(totalXp(p)).lv;
  if (after > before) {
    toast(`レベルアップ！ Lv${after}`);
    setTimeout(() => world?.celebrate(), 300);
  } else {
    toast(`+${n} ポイント！`);
  }
  world?.celebrate();
}

// 1回目で「ほんとうに？」にかわり、もう1回おすとけす
function deleteButton(onDelete) {
  let armed = false;
  const b = h('button', { class: 'link', onclick: () => {
    if (armed) { onDelete(); return; }
    armed = true;
    b.textContent = 'ほんとうにけす？';
    b.classList.add('armed');
    setTimeout(() => { armed = false; b.textContent = 'けす'; b.classList.remove('armed'); }, 3000);
  } }, 'けす');
  return b;
}

// タイマーにわたす道具
const timerDeps = {
  fill, gain, addPoints, deleteButton, render: () => render(),
  completeStepFor(item, label) {
    completeStep(item);
    lastDone = label;
    gain(currentProfile(), stepPoints(item), `${item.title}: ${label}`);
    save();
    render();
  },
};

// ボーナスにわたす道具（ポイントをあげたら上のバーも直す）
const bonusDeps = {
  gain: (p, n, reason, opts) => { gain(p, n, reason, opts); save(); render(); },
  render: () => render(),
  openRecommend: () => openRecommend(currentProfile(), recommendations(currentProfile()), bonusDeps),
};

function show(next) {
  tab = next;
  tabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  render();
}

function render() {
  const p = currentProfile();
  if (!p) { renderWelcome(); return; }
  // むかしの宿題（3ページで1ステップ）をページ単位に
  if (p.items.map(migrateHomework).some(Boolean)) save();
  const lv = levelInfo(totalXp(p));
  const st = streak(p);
  const bonusN = bonusCount(p);
  fill(hud,
    h('div', { class: 'who' },
      h('span', { class: 'lv' }, `Lv${lv.lv}`),
      h('span', { class: 'name' }, p.name),
      h('span', { class: 'xp', title: `あと${lv.left}でレベルアップ` }, h('i', { style: `width:${Math.round((lv.into / lv.need) * 100)}%` }))),
    h('div', { class: 'stats' },
      h('span', { class: `fire ${st.doneToday ? 'on' : ''}`, title: 'れんぞく日数' }, icon('flame'), `${st.n}`),
      h('span', { class: 'points' }, icon('sprout'), `${p.points}`),
      h('button', { class: 'bonus-btn', 'aria-label': 'ボーナス', onclick: () => openBonus(p, bonusDeps) },
        icon('gift'), bonusN ? h('i', { class: 'badge' }, bonusN) : null)),
  );
  hud.hidden = false;
  document.querySelector('.tabs').hidden = false;
  menuBtn.hidden = false;
  document.body.dataset.tab = tab;
  if (tab !== 'home') { document.body.classList.remove('menu-open'); menuBtn.replaceChildren(icon('menu')); }
  const home = tab === 'home';
  world?.setActive(home && !covered());
  panel.hidden = home;
  bubble.hidden = !home;
  pad.hidden = !home;
  if (home) renderHome(p);
  else if (tab === 'todo') renderTodo(p);
  else if (tab === 'quest') renderQuest(p);
  else if (tab === 'timer') renderTimerTab(panel, p, timerDeps);
  else renderSettings(p);
}

// ---- ようこそ（はじめての人の登録） ----------------------------------------

function renderWelcome() {
  world?.setActive(true);
  pad.hidden = true;
  hud.hidden = true;
  bubble.hidden = true;
  document.querySelector('.tabs').hidden = true;
  panel.hidden = false;
  fill(panel, profileForm('はじめまして！ピヨだよ。きみの名前と学年をおしえてね。', 'はじめる'));
}

function profileForm(message, label) {
  const name = h('input', { type: 'text', maxlength: 12, placeholder: 'なまえ', required: true });
  const grade = h('select', {}, GRADES.map((g) => h('option', { value: g.id }, g.label)));
  grade.value = 'e4';
  return h('form', { class: 'card', onsubmit: (e) => {
    e.preventDefault();
    if (!name.value.trim()) return;
    addProfile(name.value.trim(), grade.value);
    show('home');
    setTimeout(() => runTutorial(currentProfile()), 400);
  } },
  h('p', { class: 'lead' }, message),
  h('label', {}, 'なまえ', name),
  h('label', {}, '学年', grade),
  h('button', { class: 'btn primary', type: 'submit' }, label));
}

// ---- ホーム ----------------------------------------------------------------

// きょうやることを1列に（クエストが先頭）
function homeTasks(p) {
  const daily = { kind: 'daily', label: '漢字・英単語・算数クエスト', tag: 'まいにち', done: !!p.daily[today()] };
  const steps = [];
  todayTasks(p.items).forEach(({ item, steps: list }) => list.forEach((st) => steps.push({
    kind: 'step', item, st, label: st.label, done: st.done,
    tag: `${item.subject}${item.type === 'test' ? 'テスト' : item.type === 'goal' ? '目標' : '宿題'}`,
  })));
  // きょう提出（すぎたものも）の宿題は、クエストより先に
  const due = (t) => t.item.type === 'homework' && daysUntil(t.item.date) <= 0;
  return [...steps.filter(due), daily, ...steps.filter((t) => !due(t))];
}

// チェックをつける・もどす
function toggleTask(p, t) {
  if (t.kind === 'daily') { show('quest'); return; }
  if (t.done) {
    if (undoStep(t.item)) addPoints(p, -stepPoints(t.item), `とりけし: ${t.item.title}`);
    lastDone = '';
  } else {
    completeStep(t.item);
    lastDone = t.label;
    gain(p, stepPoints(t.item), `${t.item.title}: ${t.label}`);
  }
  save();
  render();
}

// ピヨ先生の「きょうのおすすめ」（3つくらい）
function recommendations(p) {
  const tasks = homeTasks(p);
  const next = tasks.find((t) => !t.done);
  const recs = [];
  if (next) {
    recs.push({ ic: 'pencil', text: next.label, sub: `つぎは これ！・${next.tag}`,
      act: () => (next.kind === 'daily' ? startDaily(p) : openStep(p, next, (t) => toggleTask(p, t))) });
  } else {
    recs.push({ ic: 'party-popper', text: 'きょうの分は ぜんぶ できた！', sub: '草原で あそぼう', act: () => show('home') });
  }
  const test = p.items.filter((i) => !i.done && i.type === 'test' && daysUntil(i.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (test) {
    const total = buildSteps(test).length;
    recs.push({ ic: 'target', text: `${test.subject}テストまで ${daysLabel(daysUntil(test.date))}`, sub: `すすみ ${Math.min(total, test.stepsDone || 0)} / ${total}`, act: () => openProgress(p, bonusDeps) });
  }
  if (minutesOn(p, today()) < 30) recs.push({ ic: 'clock-3', text: 'タイマーで 15分 やってみよう', sub: `きょう ${minutesOn(p, today())}分`, act: () => show('timer') });
  const day = p.bonus?.days?.[today()] || {};
  const drills = DRILLS.filter((d) => !day[`drill:${d.id}`]);
  if (drills.length) {
    const d = drills[new Date().getDate() % drills.length];
    recs.push({ ic: d.ic, text: `${d.label}で ポイントをあつめよう`, sub: '5もん・ボーナス', act: () => startDrill(p, d, bonusDeps) });
  }
  return recs.slice(0, 4);
}

function renderHome(p) {
  const tasks = homeTasks(p);
  const doneCount = tasks.filter((t) => t.done).length;
  const nextTask = tasks.find((t) => !t.done);
  const st = streak(p);

  // ピヨ先生のひとこと（小さな1歩をすすめる・できたことを具体的にほめる）
  const hour = new Date().getHours();
  const hello = hour < 11 ? 'おはよう！' : hour >= 18 ? 'おかえり！' : '';
  let words;
  if (!nextTask) words = `きょうの分 ぜんぶできた！${st.n > 1 ? `${st.n}日れんぞく！` : 'すごい！'}`;
  else if (doneCount === 0) words = `${hello}${!st.doneToday && st.n > 0 ? `1こやると ${st.n + 1}日れんぞく！` : 'まずは1こだけ やってみよう'}`;
  else if (lastDone) words = `「${lastDone}」できたね！ あと${tasks.length - doneCount}こ`;
  else words = `いいちょうし！ あと${tasks.length - doneCount}こ`;
  const urgent = urgentHomework(p.items);
  const first = urgent.find((u) => u.done < u.total && u.days <= 0);
  if (first && !lastDone) words = `${first.item.title}は ${first.days < 0 ? 'ていしゅつ日を すぎてるよ' : 'きょう ていしゅつ'}！ ${first.pages.length ? `p.${first.pages[first.done]}から やろう` : 'いまから やろう'}`;

  const toggle = (t) => toggleTask(p, t);

  const goBtn = nextTask
    ? h('button', { class: 'go', onclick: () => (nextTask.kind === 'daily' ? startDaily(p) : openStep(p, nextTask, toggle)) },
      h('span', { class: 'go-label' }, 'つぎは これ！', h('span', { class: 'chip' }, nextTask.tag)),
      h('span', { class: 'go-task' }, nextTask.label),
      h('span', { class: 'go-arrow', 'aria-hidden': 'true' }, icon('chevron-right')))
    : h('div', { class: 'go done' }, h('span', { class: 'go-task' }, icon('party-popper'), ' きょうは ぜんぶ おわり！草原で あそぼう'));

  const bar = h('div', { class: 'today-bar' },
    h('div', { class: 'segs' }, tasks.map((t) => h('i', { class: t.done ? 'on' : '' }))),
    h('button', { class: 'count', 'aria-label': 'すすみ表', onclick: () => openProgress(p, bonusDeps) }, `${doneCount} / ${tasks.length}`),
    h('button', { class: 'mins', onclick: () => show('timer') }, icon('clock-3'), `${minutesOn(p, today())}分`));

  const stamps = h('div', { class: 'week' }, week(p).map((d) => h('div', { class: `day ${d.done ? 'done' : ''} ${d.today ? 'today' : ''} ${d.future ? 'future' : ''}` },
    h('span', { class: 'stamp' }, d.done ? icon('check') : ''), h('small', {}, d.label))));

  const list = h('ul', { class: 'tasks' }, tasks.map((t) => h('li', { class: `task ${t.done ? 'checked' : ''}` },
    h('button', { class: 'check', 'aria-label': t.done ? 'もどす' : 'できた', onclick: () => toggle(t) }, t.done ? icon('check') : ''),
    h('button', { class: 'task-label', onclick: () => (t.kind === 'daily' ? show('quest') : openStep(p, t, toggle)) },
      h('span', { class: 'chip soft' }, t.tag), ` ${t.label}`,
      t.item ? h('small', {}, ` ${daysLabel(daysUntil(t.item.date))}`) : null))));

  const open = cardOpen ?? true;   // ふだんは開いておく（きょうやることを いちばん上に）
  bubble.classList.toggle('mini', !open);
  const left = tasks.length - doneCount;   // まだ終わっていない、きょうのクエストの数
  fill(bubble,
    h('button', { class: 'quest-mark', 'aria-label': left ? `きょうのクエスト あと${left}こ` : 'きょうのクエスト ぜんぶおわり', onclick: () => { cardOpen = true; render(); } },
      icon('book-open'),
      left ? h('span', { class: 'quest-badge' }, String(left)) : null),
    h('div', { class: 'card-body' },
      bar,
      dueCard(p, urgent),
      h('div', { class: 'coach' },
      h('button', { class: 'coach-face', 'aria-label': 'きょうのおすすめ', onclick: () => bonusDeps.openRecommend() },
        h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 40, height: 40 })),
      h('p', {}, words),
      h('button', { class: 'fold', 'aria-label': 'とじる', onclick: () => { cardOpen = false; render(); } }, icon('x'))),
    h('div', { class: 'today-body' },
      goBtn,
      stamps,
      h('details', { class: 'all-tasks', open: listOpen || null, ontoggle: (e) => { listOpen = e.target.open; } },
        h('summary', {}, 'きょうのリスト'),
        list,
        h('button', { class: 'btn small', 'data-tour': 'add', onclick: () => show('todo') }, '＋ テスト・宿題・目標')),
    )),
  );
}

// いそぎの宿題（きょう・あした提出、すぎたもの）。1ページ1マスで、できたらタップしてスタンプ
function dueCard(p, list) {
  if (!list.length) return null;
  return h('div', { class: 'due-list' }, list.map((u) => {
    const { item, pages, total, done, doneToday, days } = u;
    const left = total - done;
    const head = days < 0 ? `${-days}日 すぎてる！` : days === 0 ? 'きょう ていしゅつ！' : 'あした ていしゅつ';
    const sub = left
      ? (pages.length ? `p.${pages[done]} から・あと ${left}ページ` : 'まだ おわってないよ')
      : 'ぜんぶ できた！ わすれずに だそう';
    const stamp = () => {
      const label = pages.length ? `p.${pages[done]}` : item.title;
      lastStamp = `${item.id}:${done}`;
      setTimeout(() => { lastStamp = ''; }, 700);
      toggleTask(p, { kind: 'step', item, label, done: false });
      if (done + 1 >= total) toast(`${item.title} ぜんぶ できた！`);
    };
    const undo = () => { lastStamp = ''; toggleTask(p, { kind: 'step', item, label: '', done: true }); };
    const cells = (pages.length ? pages : [null]).map((n, idx) => {
      const on = idx < done;
      const canUndo = on && idx === done - 1 && doneToday > 0;
      return h('button', {
        class: `cell ${on ? 'on' : ''} ${idx === done ? 'next' : ''} ${lastStamp === `${item.id}:${idx}` ? 'pop' : ''}`,
        'aria-label': on ? (canUndo ? `${n ?? ''} もどす` : `${n ?? ''} できた`) : `${n ?? ''} できたら タップ`,
        onclick: () => (on ? (canUndo ? undo() : null) : stamp()),
      }, on ? icon('check') : h('span', {}, n ?? 'できた'));
    });
    return h('div', { class: `due ${days <= 0 && left ? 'hot' : ''} ${left ? '' : 'clear'}` },
      h('div', { class: 'due-head' },
        h('span', { class: 'due-when' }, head),
        h('b', { class: 'due-title' }, item.title),
        h('span', { class: 'due-count' }, `${done} / ${total}`)),
      h('p', { class: 'due-sub' }, sub),
      h('div', { class: 'cells' }, cells),
      left ? null : h('button', { class: 'btn small primary', onclick: () => {
        item.done = true;
        gain(p, POINTS_HOMEWORK, `宿題: ${item.title}`);
        save();
        render();
      } }, 'だした！ ', icon('sprout'), `+${POINTS_HOMEWORK}`));
  }));
}

// 1つのステップに集中する小さな画面（やったら「できた！」）
function openStep(p, t, toggle) {
  const close = () => sheet.remove();
  const sheet = h('div', { class: 'sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card' },
      h('span', { class: 'chip' }, t.tag),
      h('p', { class: 'sheet-title' }, t.label),
      h('p', { class: 'sheet-sub' }, `${t.item.title}・${daysLabel(daysUntil(t.item.date))}`),
      t.done
        ? h('button', { class: 'btn', onclick: () => { close(); toggle(t); } }, 'まだだった（もどす）')
        : h('button', { class: 'btn primary big-btn', onclick: () => { close(); startTimer(p, { kind: kindForItem(t.item), subject: t.item.subject, item: t.item, stepLabel: t.label }, timerDeps); } }, icon('clock-3'), ' タイマーで はじめる'),
      t.done ? null : h('button', { class: 'btn', onclick: () => { close(); toggle(t); } }, 'もう できた！ ', icon('sprout'), '+10'),
      h('button', { class: 'link', onclick: close }, 'あとで')));
  document.body.append(sheet);
}

// ---- やること（テスト・宿題） -------------------------------------------------

function renderTodo(p) {
  const open = p.items.filter((i) => !i.done).sort((a, b) => a.date.localeCompare(b.date));
  const done = p.items.filter((i) => i.done).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  const card = (i) => {
    const days = daysUntil(i.date);
    const isTest = i.type === 'test';
    const isGoal = i.type === 'goal';
    const canFinish = isGoal ? days <= 0 : (!isTest || days <= 0);
    const total = buildSteps(i).length;
    const kind = isTest ? 'テスト' : isGoal ? '目標' : '宿題';
    return h('li', { class: `item ${isTest ? 'test' : 'homework'} ${days < 0 && !i.done ? 'late' : ''}` },
      h('div', { class: 'item-main' },
        h('span', { class: 'chip' }, kind),
        h('span', { class: 'chip soft' }, i.subject),
        h('p', { class: 'item-title' }, i.title),
        i.range ? h('p', { class: 'item-range' }, `はんい: ${i.range}`) : null,
        !i.done ? h('p', { class: 'item-range' }, `すすみ ${Math.min(i.stepsDone || 0, total)} / ${total}`) : null,
      ),
      h('div', { class: 'item-side' },
        h('span', { class: 'days' }, i.done ? 'おわり' : daysLabel(days)),
        !i.done && canFinish ? h('button', { class: 'btn small primary', onclick: () => {
          i.done = true;
          save();
          gain(p, isTest || isGoal ? POINTS_TEST : POINTS_HOMEWORK, `${kind}: ${i.title}`);
          render();
        } }, isTest ? 'おわった！' : isGoal ? 'できた！' : 'だした！') : null,
        deleteButton(() => { removeItem(p, i.id); render(); }),
      ),
    );
  };

  const type = h('select', {}, h('option', { value: 'test' }, 'テスト'), h('option', { value: 'homework' }, '宿題'), h('option', { value: 'goal' }, '目標'));
  const subject = h('select', {}, SUBJECTS.map((s) => h('option', { value: s }, s)));
  const title = h('input', { type: 'text', placeholder: 'れい: 2学期期末テスト', required: true });
  const range = h('input', { type: 'text', placeholder: 'れい: p.40〜52（なくてもOK）' });
  const date = h('input', { type: 'date', value: today(), required: true });
  const form = h('form', { class: 'card form', onsubmit: (e) => {
    e.preventDefault();
    if (!title.value.trim() || !date.value) return;
    addItem(p, { type: type.value, subject: subject.value, title: title.value.trim(), range: range.value.trim(), date: date.value });
    const n = buildSteps(p.items[p.items.length - 1]).length;
    toast(`${n}こに わけたよ。ホームを見てね`);
    render();
  } },
  h('h3', {}, 'ついかする'),
  h('p', { class: 'hint' }, 'ざっくりでOK。ページを書くと、毎日の分にわけるよ'),
  h('div', { class: 'row' }, h('label', {}, 'しゅるい', type), h('label', {}, 'きょうか', subject)),
  h('label', {}, 'なに？', title),
  h('label', {}, 'はんい', range),
  h('label', {}, 'しめきり・テストの日', date),
  h('button', { class: 'btn primary', type: 'submit', 'data-tour': 'submit' }, 'ついか'));

  fill(panel,
    h('h2', {}, 'やること'),
    form,
    open.length ? h('h3', {}, 'いれたもの') : null,
    open.length ? h('ul', { class: 'items' }, open.map(card)) : null,
    done.length ? h('details', { class: 'done' }, h('summary', {}, 'おわったもの'), h('ul', { class: 'items' }, done.map(card))) : null,
  );
}

// ---- クエスト ----------------------------------------------------------------

function startDaily(p) {
  const key = today();
  runQuestions('きょうのクエスト', buildDaily(gradeBucket(p), `${p.id}:${key}`), (score, total, results) => {
    recordResults(p, results, 'きょうのクエスト');
    if (p.daily[key]) return 'れんしゅうなので ポイントはないよ';
    p.daily[key] = { score, total };
    const pts = score * POINTS_PER_CORRECT + (score === total ? CLEAR_BONUS : 0);
    if (pts > 0) gain(p, pts, 'きょうのクエスト'); else save();
    render();
    return `+${pts} ポイント！`;
  });
}

function renderQuest(p) {
  const key = today();
  const result = p.daily[key];
  const start = () => startDaily(p);

  const quizzes = p.quizzes.map((quiz) => h('li', { class: 'item' },
    h('div', { class: 'item-main' },
      h('span', { class: 'chip' }, '小テスト'),
      quiz.subject ? h('span', { class: 'chip soft' }, quiz.subject) : null,
      h('p', { class: 'item-title' }, quiz.title),
      h('p', { class: 'item-range' }, `${quiz.questions.length}もん${quiz.cleared ? '・クリアずみ' : ''}`),
    ),
    h('div', { class: 'item-side' },
      h('button', { class: 'btn small primary', onclick: () => runQuestions(quiz.title, quizQuestions(quiz), (score, total, results) => {
        recordResults(p, results, quiz.title);
        if (quiz.cleared || score * 5 < total * 4) return quiz.cleared ? 'れんしゅうなので ポイントはないよ' : '8わり せいかいで クリア！もういちどやってみよう';
        quiz.cleared = true;
        gain(p, score * POINTS_PER_CORRECT, `小テスト: ${quiz.title}`);
        render();
        return `クリア！ +${score * POINTS_PER_CORRECT} ポイント`;
      }) }, quiz.cleared ? 'もういちど' : 'やってみる'),
      deleteButton(() => { removeQuiz(p, quiz.id); render(); }),
    ),
  ));

  fill(panel, 
    h('h2', {}, 'クエスト'),
    h('div', { class: 'card quest' },
      h('h3', {}, 'きょうのクエスト'),
      h('p', {}, '漢字・英単語・算数を 3もんずつ。せいかい1もん10ポイント、ぜんもんせいかいで +30！'),
      result
        ? h('p', { class: 'cleared' }, `きょうは クリアずみ（${result.score} / ${result.total}）`)
        : null,
      h('button', { class: 'btn primary', onclick: start }, result ? 'もういちど れんしゅう' : 'はじめる'),
    ),
    reviewCard(p),
    testCard(p),
    h('h3', {}, '小テスト'),
    quizzes.length ? h('ul', { class: 'items' }, quizzes) : h('p', { class: 'empty' }, 'テスト範囲のプリントをClaudeに送ると、小テストを作ってもらえるよ。もらったコードは「せってい」の「とりこみ」に貼ってね。'),
  );
}

// やりなおしクエスト（まちがえた問題を 次の日・3日後・1週間後に）
function reviewCard(p) {
  const st = reviewStats(p);
  return h('div', { class: 'card quest review' },
    h('h3', {}, icon('notebook-pen'), ' やりなおしクエスト'),
    st.due
      ? h('p', {}, `まちがえた問題が ${Math.min(st.due, 5)}もん まってるよ。1もん${REVIEW_PER_CORRECT}ポイント`)
      : h('p', { class: 'empty' }, st.waiting ? `つぎの やりなおしは また こんど（${st.waiting}もん まち）` : 'まちがえた問題は ここに たまるよ'),
    st.mastered ? h('p', { class: 'cleared' }, `これまでに ${st.mastered}もん おぼえた！`) : null,
    st.due ? h('button', { class: 'btn primary', onclick: () => startReview(p, { gain, render }) }, 'やりなおす') : null);
}

// 実力テスト（点数を入れてボーナス、にがてクエスト）
function testCard(p) {
  const weak = openWeak(p);
  const hist = testHistory(p);
  return h('div', { class: 'card quest tests' },
    h('h3', {}, icon('trophy'), ' 実力テスト'),
    h('p', {}, 'テストがかえってきたら 点数を入れよう。ボーナスがもらえるよ'),
    h('button', { class: 'btn primary', onclick: () => openTestEntry(p, { gain, render }) }, '点数を入れる'),
    weak.length ? h('h4', { class: 'sub-h' }, 'にがてクエスト') : null,
    weak.length ? h('ul', { class: 'quest-list' }, weak.map((w) => h('li', { class: 'quest-row' },
      h('span', { class: 'q-ic' }, icon('target')),
      h('span', { class: 'q-main' }, h('b', {}, w.topic), h('small', {}, `${w.subject}・ぜんもん正解 ${w.clears || 0} / 2`)),
      h('button', { class: 'q-go', onclick: (e) => startWeak(p, w, { gain, render }, e.currentTarget) }, 'やってみる')))) : null,
    hist.length ? h('ul', { class: 'test-hist' }, hist.map((t) => h('li', {},
      h('span', {}, `${t.date.slice(5).replace('-', '/')} ${t.subject}`), h('b', {}, `${t.score} / ${t.total}`)))) : null);
}

// ---- せってい ----------------------------------------------------------------
// データの書き出し・もどす（保存できないとき、機種をかえるときに）
function dataCard() {
  const box = h('textarea', { class: 'data-out', rows: 3, placeholder: '書き出したデータを ここに貼ると もどせます' });
  return h('details', { class: 'card form' },
    h('summary', {}, 'データを書き出す・もどす（おうちの人むけ）'),
    h('p', {}, '「書き出す」でデータをコピーします。メモなどに貼って とっておいてください。'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: async () => {
        const raw = exportData();
        box.value = raw;
        try { await navigator.clipboard.writeText(raw); toast('コピーしたよ'); } catch (e) { box.select(); toast('下の文字を ぜんぶ コピーしてね'); }
      } }, '書き出す'),
      h('button', { class: 'btn', onclick: () => {
        if (!box.value.trim()) { toast('書き出したデータを 貼ってね'); return; }
        if (importData(box.value)) { toast('もどしたよ'); render(); } else toast('読めないデータだったよ');
      } }, 'もどす')),
    box);
}

// AI（ピヨ先生のヒント）が使えるか、おうちの人が確認するところ
function aiCard() {
  const status = h('p', { class: 'ai-status' }, `ヒントは 1日 ${DAY_LIMIT}回まで（のこり ${aiLeft()}回）`);
  return h('div', { class: 'card form' },
    h('h3', {}, 'ピヨ先生のヒント（AI）'),
    status,
    h('button', { class: 'btn', onclick: async (e) => {
      e.target.disabled = true;
      status.textContent = 'たしかめ中…';
      try {
        const r = await askAI({ action: 'ping' }, { count: false });
        status.textContent = r.ready ? 'つながりました。ヒントが使えます' : 'まだ APIキーが 置かれていません';
      } catch (err) {
        status.textContent = `つながりませんでした（${String(err.message || err).slice(0, 60)}）`;
      }
      e.target.disabled = false;
    } }, 'つながりを たしかめる'));
}


function renderSettings(p) {
  const s = getState();
  const name = h('input', { type: 'text', maxlength: 12, value: p.name });
  const grade = h('select', {}, GRADES.map((g) => h('option', { value: g.id }, g.label)));
  grade.value = p.grade;
  const code = h('textarea', { rows: 5, placeholder: 'Claudeからもらった とりこみコードを ここに貼る' });

  fill(panel, 
    h('h2', {}, 'せってい'),
    h('form', { class: 'card form', onsubmit: (e) => {
      e.preventDefault();
      if (!name.value.trim()) return;
      updateProfile(p, { name: name.value.trim(), grade: grade.value });
      toast('ほぞんしたよ');
      render();
    } },
    h('h3', {}, 'じぶん'),
    h('label', {}, 'なまえ', name),
    h('label', {}, '学年', grade),
    h('button', { class: 'btn primary', type: 'submit' }, 'ほぞん')),

    h('div', { class: 'card form' },
      h('h3', {}, 'とりこみ'),
      h('p', {}, 'テストや宿題、小テストの問題をまとめて入れられます。'),
      code,
      h('button', { class: 'btn primary', onclick: () => {
        const result = parseImport(code.value);
        if (result.error) { toast(result.error); return; }
        result.items.forEach((i) => addItem(p, i));
        result.quizzes.forEach((q) => addQuiz(p, q));
        code.value = '';
        toast(`テスト・宿題 ${result.items.length}こ、小テスト ${result.quizzes.length}こ を入れたよ`);
      } }, 'とりこむ'),
    ),

    aiCard(),
    dataCard(),

    h('div', { class: 'card form' },
      h('h3', {}, 'つかう人をかえる'),
      h('ul', { class: 'people' }, s.profiles.map((x) => h('li', {},
        h('button', { class: `btn ${x.id === p.id ? 'primary' : ''}`, onclick: () => { switchProfile(x.id); show('home'); } },
          `${x.name}（${gradeLabel(x)}） `, icon('sprout'), `${x.points}`),
      ))),
      h('details', {}, h('summary', {}, 'あたらしく ついか'), profileForm('きょうだいも ここで ついかできます。', 'ついか')),
    ),
    h('button', { class: 'btn', onclick: () => { show('home'); setTimeout(() => runTutorial(p), 300); } }, 'つかいかたを もういちど見る'),
    h('p', { class: 'note' }, 'お試し版のデータは、この端末のブラウザの中だけに保存されます。'),
  );
}

function runTutorial(p) {
  if (!p) return;
  startTutorial({ show, onDone: () => { updateProfile(p, { tutorialDone: true }); render(); } });
}

render();
resumeIfRunning(currentProfile(), timerDeps);
if (currentProfile() && !currentProfile().tutorialDone) setTimeout(() => runTutorial(currentProfile()), 1200);
