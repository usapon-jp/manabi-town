// おとなモード（保護者が自分のために使う）。
// - ルーティーン: 毎日（または決まった曜日）のチェック。1こ5ポイント
// - 目標・資格: ふつうの「目標」「試験」と同じしくみで、しめきりまで毎日の分に割りふる
// - ピヨと相談: 何をやるか・どのくらいやるかを会話で決めて、ルーティーンと目標をまとめて入れる（Haiku, action: consult）
// 子ども用の漢字・算数クエストは出さない。3D・タイマー・BGMは共通。
import { h, toast, daysLabel } from './ui.js';
import { save, today, daysUntil, addItem, toISO } from './store.js';
import { askAI, aiErrorText } from './ai.js';
import { icon } from './icons.js';

export const ROUTINE_POINTS = 5;
export const CONSULT_BONUS = 30;
export const ADULT_SUBJECTS = ['資格・勉強', '仕事', '健康', 'くらし', 'しゅみ', 'その他'];
export const WHEN = ['あさ', 'ひる', 'よる'];
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function isAdult(p) { return p?.grade === 'adult'; }

function routines(p) {
  if (!Array.isArray(p.routines)) p.routines = [];
  return p.routines;
}
function doneMap(p, day = today()) {
  if (!p.routineLog || typeof p.routineLog !== 'object') p.routineLog = {};
  return p.routineLog[day] || {};
}

// きょうの曜日にやるルーティーン
export function todayRoutines(p) {
  const dow = new Date().getDay();
  const done = doneMap(p);
  const order = (r) => (WHEN.indexOf(r.when) + 1) || 9;
  return routines(p)
    .filter((r) => !r.days?.length || r.days.includes(dow))
    .sort((a, b) => order(a) - order(b))
    .map((r) => ({ kind: 'routine', r, label: r.title, tag: r.when ? `ルーティーン・${r.when}` : 'ルーティーン', done: !!done[r.id] }));
}

// チェックをつける・はずす。つけたら true
export function toggleRoutine(p, r) {
  const day = today();
  const map = { ...doneMap(p, day) };
  const on = !map[r.id];
  if (on) map[r.id] = true; else delete map[r.id];
  p.routineLog[day] = map;
  // 古い記録は60日分だけ
  const keys = Object.keys(p.routineLog).sort();
  keys.slice(0, Math.max(0, keys.length - 60)).forEach((k) => delete p.routineLog[k]);
  return on;
}

export function addRoutine(p, { title, days = [], when = '' }) {
  const t = String(title || '').trim().slice(0, 30);
  if (!t) return null;
  const r = { id: uid(), title: t, days: days.filter((d) => d >= 0 && d < 7), when: WHEN.includes(when) ? when : '' };
  routines(p).push(r);
  save();
  return r;
}

export function removeRoutine(p, id) {
  p.routines = routines(p).filter((r) => r.id !== id);
  save();
}

const daysText = (days) => (!days?.length || days.length === 7 ? '毎日' : days.slice().sort().map((d) => WEEK[d]).join('・'));

// この30日で何日ルーティーンを ぜんぶ できたか（積み上がりを見せる）
function fullDays(p) {
  const list = routines(p);
  if (!list.length) return 0;
  let n = 0;
  const now = new Date();
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const want = list.filter((r) => !r.days?.length || r.days.includes(d.getDay()));
    const done = (p.routineLog || {})[toISO(d)] || {};
    if (want.length && want.every((r) => done[r.id])) n += 1;
  }
  return n;
}

// ---- ルーティーンのタブ（子どもの「クエスト」の場所） -------------------------

