// ピヨ先生との「作戦会議」。はじめに1回（あとで やりなおしもできる）。
// - 進め方（毎日少しずつ？まとめて？何分集中できる？）、とくい・にがて、いまの宿題やテストの進め方を聞く
// - さいごに決めた単元で「理解度チェック」（3もんずつ）。できなかった単元は にがてクエストに
// - 決まったことは p.coach に保存して、あとの計画に使う
// 会話だけ Sonnet（受け口の action: plan）。問題づくりは Haiku（action: quiz）。
import { h, toast, daysLabel } from './ui.js';
import { save, gradeLabel, daysUntil, today } from './store.js';
import { askAI, aiErrorText } from './ai.js';
import { runQuestions } from './runner.js';
import { recordResults } from './review.js';
import { weakList } from './tests.js';
import { icon } from './icons.js';
import { pickPhoto } from './pickphoto.js';
import { shrink } from './scan.js';
import { openPhotos, addPhoto, getData, movePhoto } from './photos.js';

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
    c.daily && `デイリー: ${dailyLabel(c)}`,
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
    daily: cleanDaily(r.daily),
    memo: String(r.memo || '').slice(0, 160),
  };
}

// ---- デイリーの中身（作戦会議で きめる） ------------------------------------
// p.coach.daily = { base: ['kanji','english','math'] の一部, extra: [{ subject, topic, until, perDay, size }] }
// extra は ピヨ先生（Haiku）が 一問一答を size もん作り（p.coach.pools）、毎日 perDay もんずつ 順番に出す（何周も）。
// 量は 作戦会議で ピヨ先生が「テストに間に合う量」を提案して 子どもと決める。
// まちがえた問題は つぎの日の デイリーに もういちど出し（review.js）、p.coach.misses に ためて テスト前の「見直しワーク」にする
export const BASE = [['kanji', '漢字'], ['english', '英単語'], ['math', '算数・数学']];
const CHUNK = 15;               // 1回で作る数（受け口の上限）
const clampN = (v, lo, hi, d) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || d));

function cleanDaily(d) {
  if (!d || typeof d !== 'object') return null;
  const base = (Array.isArray(d.base) ? d.base : []).filter((b) => BASE.some(([id]) => id === b));
  const extra = (Array.isArray(d.extra) ? d.extra : []).filter((x) => x && x.subject && x.topic).slice(0, 6)
    .map((x) => ({
      subject: String(x.subject).slice(0, 10), topic: String(x.topic).slice(0, 60),
      until: /^\d{4}-\d{2}-\d{2}$/.test(String(x.until)) ? String(x.until) : '',
      from: /^\d{4}-\d{2}-\d{2}$/.test(String(x.from)) ? String(x.from) : '',   // この日から出す（「3日前から」など）
      perDay: clampN(x.perDay, 1, 30, 5), size: clampN(x.size, 10, 60, 20),
      photo: x.photo === true,   // この会議で 見せた写真が この範囲のもの
    }));
  if (!base.length && !extra.length) return null;
  return { base: [...new Set(base)], extra };
}

export const poolKey = (x) => `${x.subject}:${x.topic}`;
const sizeOf = (x) => x.size || CHUNK;
const perDayOf = (x) => x.perDay || 3;

// テスト前は、テスト予定（9教科ぜんぶ）から 範囲の一問一答を 自動で足す。
// 国語・英語・数学は 14日まえから（デイリーの 学年3もんと 入れかえ）、ほかの教科は 7日まえから 1日3もん。
// 作戦会議で その教科の範囲を 決めていれば そちらを使う。写真は その テストの しりょうフォルダから
const TEST_DAYS = 14;
const OTHER_DAYS = 7;
const AUTO_SIZE = 30;
const OTHER_SIZE = 15;
// デイリーの 決まった教科 → 置きかえる テスト教科
const BASE_SUBJ = { kanji: /国語|漢字/, english: /英語/, math: /数学|算数/ };
const subjOf = (x) => Object.keys(BASE_SUBJ).find((b) => BASE_SUBJ[b].test(x.subject) || (b === 'kanji' && /漢字/.test(x.topic)));
const subjKey = (x) => subjOf(x) || String(x.subject || '').trim();
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

