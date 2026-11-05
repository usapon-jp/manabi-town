// おとなモード（保護者が自分のために使う）。
// - ルーティーン: 毎日（または決まった曜日）のチェック。1こ5ポイント
//   「週◯回」のルーティーンは、やれた日にスタンプ。今週の回数・何週つづけて達成したかを見せて、達成でボーナス
// - 目標・資格: ふつうの「目標」「試験」と同じしくみで、しめきりまで毎日の分に割りふる
// - ピヨと相談: 何をやるか・どのくらいやるかを会話で決めて、ルーティーンと目標をまとめて入れる（Haiku, action: consult）
// 子ども用の漢字・算数クエストは出さない。3D・タイマー・BGMは共通。
import { h, toast, daysLabel } from './ui.js';
import { save, today, daysUntil, addItem, toISO } from './store.js';
import { askAI, aiErrorText } from './ai.js';
import { icon } from './icons.js';
import { ADULT_DEFAULT as ADULT_SUBJECTS } from './subjects.js';

export const ROUTINE_POINTS = 5;
export const WEEK_BONUS = 30;           // 週◯回を達成したときの はじめの値（ルーティーンごとに なおせる）
const BONUS_CHOICES = [10, 20, 30, 50, 100];
export const CONSULT_BONUS = 30;
export const WHEN = ['あさ', 'ひる', 'よる'];
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const WEEK_MON = ['月', '火', '水', '木', '金', '土', '日'];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function isAdult(p) { return p?.grade === 'adult'; }

function routines(p) {
  if (!Array.isArray(p.routines)) p.routines = [];
  return p.routines;
}
function logOf(p) {
  if (!p.routineLog || typeof p.routineLog !== 'object') p.routineLog = {};
  return p.routineLog;
}
function doneMap(p, day = today()) { return logOf(p)[day] || {}; }

const weekly = (r) => Math.min(7, Math.max(0, Number(r.weekly) || 0));
const bonusOf = (r) => (Number.isFinite(Number(r.bonus)) ? Math.max(0, Number(r.bonus)) : WEEK_BONUS);

// 週は月曜はじまり
function mondayOf(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)); }
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
function weekDates(monday) { return Array.from({ length: 7 }, (_, i) => toISO(addDays(monday, i))); }

// その週に何日やれたか
function weekCount(p, r, monday = mondayOf(new Date())) {
  const log = logOf(p);
  return weekDates(monday).filter((iso) => log[iso]?.[r.id]).length;
}

// 何週つづけて達成しているか（今週がまだなら 先週までを数える）
export function weekStreak(p, r) {
  const n = weekly(r);
  if (!n) return 0;
  let monday = mondayOf(new Date());
  let s = weekCount(p, r, monday) >= n ? 1 : 0;
  for (let i = 0; i < 52; i += 1) {
    monday = addDays(monday, -7);
    if (weekCount(p, r, monday) >= n) s += 1; else break;
  }
  return s;
}

// きょう出すルーティーン。週◯回は、今週の分が終わっていなければ毎日出す（きょうやった分は チェックつきで残す）
export function todayRoutines(p) {
  const dow = new Date().getDay();
  const done = doneMap(p);
  const order = (r) => (WHEN.indexOf(r.when) + 1) || 9;
  return routines(p)
    .filter((r) => (weekly(r) ? (done[r.id] || weekCount(p, r) < weekly(r)) : (!r.days?.length || r.days.includes(dow))))
    .sort((a, b) => order(a) - order(b))
    .map((r) => {
      const n = weekly(r);
      const tag = n ? `週${n}回・こんしゅう ${weekCount(p, r)}/${n}` : r.when ? `ルーティーン・${r.when}` : 'ルーティーン';
      return { kind: 'routine', r, label: r.title, tag, done: !!done[r.id] };
    });
}

// チェックをつける・はずす。つけたら true
export function toggleRoutine(p, r) {
  const day = today();
  const map = { ...doneMap(p, day) };
  const on = !map[r.id];
  if (on) map[r.id] = true; else delete map[r.id];
  const log = logOf(p);
  log[day] = map;
  // 古い記録は400日分だけ（何週つづいたかを数えるため）
  const keys = Object.keys(log).sort();
  keys.slice(0, Math.max(0, keys.length - 400)).forEach((k) => delete log[k]);
  return on;
}