export function renderRoutineTab(panel, p, deps) {
  const list = todayRoutines(p);
  const doneN = list.filter((t) => t.done).length;
  const check = (t) => {
    const on = toggleRoutine(p, t.r);
    if (on) deps.gain(p, ROUTINE_POINTS, `ルーティーン: ${t.r.title}`);
    else deps.addPoints(p, -ROUTINE_POINTS, `とりけし: ${t.r.title}`);
    if (on && todayRoutines(p).every((x) => x.done)) toast('きょうのルーティーン ぜんぶ できました！');
    save();
    deps.render();
  };

  const title = h('input', { type: 'text', maxlength: 30, placeholder: 'れい: ストレッチ5分', required: true });
  const picked = new Set();
  let when = '';
  const dayPicks = h('div', { class: 'picks days' }, WEEK.map((w, i) => {
    const b = h('button', { type: 'button', class: 'pick', onclick: () => {
      if (picked.has(i)) picked.delete(i); else picked.add(i);
      b.classList.toggle('on', picked.has(i));
    } }, w);
    return b;
  }));
  const whenPicks = h('div', { class: 'picks times' }, WHEN.map((w) => {
    const b = h('button', { type: 'button', class: 'pick', onclick: () => {
      when = when === w ? '' : w;
      whenPicks.querySelectorAll('.pick').forEach((x) => x.classList.toggle('on', x.textContent === when));
    } }, w);
    return b;
  }));
  const form = h('form', { class: 'card form', onsubmit: (e) => {
    e.preventDefault();
    if (!addRoutine(p, { title: title.value, days: [...picked], when })) return;
    toast('ルーティーンに入れました');
    deps.render();
  } },
  h('h3', {}, 'ルーティーンを足す'),
  h('label', {}, 'なにを', title),
  h('p', { class: 'hint' }, '曜日（えらばなければ毎日）'),
  dayPicks,
  h('p', { class: 'hint' }, '時間帯（なくてもOK）'),
  whenPicks,
  h('button', { class: 'btn primary', type: 'submit' }, '足す'));

  const all = routines(p);
  panel.replaceChildren(...[
    h('h2', {}, 'ルーティーン'),
    consultCta(p, deps),
    h('div', { class: 'card quest' },
      h('h3', {}, `きょうの分 ${doneN} / ${list.length}`),
      list.length
        ? h('ul', { class: 'tasks' }, list.map((t) => h('li', { class: `task ${t.done ? 'checked' : ''}` },
          h('button', { class: 'check', 'aria-label': t.done ? 'もどす' : 'できた', onclick: () => check(t) }, t.done ? icon('check') : ''),
          h('button', { class: 'task-label', onclick: () => check(t) }, h('span', { class: 'chip soft' }, t.r.when || 'いつでも'), ` ${t.label}`))))
        : h('p', { class: 'empty' }, all.length ? 'きょうの曜日の ルーティーンは ありません' : 'まだ ありません。下で足すか、ピヨと相談して決めましょう'),
      all.length ? h('p', { class: 'cleared' }, `この30日で ぜんぶできた日: ${fullDays(p)}日`) : null),
    form,
    all.length ? h('details', { class: 'card form' },
      h('summary', {}, `入れているルーティーン（${all.length}）`),
      h('ul', { class: 'items' }, all.map((r) => h('li', { class: 'item' },
        h('div', { class: 'item-main' }, h('p', { class: 'item-title' }, r.title), h('p', { class: 'item-range' }, `${daysText(r.days)}${r.when ? `・${r.when}` : ''}`)),
        h('div', { class: 'item-side' }, deps.deleteButton(() => { removeRoutine(p, r.id); deps.render(); })))))) : null,
  ].filter(Boolean));
}

// 「ピヨと相談して決める」ボタン
export function consultCta(p, deps) {
  const first = !p.consultAt;
  return h('button', { class: 'plan-cta', onclick: () => openConsult(p, deps) },
    icon('sparkles'), h('span', {},
      h('b', {}, first ? 'ピヨと相談して やることを決める' : 'ピヨと相談して 見なおす'),
      h('small', {}, first ? `ルーティーンや目標を いっしょに決めます・+${CONSULT_BONUS}` : 'ふやす・へらす・変えるも 相談できます')));
}

// ---- ピヨと相談（Haiku） ------------------------------------------------------

function contextText(p) {
  const r = routines(p).map((x) => `ルーティーン: ${x.title}（${daysText(x.days)}${x.when ? `・${x.when}` : ''}）`);
  const g = p.items.filter((i) => !i.done).slice(0, 12)
    .map((i) => `${i.type === 'test' ? '試験' : '目標'} ${i.subject} ${i.title} ${i.range || ''}（${daysLabel(daysUntil(i.date))}）`);
  return [...r, ...g].join('\n');
}

const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && daysUntil(String(s)) >= 0 && daysUntil(String(s)) <= 400;

function cleanPlan(plan) {
  const routinesOut = (Array.isArray(plan?.routines) ? plan.routines : []).filter((x) => x && x.title).slice(0, 8).map((x) => ({
    title: String(x.title).slice(0, 30),
    days: (Array.isArray(x.days) ? x.days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d < 7),
    when: WHEN.includes(x.when) ? x.when : '',
  }));
  const goals = (Array.isArray(plan?.goals) ? plan.goals : []).filter((x) => x && x.title).slice(0, 5).map((x) => {
    const date = validDate(x.date) ? String(x.date) : toISO(new Date(Date.now() + 30 * 86400000));
    return {
      type: x.type === 'test' ? 'test' : 'goal',
      subject: ADULT_SUBJECTS.includes(x.subject) ? x.subject : 'その他',
      title: String(x.title).slice(0, 40),
      range: String(x.range || '').slice(0, 40),
      minutes: Math.min(120, Math.max(5, Number(x.minutes) || 15)),
      date,
    };
  });
  return { routines: routinesOut, goals, memo: String(plan?.memo || '').slice(0, 160) };
}