function testExtras(p, own) {
  if (!p.coach || p.grade === 'adult') return [];
  const t = today();
  // 作戦会議で 決めた範囲（先の日から はじめるものも）が ある教科は 自動にしない
  const have = new Set([...own, ...(p.coach.daily?.extra || []).filter((x) => !x.until || x.until >= t)].map(subjKey).filter(Boolean));
  const out = [];
  (p.items || []).filter((i) => i.type === 'test' && !i.done && i.date >= t && i.subject && daysUntil(i.date) <= TEST_DAYS)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((i) => {
      const core = subjOf({ subject: i.subject, topic: i.title });
      const k = core || i.subject.trim();
      if (!k || have.has(k)) return;
      const days = Math.max(1, daysUntil(i.date));
      if (!core && days > OTHER_DAYS) return;
      have.add(k);
      out.push({
        subject: i.subject, topic: `${i.title}${i.range ? ` ${i.range}` : ''}`.slice(0, 60), until: i.date,
        ...(core
          ? { size: AUTO_SIZE, perDay: Math.min(10, Math.max(3, Math.ceil((AUTO_SIZE * 3) / days))) }
          : { size: OTHER_SIZE, perDay: 3, from: addDays(i.date, -OTHER_DAYS) }),
        photos: (p.photos || []).filter((m) => m.folder === i.id).map((m) => m.id).slice(-3), auto: true,
      });
    });
  return out;
}

// いま有効な extra（until をすぎたものは はずす）＋ テスト前の 自動の範囲
export function activeExtras(p) {
  const t = today();
  const own = (p.coach?.daily?.extra || []).filter((x) => (!x.until || x.until >= t) && (!x.from || x.from <= t));
  return [...own, ...testExtras(p, own)];
}

// デイリーに入れる 決まった教科（作戦会議で決めていなければ 3つとも）
// 範囲の一問一答が ある教科は、学年の 3もんの かわりに 範囲の問題を出す（漢字→国語、英単語→英語、算数→数学）
export const isKanjiRange = (x) => subjOf(x) === 'kanji';
export function dailyBase(p) {
  const base = p.coach?.daily ? p.coach.daily.base : BASE.map(([id]) => id);
  const ranged = new Set(activeExtras(p).map(subjOf).filter(Boolean));
  return base.filter((b) => !ranged.has(b));
}

