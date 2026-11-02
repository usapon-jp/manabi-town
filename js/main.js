import {
  GRADES, SUBJECTS, getState, currentProfile, addProfile, switchProfile, updateProfile,
  addPoints, addItem, removeItem, addQuiz, removeQuiz, gradeBucket, gradeLabel, today, daysUntil, save,
} from './store.js';
import { buildDaily, quizQuestions, POINTS_PER_CORRECT, CLEAR_BONUS } from './quests.js';
import { runQuestions } from './runner.js';
import { parseImport } from './importer.js';
import { h, toast, daysLabel } from './ui.js';

const POINTS_HOMEWORK = 20;
const POINTS_TEST = 50;

const panel = document.getElementById('panel');
const hud = document.getElementById('hud');
const bubble = document.getElementById('bubble');
const tabs = document.querySelectorAll('.tabs button');
let world = null;

// null や false の子は入れない
const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
let tab = 'home';

// 3D は読み込みに失敗してもアプリ自体は使えるようにする
import('./world.js')
  .then((m) => {
    world = m.createWorld(document.getElementById('world'));
    world.setActive(tab === 'home');
  })
  .catch(() => { document.getElementById('world').classList.add('no-3d'); });

tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));

function gain(p, n, reason) {
  addPoints(p, n, reason);
  toast(`+${n} ポイント！`);
  world?.celebrate();
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
  } },
  h('p', { class: 'lead' }, message),
  h('label', {}, 'なまえ', name),
  h('label', {}, '学年', grade),
  h('button', { class: 'btn primary', type: 'submit' }, label));
}

// ---- ホーム ----------------------------------------------------------------

function renderHome(p) {
  const dailyDone = !!p.daily[today()];
  const open = p.items.filter((i) => !i.done).sort((a, b) => a.date.localeCompare(b.date));
  const soon = open.find((i) => i.type === 'homework' && daysUntil(i.date) <= 1);
  const test = open.find((i) => i.type === 'test' && daysUntil(i.date) >= 0);
  let words;
  if (!dailyDone) words = 'きょうのクエスト、いっしょにやろう！';
  else if (soon) words = `「${soon.title}」の しめきりが ${daysLabel(daysUntil(soon.date))} だよ`;
  else if (test) words = `${test.subject}のテストまで ${daysLabel(daysUntil(test.date))}。がんばろうね`;
  else words = 'がんばったね！草原でひとやすみしよう';
  fill(bubble, 
    h('p', {}, h('strong', {}, 'ピヨ先生 '), words),
    h('div', { class: 'bubble-actions' },
      !dailyDone ? h('button', { class: 'btn primary', onclick: () => show('quest') }, 'クエストへ') : null,
      h('button', { class: 'btn', onclick: () => show('todo') }, 'やること'),
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
    const canFinish = !isTest || days <= 0;
    return h('li', { class: `item ${isTest ? 'test' : 'homework'} ${days < 0 && !i.done ? 'late' : ''}` },
      h('div', { class: 'item-main' },
        h('span', { class: 'chip' }, isTest ? 'テスト' : '宿題'),
        h('span', { class: 'chip soft' }, i.subject),
        h('p', { class: 'item-title' }, i.title),
        i.range ? h('p', { class: 'item-range' }, `はんい: ${i.range}`) : null,
      ),
      h('div', { class: 'item-side' },
        h('span', { class: 'days' }, i.done ? 'おわり' : daysLabel(days)),
        !i.done && canFinish ? h('button', { class: 'btn small primary', onclick: () => {
          i.done = true;
          save();
          gain(p, isTest ? POINTS_TEST : POINTS_HOMEWORK, isTest ? `テスト: ${i.title}` : `宿題: ${i.title}`);
          render();
        } }, isTest ? 'おわった！' : 'だした！') : null,
        h('button', { class: 'link', onclick: () => {
          if (confirm(`「${i.title}」をけしますか？`)) { removeItem(p, i.id); render(); }
        } }, 'けす'),
      ),
    );
  };

  const type = h('select', {}, h('option', { value: 'homework' }, '宿題'), h('option', { value: 'test' }, 'テスト'));
  const subject = h('select', {}, SUBJECTS.map((s) => h('option', { value: s }, s)));
  const title = h('input', { type: 'text', placeholder: 'れい: 漢字ドリル p.12〜15', required: true });
  const range = h('input', { type: 'text', placeholder: 'テストのはんい（なくてもOK）' });
  const date = h('input', { type: 'date', value: today(), required: true });
  const form = h('form', { class: 'card form', onsubmit: (e) => {
    e.preventDefault();
    if (!title.value.trim() || !date.value) return;
    addItem(p, { type: type.value, subject: subject.value, title: title.value.trim(), range: range.value.trim(), date: date.value });
    toast('ついかしたよ');
    render();
  } },
  h('h3', {}, 'ついかする'),
  h('div', { class: 'row' }, h('label', {}, 'しゅるい', type), h('label', {}, 'きょうか', subject)),
  h('label', {}, 'なに？', title),
  h('label', {}, 'はんい', range),
  h('label', {}, 'しめきり・テストの日', date),
  h('button', { class: 'btn primary', type: 'submit' }, 'ついか'));

  fill(panel, 
    h('h2', {}, 'やること'),
    open.length ? h('ul', { class: 'items' }, open.map(card)) : h('p', { class: 'empty' }, 'いまは やることが ないよ。下からついかしてね。'),
    form,
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
      h('button', { class: 'link', onclick: () => {
        if (confirm(`「${quiz.title}」をけしますか？`)) { removeQuiz(p, quiz.id); render(); }
      } }, 'けす'),
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
    h('p', { class: 'note' }, 'お試し版のデータは、この端末のブラウザの中だけに保存されます。'),
  );
}

render();
