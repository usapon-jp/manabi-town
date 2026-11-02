import {
  GRADES, SUBJECTS, getState, currentProfile, addProfile, switchProfile, updateProfile,
  addPoints, addItem, removeItem, addQuiz, removeQuiz, gradeBucket, gradeLabel, today, daysUntil, save,
} from './store.js';
import { buildDaily, quizQuestions, POINTS_PER_CORRECT, CLEAR_BONUS } from './quests.js';
import { runQuestions } from './runner.js';
import { parseImport } from './importer.js';
import { h, toast, daysLabel } from './ui.js';
import { todayTasks, completeStep, undoStep, buildSteps } from './planner.js';
import { startTutorial } from './tutorial.js';

const POINTS_HOMEWORK = 20;
const POINTS_TEST = 50;
const POINTS_STEP = 10;

const panel = document.getElementById('panel');
const hud = document.getElementById('hud');
const bubble = document.getElementById('bubble');
const tabs = document.querySelectorAll('.tabs button');
let world = null;

// null や false の子は入れない
const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
let tab = 'home';

// 起動画面は草原ができたら消す。おそくても4秒で消す
const splash = document.getElementById('splash');
function hideSplash() {
  if (!splash || splash.classList.contains('gone')) return;
  splash.classList.add('gone');
  setTimeout(() => splash.remove(), 500);
}
setTimeout(hideSplash, 4000);

// 3D は読み込みに失敗してもアプリ自体は使えるようにする
import('./world.js')
  .then((m) => {
    world = m.createWorld(document.getElementById('world'));
    world.setActive(tab === 'home');
    requestAnimationFrame(() => setTimeout(hideSplash, 300));
  })
  .catch(() => { document.getElementById('world').classList.add('no-3d'); hideSplash(); });

// オフラインでも開けるようにする（https か localhost のときだけ動く）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));

function gain(p, n, reason) {
  addPoints(p, n, reason);
  toast(`+${n} ポイント！`);
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

function show(next) {
  tab = next;
  tabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  render();
}

function render() {
  const p = currentProfile();
  if (!p) { renderWelcome(); return; }
  fill(hud, 
    h('span', { class: 'who' }, `${p.name}（${gradeLabel(p)}）`),
    h('span', { class: 'points' }, `⭐ ${p.points}`),
  );
  hud.hidden = false;
  document.querySelector('.tabs').hidden = false;
  const home = tab === 'home';
  world?.setActive(home);
  panel.hidden = home;
  bubble.hidden = !home;
  if (home) renderHome(p);
  else if (tab === 'todo') renderTodo(p);
  else if (tab === 'quest') renderQuest(p);
  else renderSettings(p);
}

// ---- ようこそ（はじめての人の登録） ----------------------------------------

function renderWelcome() {
  world?.setActive(true);
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

function renderHome(p) {
  const dailyDone = !!p.daily[today()];
  const plans = todayTasks(p.items);
  const rows = [];
  rows.push(h('li', { class: `task ${dailyDone ? 'checked' : ''}` },
    h('button', { class: 'check', 'aria-label': 'クエストへ', onclick: () => show('quest') }, dailyDone ? '✓' : ''),
    h('button', { class: 'task-label', onclick: () => show('quest') },
      h('span', { class: 'chip' }, 'まいにち'), ' 漢字・英単語・算数クエスト'),
  ));
  plans.forEach(({ item, steps }) => steps.forEach((st) => {
    rows.push(h('li', { class: `task ${st.done ? 'checked' : ''}` },
      h('button', { class: 'check', 'aria-label': st.done ? 'もどす' : 'できた', onclick: () => {
        if (st.done) {
          if (undoStep(item)) { addPoints(p, -POINTS_STEP, `とりけし: ${item.title}`); }
        } else {
          completeStep(item);
          gain(p, POINTS_STEP, `${item.title}: ${st.label}`);
        }
        save();
        render();
      } }, st.done ? '✓' : ''),
      h('div', { class: 'task-label' },
        h('span', { class: `chip ${item.type === 'test' ? '' : 'soft'}` }, `${item.subject}${item.type === 'test' ? 'テスト' : item.type === 'goal' ? '目標' : '宿題'}`),
        ` ${st.label}`,
        h('small', {}, ` ${daysLabel(daysUntil(item.date))}`)),
    ));
  }));

  const left = plans.reduce((n, pl) => n + pl.steps.filter((x) => !x.done).length, 0) + (dailyDone ? 0 : 1);
  let words;
  if (!p.items.some((i) => !i.done)) words = 'テストや宿題を入れてね。毎日の分にわけるよ';
  else if (left === 0) words = 'きょうの分、ぜんぶできた！すごい！';
  else words = `きょうは あと${left}こ。いっしょにやろう！`;
  fill(bubble,
    h('p', {}, h('strong', {}, 'ピヨ先生 '), words),
    h('ul', { class: 'tasks' }, rows),
    h('div', { class: 'bubble-actions' },
      h('button', { class: 'btn small', 'data-tour': 'add', onclick: () => show('todo') }, '＋ テスト・宿題・目標'),
    ),
  );
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

function renderQuest(p) {
  const key = today();
  const result = p.daily[key];
  const startDaily = () => runQuestions('きょうのクエスト', buildDaily(gradeBucket(p), `${p.id}:${key}`), (score, total) => {
    if (p.daily[key]) return 'れんしゅうなので ポイントはないよ';
    p.daily[key] = { score, total };
    const pts = score * POINTS_PER_CORRECT + (score === total ? CLEAR_BONUS : 0);
    if (pts > 0) gain(p, pts, 'きょうのクエスト'); else save();
    render();
    return `+${pts} ポイント！`;
  });

  const quizzes = p.quizzes.map((quiz) => h('li', { class: 'item' },
    h('div', { class: 'item-main' },
      h('span', { class: 'chip' }, '小テスト'),
      quiz.subject ? h('span', { class: 'chip soft' }, quiz.subject) : null,
      h('p', { class: 'item-title' }, quiz.title),
      h('p', { class: 'item-range' }, `${quiz.questions.length}もん${quiz.cleared ? '・クリアずみ' : ''}`),
    ),
    h('div', { class: 'item-side' },
      h('button', { class: 'btn small primary', onclick: () => runQuestions(quiz.title, quizQuestions(quiz), (score, total) => {
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
      h('button', { class: 'btn primary', onclick: startDaily }, result ? 'もういちど れんしゅう' : 'はじめる'),
    ),
    h('h3', {}, '小テスト'),
    quizzes.length ? h('ul', { class: 'items' }, quizzes) : h('p', { class: 'empty' }, 'テスト範囲のプリントをClaudeに送ると、小テストを作ってもらえるよ。もらったコードは「せってい」の「とりこみ」に貼ってね。'),
  );
}

// ---- せってい ----------------------------------------------------------------

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

    h('div', { class: 'card form' },
      h('h3', {}, 'つかう人をかえる'),
      h('ul', { class: 'people' }, s.profiles.map((x) => h('li', {},
        h('button', { class: `btn ${x.id === p.id ? 'primary' : ''}`, onclick: () => { switchProfile(x.id); show('home'); } },
          `${x.name}（${gradeLabel(x)}） ⭐${x.points}`),
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
if (currentProfile() && !currentProfile().tutorialDone) setTimeout(() => runTutorial(currentProfile()), 1200);