// 今週の達成と ボーナスを そろえる（チェックしたとき・目標回数をなおしたとき）
// 達成していて まだなら ボーナスをすぐ入れる。下回ったら もどす。ポイントと しるしは いっしょに保存する
function reconcileWeek(p, r, deps) {
  const wk = toISO(mondayOf(new Date()));
  if (!p.routineAwards || typeof p.routineAwards !== 'object') p.routineAwards = {};
  const award = { ...(p.routineAwards[wk] || {}) };
  const n = weekly(r);
  const met = n > 0 && weekCount(p, r) >= n;
  if (met && award[r.id] == null) {
    const b = bonusOf(r);
    award[r.id] = b;
    p.routineAwards[wk] = award;
    if (b) deps.gain(p, b, `週${n}回 達成: ${r.title}`);
    setTimeout(() => toast(`「${r.title}」今週の 目標 達成！${b ? ` +${b}` : ''}`), 900);
  } else if (!met && award[r.id] != null) {
    if (award[r.id]) deps.addPoints(p, -award[r.id], `とりけし: 週の目標 達成（${r.title}）`);
    delete award[r.id];
    p.routineAwards[wk] = award;
  }
  // 古い週のボーナス記録は 12週分だけ
  const ks = Object.keys(p.routineAwards).sort();
  ks.slice(0, Math.max(0, ks.length - 12)).forEach((k) => delete p.routineAwards[k]);
}

// ポイントもふくめて チェックする（ホームとルーティーンのタブで共通）
// deps: { gain, addPoints }
export function checkRoutine(p, r, deps) {
  const on = toggleRoutine(p, r);
  if (on) deps.gain(p, ROUTINE_POINTS, `ルーティーン: ${r.title}`);
  else deps.addPoints(p, -ROUTINE_POINTS, `とりけし: ${r.title}`);
  reconcileWeek(p, r, deps);
  save();
  return on;
}

function cleanRoutine({ title, days = [], when = '', weekly: w = 0, bonus }) {
  const t = String(title || '').trim().slice(0, 30);
  if (!t) return null;
  const n = Math.min(7, Math.max(0, Math.round(Number(w) || 0)));
  return {
    title: t,
    days: n ? [] : (Array.isArray(days) ? days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d < 7),
    when: WHEN.includes(when) ? when : '',
    weekly: n,
    bonus: n ? (Number.isFinite(Number(bonus)) ? Math.max(0, Math.round(Number(bonus))) : WEEK_BONUS) : 0,
  };
}

export function addRoutine(p, fields) {
  const c = cleanRoutine(fields);
  if (!c) return null;
  const r = { id: uid(), ...c };
  routines(p).push(r);
  save();
  return r;
}

export function updateRoutine(p, r, fields, deps) {
  const c = cleanRoutine(fields);
  if (!c) return false;
  Object.assign(r, c);
  if (deps) reconcileWeek(p, r, deps);   // 目標回数を変えたら、今週の達成と ボーナスも そろえる
  save();
  return true;
}

export function removeRoutine(p, id) {
  p.routines = routines(p).filter((r) => r.id !== id);
  save();
}

const daysText = (days) => (!days?.length || days.length === 7 ? '毎日' : days.slice().sort().map((d) => WEEK[d]).join('・'));
const routineText = (r) => (weekly(r) ? `週${weekly(r)}回・達成で+${bonusOf(r)}` : daysText(r.days)) + (r.when ? `・${r.when}` : '');