// p があれば 置きかえ・自動の範囲も入れた いまの デイリー
export function dailyLabel(c, p) {
  const d = c?.daily;
  if (!d && !p) return '';
  const base = p ? dailyBase(p) : d.base;
  const t = today();
  const extra = p ? activeExtras(p) : d.extra.filter((x) => (!x.until || x.until >= t) && (!x.from || x.from <= t));
  const later = (d?.extra || []).filter((x) => x.from && x.from > t && (!x.until || x.until >= t));
  const md = (s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
  return [...base.map((b) => `${BASE.find(([id]) => id === b)[1]} 3もん`),
    ...extra.map((x) => `${x.subject}「${x.topic}」${perDayOf(x)}もん${x.auto ? '（テスト前）' : ''}`),
    ...later.map((x) => `${x.subject}「${x.topic}」${perDayOf(x)}もん（${md(x.from)}から）`)].join('・');
}

// 一問一答が まだ たりない extra
export function missingPools(p) {
  return activeExtras(p).filter((x) => ((p.coach.pools || {})[poolKey(x)] || []).length < sizeOf(x));
}

const okQ = (q) => q && q.q && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length;

// 範囲に ひもづけた しりょうの写真（作戦会議で 見せたもの）を 読み出す
async function rangePhotos(x) {
  const out = [];
  for (const id of (x.photos || []).slice(-3)) { const d = await getData(id).catch(() => null); if (d) out.push(d); }
  return out;
}

// 1つの範囲を size もんまで 作る（15もんずつ。前に作った問題は さけてもらう）
// 写真は 範囲に ひもづけた しりょう（x.photos）を使う。この端末に まだ なければ images（作戦会議の その場の写真）
async function fillPool(p, x, images = []) {
  const saved = await rangePhotos(x);
  if (saved.length) images = saved;
  for (let i = 0; i < 5; i++) {
    const have = (p.coach.pools || {})[poolKey(x)] || [];
    const need = sizeOf(x) - have.length;
    if (need <= 0) return true;
    const r = await askAI({ action: 'quiz', pool: true, subject: x.subject, grade: gradeLabel(p), topic: x.topic, count: Math.min(CHUNK, need),
      avoid: have.map((q) => q.q).join('\n').slice(0, 2500), ...(images.length ? { images: images.slice(0, 3) } : {}) }, { timeout: 90000 });
    const seen = new Set(have.map((q) => q.q));
    const qs = (r.questions || []).filter(okQ)
      .map((q) => ({ q: String(q.q).slice(0, 200), options: q.options.slice(0, 4).map((o) => String(o).slice(0, 60)), answer: q.answer }))
      .filter((q) => !seen.has(q.q));
    if (!qs.length) return have.length > 0;
    p.coach.pools = { ...(p.coach.pools || {}), [poolKey(x)]: [...have, ...qs] };
    save();
  }
  return true;
}

const making = new Map();   // プロフィールごとに、作っている とちゅうの しごと
// images: 作戦会議で見せた 範囲の写真（あれば その中身から 作る）
export function ensurePools(p, images = []) {
  const need = missingPools(p);
  if (!need.length) return Promise.resolve(true);
  if (making.has(p.id)) return making.get(p.id);
  const job = Promise.all(need.map((x) => fillPool(p, x, images).catch(() => false)))
    .then((oks) => { save(); return oks.every(Boolean); })
    .finally(() => { making.delete(p.id); });
  making.set(p.id, job);
  return job;
}

// きょうの extra の問題。日にちで perDay もんずつ ずらして、ぜんぶ出たら また はじめから（何周も）
// テストの範囲（テスト日まで の範囲・テスト予定から 自動）→ 問題に「テストに出るよ」ハンコ
export const isTestRange = (x) => !!(x.auto || x.until);

export function extraQuestions(p, key = today()) {
  const day = Math.floor(Date.parse(`${key}T00:00:00Z`) / 86400000);
  return activeExtras(p).flatMap((x) => {
    const pool = (p.coach.pools || {})[poolKey(x)] || [];
    if (!pool.length) return [];
    const n = Math.min(perDayOf(x), pool.length);
    const start = (day * n) % pool.length;
    return Array.from({ length: n }, (_, i) => pool[(start + i) % pool.length])
      .map((q) => ({ kind: 'choice', subject: x.subject, prompt: q.q, options: q.options, answer: q.answer, topic: x.topic, ...(isTestRange(x) ? { test: true } : {}) }));
  });
}

// ---- まちがえた問題の ストック → テスト前の 見直しワーク ----------------------
const missKey = (q) => `${q.topic}|${q.prompt}`;

// デイリーで まちがえた 一問一答を ためる（同じ問題は 回数だけ ふやす）
export function stockMisses(p, results) {
  if (!p.coach) return;
  const keys = new Set(activeExtras(p).map((x) => x.topic));
  const misses = Array.isArray(p.coach.misses) ? p.coach.misses : (p.coach.misses = []);
  results.filter((r) => !r.ok && r.q?.topic && keys.has(r.q.topic)).forEach(({ q }) => {
    const found = misses.find((m) => missKey(m.q) === missKey(q));
    if (found) { found.n += 1; found.at = today(); }
    else misses.push({ q: JSON.parse(JSON.stringify(q)), n: 1, at: today() });
  });
  if (misses.length > 200) misses.splice(0, misses.length - 200);
}

// 見直しワークに出す問題（まだ テスト前の 範囲だけ。たくさん まちがえた順）
export function missWork(p) {
  const keys = new Set(activeExtras(p).map((x) => x.topic));
  return (p.coach?.misses || []).filter((m) => keys.has(m.q.topic)).sort((a, b) => b.n - a.n);
}

// いちばん近い テストの日まで あと何日（見直しワークを 目立たせる）
export function daysToTest(p) {
  const t = today();
  const ds = activeExtras(p).map((x) => x.until).filter(Boolean).sort();
  return ds.length ? Math.round((Date.parse(ds[0]) - Date.parse(t)) / 86400000) : null;
}

// 作戦会議の とちゅうの会話は p.planChat に のこす（とじても つづきから。写真は しりょうに入れて id だけ）
// p.planChat = { at: 'YYYY-MM-DD', messages: [{ role, text, photoId? }], choices: [] }
const CHAT_KEEP_DAYS = 21;
const SEND_PHOTOS = 3;     // 受け口に わたす 写真は 新しい 3まいまで

function savedChat(p) {
  const c = p.planChat;
  if (!c || !Array.isArray(c.messages) || !c.messages.length) return null;
  if (Math.round((Date.parse(today()) - Date.parse(c.at)) / 86400000) > CHAT_KEEP_DAYS) return null;
  return c;
}

export function openPlanChat(p, deps) {
  const messages = [];          // { role: 'assistant'|'user', text, photoId? }
  const pics = new Map();       // photoId → dataUrl（この会議で 見せた写真）
  let lastChoices = [];
  let photo = null;             // まだ送っていない写真
  let photoId = null;           // しりょうから えらんだときは その id（もういちど しりょうに 入れない）
  let busy = false;
  const log = h('div', { class: 'chat-log' });
  const choices = h('div', { class: 'chat-choices' });
  const input = h('input', { type: 'text', maxlength: 120, placeholder: 'じぶんの ことばで 書いてもOK', enterkeyhint: 'send' });
  const send = h('button', { class: 'chat-send', type: 'submit', 'aria-label': 'おくる' }, icon('send'));
  const thumb = h('div', { class: 'ask-thumb', hidden: true });
  const showThumb = () => {
    thumb.hidden = !photo;
    thumb.replaceChildren(...(photo ? [h('img', { src: photo, alt: '' }), h('button', { type: 'button', 'aria-label': '写真をはずす', onclick: () => { photo = null; photoId = null; showThumb(); } }, icon('x'))] : []));
  };
  const takePhoto = async (f) => {
    if (!f) return;
    try { photo = await shrink(f); photoId = null; } catch { toast('この写真は 開けなかった'); return; }
    showThumb();
  };
  const camBtn = h('button', { type: 'button', class: 'chat-cam', 'aria-label': '写真を 入れる', onclick: () => {
    pickPhoto(takePhoto, { title: '範囲の プリントや ワークの 写真' });
  } }, icon('camera'));
  const libBtn = h('button', { type: 'button', class: 'chat-cam', 'aria-label': 'しりょうから えらぶ', onclick: () => {
    openPhotos(p, { pick: 1, onPick: (urls, ids) => { if (urls[0]) { photo = urls[0]; photoId = ids?.[0] || null; showThumb(); } } });
  } }, icon('folder'));
  const form = h('form', { class: 'chat-input', onsubmit: (e) => { e.preventDefault(); say(input.value); } }, camBtn, libBtn, input, send);
  const close = () => { layer.remove(); document.body.classList.remove('running'); };
  const layer = h('div', { class: 'chat' },
    h('div', { class: 'chat-top' },
      h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 36, height: 36 }),
      h('b', {}, 'ピヨ先生と 作戦会議'),
      h('button', { class: 'chat-close', 'aria-label': 'とじる', onclick: close }, icon('x'))),
    log, h('div', { class: 'chat-foot' }, choices, thumb, form));
  document.body.append(layer);
  document.body.classList.add('running');   // 3Dを休ませる

  function bubble(role, text, img) {
    const b = h('div', { class: `msg ${role}` }, img ? h('img', { class: 'ask-photo', src: img, alt: '' }) : null, text);
    log.append(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  // とちゅうの会話を のこす（とじても、つぎに ひらいたら つづきから）
  function keep() {
    p.planChat = { at: today(), messages: messages.slice(-40).map((m) => ({ role: m.role, text: m.text, ...(m.photoId ? { photoId: m.photoId } : {}) })), choices: lastChoices };
    save();
  }

  function showChoices(list) {
    lastChoices = list || [];
    choices.replaceChildren(...lastChoices.map((c) => h('button', { type: 'button', class: 'pick', onclick: () => say(c) }, c)));
  }

  // 受け口に わたす形: 新しい写真 3まいだけ 画像で、それより前の写真は「（前に見せた写真）」と ことばで
  function payload() {
    const ids = [...new Set(messages.filter((m) => m.photoId && pics.get(m.photoId)).map((m) => m.photoId))].slice(-SEND_PHOTOS);
    const images = ids.map((id) => pics.get(id));
    const msgs = messages.map((m) => {
      const i = m.photoId ? ids.indexOf(m.photoId) : -1;
      if (i >= 0) return { role: m.role, text: m.text, photo: i };
      return { role: m.role, text: m.photoId ? `（前に見せた写真）${m.text}` : m.text };
    });
    return { msgs, images };
  }

  async function turn() {
    busy = true;
    choices.replaceChildren();
    const wait = bubble('assistant thinking', 'かんがえ中…');
    try {
      const { msgs, images } = payload();
      const r = await askAI({ action: 'plan', today: today(), name: p.name, grade: gradeLabel(p), items: itemsText(p), profile: coachText(p.coach), messages: msgs, images }, { timeout: images.length ? 90000 : 45000 });
      wait.remove();
      if (!r.say && !(r.done && r.profile)) throw new Error('empty');
      if (r.say) { messages.push({ role: 'assistant', text: r.say }); bubble('assistant', r.say); }
      if (r.done && r.profile) { finish(cleanProfile(r.profile)); return; }
      showChoices(r.choices || []);
      keep();
    } catch (e) {
      wait.remove();
      const again = h('button', { type: 'button', class: 'pick', onclick: () => turn() }, 'もういちど');
      bubble('assistant err', aiErrorText(e).replace('ヒント', 'おはなし'));
      choices.replaceChildren(again);
    }
    busy = false;
  }

  async function say(text) {
    const t = String(text || '').trim();
    if ((!t && !photo) || busy) return;
    busy = true;
    input.value = '';
    const img = photo;
    let id = photoId;
    photo = null; photoId = null; showThumb();
    const m = { role: 'user', text: t || '（写真を 見て）' };
    if (img) {
      // 撮った写真は しりょう（ほかの しりょう）に入れておく。範囲が きまったら テストの フォルダへ うつす
      if (!id) { try { id = await addPhoto(p, { dataUrl: img, label: '作戦会議' }); } catch { id = `tmp-${Date.now()}`; } }
      pics.set(id, img);
      m.photoId = id;
    }
    messages.push(m);
    bubble('user', t, img);
    keep();
    busy = false;
    turn();
  }

  // 作戦会議で 見せた写真（新しい順に 3まい）
  const chatPhotoIds = () => [...new Set(messages.filter((m) => m.photoId && !m.photoId.startsWith('tmp-')).map((m) => m.photoId))].slice(-SEND_PHOTOS);

  function finish(profile) {
    const first = !p.coach;
    const prevExtra = p.coach?.daily?.extra || [];
    const pools = { ...(p.coach?.pools || {}) };
    const ids = chatPhotoIds();
    const daily = profile.daily || p.coach?.daily || null;
    // 範囲（extra）に 写真を ひもづける。ピヨ先生が「この写真の範囲」と言った範囲には この会議の写真、ほかは 前の写真を そのまま
    if (profile.daily) {
      daily.extra = daily.extra.map((x) => {
        const old = prevExtra.find((o) => poolKey(o) === poolKey(x));
        const photos = x.photo && ids.length ? ids : (old?.photos || []);
        delete x.photo;
        // 写真が かわった範囲は、前に作った問題を すてて 写真から 作りなおす
        if (photos.join() !== (old?.photos || []).join()) delete pools[poolKey(x)];
        return { ...x, photos };
      });
      // 写真は テストの フォルダへ（テストの日が 同じ 予定が あれば）
      daily.extra.forEach((x) => {
        const test = x.until && p.items.find((i) => i.type === 'test' && !i.done && i.date === x.until);
        if (test) x.photos.forEach((id) => { const meta = (p.photos || []).find((m) => m.id === id); if (meta && meta.folder === 'other') movePhoto(p, id, test.id); });
      });
    }
    // デイリーの話をしなかったときは 前の きまりを そのまま。作った一問一答も のこす
    p.coach = { ...profile, daily, pools, misses: p.coach?.misses || [], checks: p.coach?.checks || [], at: today() };
    p.planChat = null;   // まとまったので 会話は おしまい（決まったことは p.coach に のこる）
    const imgs = ids.map((id) => pics.get(id)).filter(Boolean);
    if (activeExtras(p).length) ensurePools(p, imgs).then((ok) => toast(ok ? 'デイリーの 問題が できたよ！' : 'デイリーの 問題が うまく作れなかった…クエストを ひらくと もういちど 作るよ'));
    if (first) deps.gain(p, PLAN_BONUS, '作戦会議'); else save();
    form.remove();
    choices.replaceChildren(...[
      h('p', { class: 'plan-next' }, 'つぎは きょうの クエストで ためしてみよう！'),
      deps.startDaily
        ? h('button', { type: 'button', class: 'btn primary', onclick: () => { close(); deps.render(); deps.startDaily(p); } }, icon('play'), ' きょうの クエストを はじめる')
        : null,
      profile.check.length
        ? h('button', { type: 'button', class: deps.startDaily ? 'btn' : 'btn primary', onclick: (e) => { close(); startCheck(p, deps, e.currentTarget); } }, icon('target'), ' 理解度チェックを する（3もんずつ）')
        : null,
      summary(p.coach, p),   // ボタンを 先に（まとめが 長くても ボタンが 画面に 見えるように）
      h('button', { type: 'button', class: 'link', onclick: () => { close(); deps.render(); } }, 'とじる（あとで やる）'),
    ].filter(Boolean));
    if (first) toast(`作戦会議 できた！ +${PLAN_BONUS}`);
    busy = false;
  }

  // 前の とちゅうの会話が あれば、つづきから
  const prev = savedChat(p);
  if (!prev) { turn(); return; }
  (async () => {
    busy = true;
    for (const m of prev.messages) {
      let img = null;
      if (m.photoId) { img = await getData(m.photoId).catch(() => null); if (img) pics.set(m.photoId, img); }
      messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', text: String(m.text || ''), ...(m.photoId ? { photoId: m.photoId } : {}) });
      bubble(m.role === 'assistant' ? 'assistant' : 'user', m.role === 'user' && m.text === '（写真を 見て）' ? '' : m.text, img);
    }
    log.append(h('div', { class: 'msg assistant' }, 'このまえの つづきから はなそう。はじめから にしたいときは 下の ボタンでね'));
    log.scrollTop = log.scrollHeight;
    busy = false;
    const restart = h('button', { type: 'button', class: 'pick', onclick: () => {
      if (busy) return;
      messages.length = 0; pics.clear(); p.planChat = null; save();
      log.replaceChildren(); turn();
    } }, 'はじめから やりなおす');
    showChoices(prev.choices || []);
    choices.append(restart);
    if (messages[messages.length - 1]?.role === 'user') turn();   // 返事を まっていた ところで とじていたら
  })();
}

// 決まったことのまとめ（せっていにも出す）
export function summary(c, p) {
  const row = (label, text) => (text ? h('div', { class: 'plan-row' }, h('small', {}, label), h('span', {}, text)) : null);
  return h('div', { class: 'plan-sum' },
    row('進め方', [c.style, c.when, c.focusMin ? `${c.focusMin}分 集中` : ''].filter(Boolean).join('・')),
    row('とくい', (c.strong || []).join('、')),
    row('にがて', (c.weak || []).join('、')),
    ...(c.plans || []).map((x) => row(x.subject, x.how)),
    row('デイリー', dailyLabel(c, p)),
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
