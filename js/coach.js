// ピヨ先生との「作戦会議」。はじめに1回（あとで やりなおしもできる）。
// - 進め方（毎日少しずつ？まとめて？何分集中できる？）、とくい・にがて、いまの宿題やテストの進め方を聞く
// - さいごに決めた単元で「理解度チェック」（3もんずつ）。できなかった単元は にがてクエストに
// - 決まったことは p.coach に保存して、あとの計画に使う
// 会話だけ Sonnet（受け口の action: plan）。問題づくりは Haiku（action: quiz）。
import { h, toast, daysLabel } from './ui.js';
import { save, gradeLabel, daysUntil } from './store.js';
import { askAI, aiErrorText } from './ai.js';
import { runQuestions } from './runner.js';
import { recordResults } from './review.js';
import { weakList } from './tests.js';
import { icon } from './icons.js';

export const PLAN_BONUS = 50;     // 作戦会議をさいごまでやった
const CHECK_PER_CORRECT = 5;

// いまの予定を、先生にわたす短い文に
function itemsText(p) {
  return p.items.filter((i) => !i.done).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 15)
    .map((i) => `${i.type === 'test' ? 'テスト' : i.type === 'goal' ? '目標' : '宿題'} ${i.subject} ${i.title} ${i.range || ''}（${daysLabel(daysUntil(i.date))}）`)
    .join('\n');
}

// 保存したプロフィールを、先生にわたす短い文に
export function coachText(c) {
  if (!c) return '';
  return [
    c.style && `進め方: ${c.style}`, c.when && `時間: ${c.when}`, c.focusMin && `集中: ${c.focusMin}分`,
    c.strong?.length && `とくい: ${c.strong.join('、')}`, c.weak?.length && `にがて: ${c.weak.join('、')}`,
    ...(c.plans || []).map((x) => `${x.subject}: ${x.how}`),
    ...(c.checks || []).map((x) => `チェック ${x.subject} ${x.topic} ${x.score}/${x.total}`),
    c.memo && `メモ: ${c.memo}`,
  ].filter(Boolean).join('\n');
}

const arr = (v, n = 6) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x).slice(0, n) : []);

function cleanProfile(r) {
  return {
    style: String(r.style || '').slice(0, 80),
    when: String(r.when || '').slice(0, 40),
    focusMin: Math.min(120, Math.max(0, Number(r.focusMin) || 0)),
    strong: arr(r.strong), weak: arr(r.weak),
    plans: (Array.isArray(r.plans) ? r.plans : []).filter((x) => x && x.subject && x.how).slice(0, 8)
      .map((x) => ({ subject: String(x.subject).slice(0, 10), how: String(x.how).slice(0, 80) })),
    check: (Array.isArray(r.check) ? r.check : []).filter((x) => x && x.subject && x.topic).slice(0, 3)
      .map((x) => ({ subject: String(x.subject).slice(0, 10), topic: String(x.topic).slice(0, 40) })),
    memo: String(r.memo || '').slice(0, 160),
  };
}