// この30日で何日 毎日のルーティーンを ぜんぶ できたか（週◯回のものは べつに数える）
function fullDays(p) {
  const list = routines(p).filter((r) => !weekly(r));
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

// ---- ルーティーンの入力（足す・なおす で共通） -----------------------------------

function routineForm(r, onSave, onCancel) {
  const title = h('input', { type: 'text', maxlength: 30, placeholder: 'れい: イラストを1枚かく', required: true, value: r?.title || '' });
  let mode = r && weekly(r) ? 'weekly' : 'days';
  let n = (r && weekly(r)) || 3;
  let bonus = r ? bonusOf(r) : WEEK_BONUS;
  let when = r?.when || '';
  const picked = new Set(r?.days || []);

  const seg = h('div', { class: 'seg' });
  const daysBox = h('div', {});
  const weeklyBox = h('div', {});
  const paint = () => {
    seg.replaceChildren(
      h('button', { type: 'button', class: mode === 'days' ? 'on' : '', onclick: () => { mode = 'days'; paint(); } }, '曜日できめる'),
      h('button', { type: 'button', class: mode === 'weekly' ? 'on' : '', onclick: () => { mode = 'weekly'; paint(); } }, '週に◯回'));
    daysBox.hidden = mode !== 'days';
    weeklyBox.hidden = mode !== 'weekly';
    daysBox.replaceChildren(
      h('p', { class: 'hint' }, '曜日（えらばなければ毎日）'),
      h('div', { class: 'picks days' }, WEEK.map((w, i) => h('button', { type: 'button', class: `pick ${picked.has(i) ? 'on' : ''}`, onclick: () => { if (picked.has(i)) picked.delete(i); else picked.add(i); paint(); } }, w))));
    weeklyBox.replaceChildren(
      h('p', { class: 'hint' }, '1週間に 何回？（やれた日に スタンプ）'),
      h('div', { class: 'picks days' }, [1, 2, 3, 4, 5, 6, 7].map((x) => h('button', { type: 'button', class: `pick ${n === x ? 'on' : ''}`, onclick: () => { n = x; paint(); } }, `${x}`))),
      h('p', { class: 'hint' }, '達成したときの ボーナス'),
      h('div', { class: 'picks times' }, BONUS_CHOICES.map((x) => h('button', { type: 'button', class: `pick ${bonus === x ? 'on' : ''}`, onclick: () => { bonus = x; paint(); } }, `+${x}`))));
    whenPicks.replaceChildren(...WHEN.map((w) => h('button', { type: 'button', class: `pick ${when === w ? 'on' : ''}`, onclick: () => { when = when === w ? '' : w; paint(); } }, w)));
  };
  const whenPicks = h('div', { class: 'picks times' });
  paint();
  return h('form', { class: 'card form routine-form', onsubmit: (e) => {
    e.preventDefault();
    onSave({ title: title.value, days: mode === 'days' ? [...picked] : [], when, weekly: mode === 'weekly' ? n : 0, bonus });
  } },
  h('h3', {}, r ? 'ルーティーンを なおす' : 'ルーティーンを足す'),
  h('label', {}, 'なにを', title),
  seg, daysBox, weeklyBox,
  h('p', { class: 'hint' }, '時間帯（なくてもOK）'),
  whenPicks,
  h('div', { class: 'row' },
    h('button', { class: 'btn primary', type: 'submit' }, r ? 'ほぞん' : '足す'),
    onCancel ? h('button', { class: 'btn', type: 'button', onclick: onCancel }, 'やめる') : null));
}

// 週◯回のカード: 今週のスタンプ・回数・何週つづいたか・この8週のグラフ
function weeklyCard(p, r, check) {
  const n = weekly(r);
  const monday = mondayOf(new Date());
  const t = today();
  const log = logOf(p);
  const count = weekCount(p, r);
  const streakN = weekStreak(p, r);
  const doneToday = !!log[t]?.[r.id];
  const stamps = h('div', { class: 'week' }, weekDates(monday).map((iso, i) => h('div', { class: `day ${log[iso]?.[r.id] ? 'done' : ''} ${iso === t ? 'today' : ''} ${iso > t ? 'future' : ''}` },
    h('span', { class: 'stamp' }, log[iso]?.[r.id] ? icon('check') : ''), h('small', {}, WEEK_MON[i]))));
  const hist = Array.from({ length: 8 }, (_, i) => {
    const m = addDays(monday, -7 * (7 - i));
    return { c: weekCount(p, r, m), now: i === 7, label: `${m.getMonth() + 1}/${m.getDate()}` };
  });
  const top = Math.max(n, ...hist.map((x) => x.c));
  const chart = h('div', { class: 'wk-chart', style: `--g:${n / top}` },
    hist.map((x) => h('div', { class: `wk-col ${x.c >= n ? 'met' : ''} ${x.now ? 'now' : ''}` },
      h('i', { style: `height:${(x.c / top) * 100}%` }), h('small', {}, x.now ? '今週' : x.label))));
  return h('div', { class: `card weekly-card ${count >= n ? 'met' : ''}` },
    h('div', { class: 'wk-head' },
      h('b', {}, r.title),
      h('span', { class: 'wk-count' }, h('b', {}, `${count}`), ` / ${n}回`)),
    h('div', { class: 'wk-bar' }, Array.from({ length: n }, (_, i) => h('i', { class: i < count ? 'on' : '' }))),
    h('p', { class: 'wk-sub' }, count >= n ? `今週 達成！ +${bonusOf(r)}` : `あと${n - count}回で 達成・+${bonusOf(r)}`,
      streakN ? h('span', { class: 'wk-streak' }, icon('flame'), ` ${streakN}週 つづけて達成`) : null),
    stamps,
    h('button', { class: `btn ${doneToday ? '' : 'primary'}`, onclick: () => check(r) }, doneToday ? 'きょうのスタンプを もどす' : [icon('check'), ' きょう できた！ スタンプ']),
    chart);
}

// ---- ルーティーンのタブ（子どもの「クエスト」の場所） -------------------------

export function renderRoutineTab(panel, p, deps) {
  const list = todayRoutines(p).filter((t) => !weekly(t.r));
  const doneN = list.filter((t) => t.done).length;
  const check = (r) => {
    const on = checkRoutine(p, r, deps);
    if (on && !weekly(r) && todayRoutines(p).filter((x) => !weekly(x.r)).every((x) => x.done)) toast('きょうのルーティーン ぜんぶ できました！');
    deps.render();
  };
  const all = routines(p);
  const weeklies = all.filter(weekly);
  const daily = all.filter((r) => !weekly(r));
  let editing = null;

  const addForm = routineForm(null, (f) => {
    if (!addRoutine(p, f)) return;
    toast('ルーティーンに入れました');
    deps.render();
  });

  const row = (r) => {
    const li = h('li', { class: 'item' },
      h('div', { class: 'item-main' }, h('p', { class: 'item-title' }, r.title), h('p', { class: 'item-range' }, routineText(r))),
      h('div', { class: 'item-side' },
        h('button', { class: 'link', onclick: () => {
          if (editing) return;
          editing = r;
          li.replaceWith(h('li', { class: 'item editing' }, routineForm(r, (f) => {
            if (updateRoutine(p, r, f, deps)) toast('なおしました');
            deps.render();
          }, () => deps.render())));
        } }, 'なおす'),
        deps.deleteButton(() => { removeRoutine(p, r.id); deps.render(); })));
    return li;
  };

  panel.replaceChildren(...[
    h('h2', {}, 'ルーティーン'),
    consultCta(p, deps),
    ...weeklies.map((r) => weeklyCard(p, r, check)),
    daily.length || !weeklies.length ? h('div', { class: 'card quest' },
      h('h3', {}, `きょうの分 ${doneN} / ${list.length}`),
      list.length
        ? h('ul', { class: 'tasks' }, list.map((t) => h('li', { class: `task ${t.done ? 'checked' : ''}` },
          h('button', { class: 'check', 'aria-label': t.done ? 'もどす' : 'できた', onclick: () => check(t.r) }, t.done ? icon('check') : ''),
          h('button', { class: 'task-label', onclick: () => check(t.r) }, h('span', { class: 'chip soft' }, t.r.when || 'いつでも'), ` ${t.label}`))))
        : h('p', { class: 'empty' }, all.length ? 'きょうの曜日の ルーティーンは ありません' : 'まだ ありません。下で足すか、ピヨと相談して決めましょう'),
      daily.length ? h('p', { class: 'cleared' }, `この30日で ぜんぶできた日: ${fullDays(p)}日`) : null) : null,
    addForm,
    all.length ? h('details', { class: 'card form' },
      h('summary', {}, `入れているルーティーン（${all.length}）・なおす`),
      h('ul', { class: 'items' }, all.map(row))) : null,
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
  const r = routines(p).map((x) => `ルーティーン: ${x.title}（${routineText(x)}${weekly(x) ? `・今週${weekCount(p, x)}回` : ''}）`);
  const g = p.items.filter((i) => !i.done).slice(0, 12)
    .map((i) => `${i.type === 'test' ? '試験' : '目標'} ${i.subject} ${i.title} ${i.range || ''}（${daysLabel(daysUntil(i.date))}）`);
  return [...r, ...g].join('\n');
}

const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && daysUntil(String(s)) >= 0 && daysUntil(String(s)) <= 400;

function cleanPlan(plan) {
  const routinesOut = (Array.isArray(plan?.routines) ? plan.routines : []).filter((x) => x && x.title).slice(0, 8)
    .map((x) => cleanRoutine({ title: x.title, days: x.days, when: x.when, weekly: x.weekly })).filter(Boolean);
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

// ピヨが文の中に「- 5分くらい」のように候補を書いてきたときは、文から抜いてボタンにする
const LIST_LINE = /^\s*(?:[-‐−ー・•*●○◯]|\d{1,2}[.)．）、])\s*(.+?)\s*$/;
export function splitChoices(say, choices) {
  const keep = [];
  const found = [];
  for (const line of String(say || '').split('\n')) {
    const m = line.match(LIST_LINE);
    if (m && m[1].length <= 40) found.push(m[1]); else keep.push(line);
  }
  const text = keep.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const all = [...(Array.isArray(choices) ? choices : []), ...found].map((c) => String(c).trim()).filter(Boolean);
  return { text: text || String(say || '').trim(), choices: [...new Set(all)] };
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
      const s = splitChoices(r.say, r.choices);
      if (r.say) { messages.push({ role: 'assistant', text: r.say }); bubble('assistant', s.text); }
      if (r.done && r.plan) { propose(cleanPlan(r.plan)); return; }
      choices.replaceChildren(...s.choices.map((c) => h('button', { type: 'button', class: 'pick', onclick: () => say(c) }, c)),
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
      h('div', { class: 'picks' }, plan.routines.map((r, i) => row(r.title, routineText(r), keepR, i))),
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