export function openConsult(p, deps) {
  const messages = [];
  let busy = false;
  const log = h('div', { class: 'chat-log' });
  const choices = h('div', { class: 'chat-choices' });
  const input = h('input', { type: 'text', maxlength: 160, placeholder: '自由に書いてもOK', enterkeyhint: 'send' });
  const form = h('form', { class: 'chat-input', onsubmit: (e) => { e.preventDefault(); say(input.value); } },
    input, h('button', { class: 'chat-send', type: 'submit', 'aria-label': 'おくる' }, icon('send')));
  const close = () => { layer.remove(); document.body.classList.remove('running'); };
  const layer = h('div', { class: 'chat' },
    h('div', { class: 'chat-top' },
      h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 36, height: 36 }),
      h('b', {}, 'ピヨと相談'),
      h('button', { class: 'chat-close', 'aria-label': 'とじる', onclick: close }, icon('x'))),
    log, h('div', { class: 'chat-foot' }, choices, form));
  document.body.append(layer);
  document.body.classList.add('running');

  const bubble = (role, text) => {
    const b = h('div', { class: `msg ${role}` }, text);
    log.append(b);
    log.scrollTop = log.scrollHeight;
    return b;
  };

  async function turn() {
    busy = true;
    choices.replaceChildren();
    const wait = bubble('assistant thinking', 'かんがえ中…');
    try {
      const r = await askAI({ action: 'consult', name: p.name, today: today(), current: contextText(p), memo: p.consultMemo || '', messages }, { timeout: 30000 });
      wait.remove();
      if (r.say) { messages.push({ role: 'assistant', text: r.say }); bubble('assistant', r.say); }
      if (r.done && r.plan) { propose(cleanPlan(r.plan)); return; }
      choices.replaceChildren(...(r.choices || []).map((c) => h('button', { type: 'button', class: 'pick', onclick: () => say(c) }, c)),
        messages.length > 4 ? h('button', { type: 'button', class: 'pick', onclick: () => say('ここまでで まとめて') }, 'ここで まとめる') : null);
    } catch (e) {
      wait.remove();
      bubble('assistant err', aiErrorText(e).replace('ヒント', '相談'));
      choices.replaceChildren(h('button', { type: 'button', class: 'pick', onclick: () => turn() }, 'もういちど'));
    }
    busy = false;
  }

  function say(text) {
    const t = String(text || '').trim();
    if (!t || busy) return;
    input.value = '';
    messages.push({ role: 'user', text: t });
    bubble('user', t);
    turn();
  }

  // まとまった案。入れるものを えらんで「これで はじめる」
  function propose(plan) {
    busy = false;
    const keepR = plan.routines.map(() => true);
    const keepG = plan.goals.map(() => true);
    const row = (label, sub, arr, i) => {
      const b = h('button', { type: 'button', class: 'pick on', onclick: () => { arr[i] = !arr[i]; b.classList.toggle('on', arr[i]); } },
        h('b', {}, label), sub ? h('small', {}, ` ${sub}`) : null);
      return b;
    };
    const box = h('div', { class: 'plan-sum' },
      plan.routines.length ? h('small', {}, 'ルーティーン') : null,
      h('div', { class: 'picks' }, plan.routines.map((r, i) => row(r.title, `${daysText(r.days)}${r.when ? `・${r.when}` : ''}`, keepR, i))),
      plan.goals.length ? h('small', {}, '目標・試験') : null,
      h('div', { class: 'picks' }, plan.goals.map((g, i) => row(g.title, `毎日${g.minutes}分・${g.date.slice(5).replace('-', '/')}まで`, keepG, i))));
    const add = () => {
      let n = 0;
      plan.routines.forEach((r, i) => { if (keepR[i] && addRoutine(p, r)) n += 1; });
      plan.goals.forEach((g, i) => { if (keepG[i]) { addItem(p, g); n += 1; } });
      const first = !p.consultAt;
      p.consultAt = today();
      if (plan.memo) p.consultMemo = plan.memo;
      if (first) deps.gain(p, CONSULT_BONUS, 'ピヨと相談'); else save();
      close();
      toast(n ? `${n}こ 入れました。ホームに出ます` : '入れませんでした');
      deps.render();
    };
    form.remove();
    choices.replaceChildren(box,
      h('button', { type: 'button', class: 'btn primary', onclick: add }, icon('check'), ' これで はじめる'),
      h('button', { type: 'button', class: 'link', onclick: () => { choices.replaceChildren(); layer.querySelector('.chat-foot').append(form); say('もう少し 変えたい'); } }, 'もう少し 相談する'));
  }

  turn();
}