export function openPlanChat(p, deps) {
  const messages = [];          // { role: 'assistant'|'user', text }
  let busy = false;
  const log = h('div', { class: 'chat-log' });
  const choices = h('div', { class: 'chat-choices' });
  const input = h('input', { type: 'text', maxlength: 120, placeholder: 'じぶんの ことばで 書いてもOK', enterkeyhint: 'send' });
  const send = h('button', { class: 'chat-send', type: 'submit', 'aria-label': 'おくる' }, icon('send'));
  const form = h('form', { class: 'chat-input', onsubmit: (e) => { e.preventDefault(); say(input.value); } }, input, send);
  const close = () => { layer.remove(); document.body.classList.remove('running'); };
  const layer = h('div', { class: 'chat' },
    h('div', { class: 'chat-top' },
      h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 36, height: 36 }),
      h('b', {}, 'ピヨ先生と 作戦会議'),
      h('button', { class: 'chat-close', 'aria-label': 'とじる', onclick: close }, icon('x'))),
    log, h('div', { class: 'chat-foot' }, choices, form));
  document.body.append(layer);
  document.body.classList.add('running');   // 3Dを休ませる

  function bubble(role, text) {
    const b = h('div', { class: `msg ${role}` }, text);
    log.append(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  async function turn() {
    busy = true;
    choices.replaceChildren();
    const wait = bubble('assistant thinking', 'かんがえ中…');
    try {
      const r = await askAI({ action: 'plan', name: p.name, grade: gradeLabel(p), items: itemsText(p), profile: coachText(p.coach), messages }, { timeout: 45000 });
      wait.remove();
      if (r.say) { messages.push({ role: 'assistant', text: r.say }); bubble('assistant', r.say); }
      if (r.done && r.profile) { finish(cleanProfile(r.profile)); return; }
      choices.replaceChildren(...(r.choices || []).map((c) => h('button', { type: 'button', class: 'pick', onclick: () => say(c) }, c)));
    } catch (e) {
      wait.remove();
      const again = h('button', { type: 'button', class: 'pick', onclick: () => turn() }, 'もういちど');
      bubble('assistant err', aiErrorText(e).replace('ヒント', 'おはなし'));
      choices.replaceChildren(again);
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

  function finish(profile) {
    const first = !p.coach;
    p.coach = { ...profile, checks: p.coach?.checks || [], at: new Date().toISOString().slice(0, 10) };
    if (first) deps.gain(p, PLAN_BONUS, '作戦会議'); else save();
    form.remove();
    choices.replaceChildren(
      summary(p.coach),
      profile.check.length
        ? h('button', { type: 'button', class: 'btn primary', onclick: (e) => { close(); startCheck(p, deps, e.currentTarget); } }, icon('target'), ' 理解度チェックを する（3もんずつ）')
        : null,
      h('button', { type: 'button', class: 'link', onclick: () => { close(); deps.render(); } }, 'あとで'));
    if (first) toast(`作戦会議 できた！ +${PLAN_BONUS}`);
    busy = false;
  }

  turn();
}

// 決まったことのまとめ（せっていにも出す）
export function summary(c) {
  const row = (label, text) => (text ? h('div', { class: 'plan-row' }, h('small', {}, label), h('span', {}, text)) : null);
  return h('div', { class: 'plan-sum' },
    row('進め方', [c.style, c.when, c.focusMin ? `${c.focusMin}分 集中` : ''].filter(Boolean).join('・')),
    row('とくい', (c.strong || []).join('、')),
    row('にがて', (c.weak || []).join('、')),
    ...(c.plans || []).map((x) => row(x.subject, x.how)),
    (c.checks || []).length ? row('チェック', c.checks.map((x) => `${x.topic} ${x.score}/${x.total}`).join('、')) : null);
}

// 理解度チェック: 決めた単元ごとに3もん（Haiku）。2もん以下なら にがてクエストに
let checking = false;   // 問題を作っているあいだは、もう一度おしても はじめない
export async function startCheck(p, deps) {
  const list = p.coach?.check || [];
  if (!list.length || checking) return;
  checking = true;
  toast('ピヨ先生が 問題を作り中…', 6000);
  const made = await Promise.all(list.map((c) => askAI({ action: 'quiz', subject: c.subject, grade: gradeLabel(p), topic: c.topic, count: 3 })
    .then((r) => (r.questions || []).filter((q) => q && q.q && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)
      .map((q) => ({ kind: 'choice', subject: c.subject, prompt: String(q.q), options: q.options.map(String), answer: q.answer, topic: c.topic })))
    .catch((e) => { toast(aiErrorText(e)); return []; })));
  checking = false;
  const qs = made.flat();
  if (!qs.length) { toast('うまく問題が作れなかった…あとで もういちど'); return; }
  runQuestions('理解度チェック', qs, (score, total, results) => {
    recordResults(p, results, '理解度チェック');
    const checks = list.map((c) => {
      const mine = results.filter((r) => r.q.topic === c.topic);
      return { ...c, score: mine.filter((r) => r.ok).length, total: mine.length };
    }).filter((c) => c.total);
    p.coach.checks = checks;
    // できなかった単元は にがてクエストへ（同じものがあれば 足さない）
    checks.filter((c) => c.score < c.total * 0.7).forEach((c) => {
      if (!weakList(p).some((w) => !w.done && w.topic === c.topic)) {
        weakList(p).push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, subject: c.subject, topic: c.topic, added: new Date().toISOString().slice(0, 10), done: false });
      }
    });
    const pts = score * CHECK_PER_CORRECT;
    if (pts > 0) deps.gain(p, pts, '理解度チェック'); else save();
    deps.render();
    const weakN = checks.filter((c) => c.score < c.total * 0.7).length;
    return `+${pts} ポイント！${weakN ? ` にがてクエストが ${weakN}こ できたよ` : ' ばっちり！'}`;
  });
}
