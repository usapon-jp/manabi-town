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
import { shuffle, seededRandom } from './quests.js';
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
// 先生にわたす メモ（漢字の 出し方も。教科の へんしゅうで かえたときも 伝わるように）
function profileText(p) {
  return [coachText(p.coach), kanjiWriteOnly(p) && '漢字の出し方: 書きとりだけ（読みの問題は出さない）'].filter(Boolean).join('\n');
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
    kanji: r.kanji === 'write' || r.kanji === 'both' ? r.kanji : '',   // 漢字の 出し方（書きとりだけ / 読みも）
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

// 「その他」で 入れた テスト（保健体育・音楽・美術・技術家庭など）は タイトルから 教科名を とる
const OTHER_NAMES = ['保健体育', '技術家庭', '技術・家庭', '音楽', '美術', '保体', '技家', '家庭科', '技術', '家庭', '体育', '保健', '道徳', '書写'];
function subjName(i) {
  const s = String(i.subject || '').trim();
  if (s && s !== 'その他') return s;
  return OTHER_NAMES.find((n) => String(i.title || '').includes(n)) || String(i.title || s).replace(/^\S*期末\s*|^\S*中間\s*/, '').trim().slice(0, 10) || s;
}

// 国語は 漢字の範囲を 先に（長い範囲で 漢字の所が 切れないように）
const rangeText = (r, core) => (core !== 'kanji' ? r
  : String(r).split(/[／/]/).sort((a, b) => Number(/漢字/.test(b)) - Number(/漢字/.test(a))).join('／'));

function testExtras(p, own) {
  if (!p.coach || p.grade === 'adult') return [];
  const t = today();
  // 作戦会議で 決めた範囲（先の日から はじめるものも）が ある教科は 自動にしない
  const have = new Set([...own, ...(p.coach.daily?.extra || []).filter((x) => !x.until || x.until >= t)].map(subjKey).filter(Boolean));
  const out = [];
  (p.items || []).filter((i) => i.type === 'test' && !i.done && i.date >= t && i.subject && daysUntil(i.date) <= TEST_DAYS)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((i) => {
      const subject = subjName(i);
      const core = subjOf({ subject, topic: i.title });
      const k = core || subject;
      if (!k || have.has(k)) return;
      const days = Math.max(1, daysUntil(i.date));
      if (!core && days > OTHER_DAYS) return;
      have.add(k);
      out.push({
        subject, topic: `${i.title}${i.range ? ` ${rangeText(i.range, core)}` : ''}`.slice(0, 60), until: i.date,
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
  return activeExtras(p).filter((x) => poolOf(p, x).length < sizeOf(x));
}

// 漢字の範囲は 1つの ことばを 1回だけ（「循環」ばかり 何度も 出ないように）
// 問題文の「…」の ことばと 正解の ことばで くらべる
const termsOf = (q) => [...String(q.q).matchAll(/[「『]([^」』]{1,12})[」』]/g)].map((m) => m[1].trim())
  .concat(String(q.options?.[q.answer] ?? '').trim()).filter((w) => w.length >= 2);
// 漢字の範囲の 一問一答は「スマホ(紙)に 書く → お手本 → 自分で ○×」に（読みと 漢字が とれるときだけ）
const KANA = /^[ぁ-んァ-ヶー]+$/;
const HAS_KANJI = /[一-龯々]/;
export function kanjiWrite(q) {
  // 例文つきで 作った問題（s: ことばを ＿ にした文、r: よみ、w: 漢字）
  if (q.s && q.r && q.w && KANA.test(q.r) && HAS_KANJI.test(q.w)) {
    return { kind: 'write', prompt: 'かんじで 書けるかな？', big: q.r, answerText: q.w, context: q.s, selfCheck: true };
  }
  // 「鉄がさびる」の「さび」を… → 聞いている ことばは さいごの「」、例文は それを ふくむ ほかの「」
  const quotes = (String(q.q).match(/[「『][^」』]{1,30}[」』]/g) || []).map((m) => m.slice(1, -1).trim());
  const term = quotes.length ? quotes[quotes.length - 1] : '';
  const ans = String(q.options?.[q.answer] ?? '').trim();
  if (!term || term.length > 12 || !ans || ans.length > 8) return null;
  let reading; let word;
  if (KANA.test(term) && HAS_KANJI.test(ans)) { reading = term; word = ans; }
  else if (HAS_KANJI.test(term) && KANA.test(ans) && term.length <= 8) { reading = ans; word = term; }
  else return null;
  // 例文が ないと 同じ読みの漢字（錆・寂など）と 区別できないので、問題文に 文が あるときだけ 書きとりに
  const sentence = quotes.find((m) => m !== term && m.includes(term));
  if (!sentence) return null;
  return { kind: 'write', prompt: 'かんじで 書けるかな？', big: reading, answerText: word, context: sentence.replace(term, '＿'), selfCheck: true };
}

// ---- 漢字は「書きとりだけ」 ----------------------------------------------
// 長女 2026-11-09「漢字は 書き取りしか 出ないから 読みは 出さないで」と 作戦会議で 言ったのに 読みが 出た
// p.kanjiStyle: 'write'（書きとりだけ）| 'both'（読みも）。作戦会議（profile.kanji）か 教科の へんしゅうで きめる。
// まだ きめていなければ、作戦会議の メモ・進め方の ことばから よみとる（前の会議で 言っていた ときも 効くように）
const WRITE_ONLY = /(書き取り|書きとり|かきとり)(だけ|のみ|しか)|(読み|よみ)[^。]{0,8}(出さない|ださない|出さず|いらない|なし|出ない|でない|出ません|でません)/;
export function kanjiWriteOnly(p) {
  if (!p || p.grade === 'adult') return false;
  if (p.kanjiStyle) return p.kanjiStyle === 'write';
  const c = p.coach || {};
  return WRITE_ONLY.test([c.memo, c.style, ...(c.plans || []).map((x) => `${x.subject} ${x.how}`)].join('\n'));
}
export function setKanjiStyle(p, style) {
  p.kanjiStyle = style === 'write' ? 'write' : 'both';
  save();
}
// 読みを 聞く 問題（「よみかたは？」・漢字を見せて ひらがなを えらぶ）
const READ_ASK = /よみかた|読み方|(読み|よみ)(は|を|が|として)|なんと読|何と読|どう読/;
const QUOTED_KANJI = /[「『][^」』]*[一-龯々][^」』]*[」』]/;
export function isKanjiRead(q) {
  if (!q || q.kind !== 'choice') return false;
  const pr = String(q.prompt || '');
  if (/(漢字|かんじ)で/.test(pr)) return false;   // 「…を漢字で書くと？」は 書きの問題
  if (READ_ASK.test(pr)) return true;
  const opts = (q.options || []).map((o) => String(o).trim());
  return opts.length > 0 && opts.every((o) => KANA.test(o)) && (HAS_KANJI.test(q.big || '') || QUOTED_KANJI.test(pr));
}
// 書きとりだけの 人には 漢字の 読みの問題を 出さない（デイリー・れんしゅう・見直し どこでも）
export function dropKanjiReads(p, qs) {
  return kanjiWriteOnly(p) ? qs.filter((q) => !(isKanjiRead(q) && (/漢字|国語/.test(q.subject || '') || q.kind === 'choice' && q.prompt === 'よみかたは？'))) : qs;
}

// 範囲の 一問一答 → 出す 形（漢字の範囲は 書きとりに できれば 書きとり）
export const rangeQ = (x, q) => ({ ...(isKanjiRange(x) && kanjiWrite(q) || { kind: 'choice', prompt: q.q, options: q.options, answer: q.answer }),
  subject: x.subject, topic: x.topic });

export function uniqPool(x, pool) {
  if (!isKanjiRange(x)) return pool;
  const seen = new Set();
  return pool.filter((q) => {
    const ws = termsOf(q);
    if (ws.some((w) => seen.has(w))) return false;
    ws.forEach((w) => seen.add(w));
    return true;
  });
}
// 書きとりだけの 人の 漢字の範囲は、読みの問題を のぞいて 数える（たりなければ 書きの問題を 作りたす）
const writeOnlyRange = (p, x) => isKanjiRange(x) && kanjiWriteOnly(p);
// 作った 一問一答の もと（しりょうの写真・作り方）。かわったら 作りなおす
// k2: 2026-11-09 漢字の範囲を 作りなおす（「級別漢字 P96〜」の ページ番号だけで 作っていて、小学校の漢字「質問」などが まざっていた）
const KANJI_POOL_V = 'k2';
const poolSig = (x) => [isKanjiRange(x) ? KANJI_POOL_V : '', ...(x.photos || [])].filter(Boolean).join('|');
function rawPool(p, x) {
  const c = p.coach;
  if (!c) return [];
  const k = poolKey(x);
  const sig = poolSig(x);
  if ((c.poolSrc?.[k] ?? '') !== sig) {
    // テストの しりょうに 写真を 足した・作り方が かわった 範囲は、前の問題を すてて 作りなおす
    if (c.pools?.[k]) { c.pools = { ...c.pools }; delete c.pools[k]; }
    c.poolSrc = { ...(c.poolSrc || {}), [k]: sig };
    save();
  }
  return (c.pools || {})[k] || [];
}
export const poolOf = (p, x) => {
  // 読みを のぞいてから 同じ ことばを まとめる（読みの問題に 書きの問題が けされないように）
  const pool = rawPool(p, x);
  return uniqPool(x, writeOnlyRange(p, x) ? pool.filter((q) => !isKanjiRead(rangeQ(x, q))) : pool);
};

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
    const have = poolOf(p, x);
    const need = sizeOf(x) - have.length;
    if (need <= 0) return true;
    const r = await askAI({ action: 'quiz', pool: true, kanji: isKanjiRange(x), ...(writeOnlyRange(p, x) ? { writeOnly: true } : {}), subject: x.subject, grade: gradeLabel(p), topic: x.topic, count: Math.min(CHUNK, need),
      avoid: ((isKanjiRange(x) ? '（漢字は 1つの ことばを 1回だけ。範囲の いろいろな ことばから。下の ことばは もう使わない）\n' : '') +
        (writeOnlyRange(p, x) ? '（テストは 書きとりだけ。読みを 聞く問題は 作らない。ぜんぶ 例文の よみを 漢字で書く問題に）\n' : '') + have.map((q) => q.q).join('\n')).slice(0, 2500), ...(images.length ? { images: images.slice(0, 3) } : {}) }, { timeout: 90000 });
    const seen = new Set(have.map((q) => q.q));
    const qs = (r.questions || []).filter(okQ)
      .map((q) => ({ q: String(q.q).slice(0, 200), options: q.options.slice(0, 4).map((o) => String(o).slice(0, 60)), answer: q.answer,
        ...(typeof q.s === 'string' && q.s.includes('＿') ? { s: q.s.slice(0, 60), r: String(q.r || '').slice(0, 12), w: String(q.w || '').slice(0, 8) } : {}) }))
      .filter((q) => !seen.has(q.q));
    if (!qs.length) return have.length > 0;
    p.coach.pools = { ...(p.coach.pools || {}), [poolKey(x)]: uniqPool(x, [...have, ...qs]) };
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

// 1つの範囲だけ 作る（デイリーを 教科ごとに はじめるとき。ほかの教科を またない）
const makingOne = new Map();
export function ensurePool(p, x) {
  if (poolOf(p, x).length >= sizeOf(x)) return Promise.resolve(true);
  const k = `${p.id}|${poolKey(x)}`;
  if (makingOne.has(k)) return makingOne.get(k);
  const job = fillPool(p, x).catch(() => false).then((ok) => { save(); return ok; }).finally(() => makingOne.delete(k));
  makingOne.set(k, job);
  return job;
}
export const hasPool = (p, x) => poolOf(p, x).length > 0;

// テスト前は「漢字・英単語・計算」の れんしゅうも テスト範囲から（長女 2026-11-09「漢字を やったら 範囲じゃないのが 出た」）
// core: 'kanji' | 'english' | 'math'。範囲が なければ null（ふだんの 学年の問題）
export const rangeFor = (p, core) => (p?.grade === 'adult' ? null : activeExtras(p).find((x) => subjOf(x) === core) || null);
export async function rangeDrill(p, x, n, seedText) {
  if (!hasPool(p, x)) { toast('ピヨ先生が テスト範囲の問題を 作り中…', 8000); await ensurePool(p, x); }
  return shuffle(poolOf(p, x), seededRandom(seedText)).slice(0, n)
    .map((q) => ({ ...rangeQ(x, q), test: true }));
}

// きょうの extra の問題。日にちで perDay もんずつ ずらして、ぜんぶ出たら また はじめから（何周も）
// テストの範囲（テスト日まで の範囲・テスト予定から 自動）→ 問題に「テストに出るよ」ハンコ
export const isTestRange = (x) => !!(x.auto || x.until);

export function extraQuestions(p, key = today()) {
  const day = Math.floor(Date.parse(`${key}T00:00:00Z`) / 86400000);
  return activeExtras(p).flatMap((x) => {
    const pool = poolOf(p, x);
    if (!pool.length) return [];
    const n = Math.min(perDayOf(x), pool.length);
    const start = (day * n) % pool.length;
    return Array.from({ length: n }, (_, i) => pool[(start + i) % pool.length])
      .map((q) => ({ ...rangeQ(x, q), ...(isTestRange(x) ? { test: true } : {}) }));
  });
}

// ---- まちがえた問題の ストック → テスト前の 見直しワーク ----------------------
const missKey = (q) => `${q.topic}|${q.prompt}|${q.big || ''}`;

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
  return (p.coach?.misses || []).filter((m) => keys.has(m.q.topic) && dropKanjiReads(p, [m.q]).length).sort((a, b) => b.n - a.n);
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
      const r = await askAI({ action: 'plan', today: today(), name: p.name, grade: gradeLabel(p), items: itemsText(p), profile: profileText(p), messages: msgs, images }, { timeout: images.length ? 90000 : 45000 });
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
    const daily = profile.daily ? profile.daily : (p.coach?.daily ? { ...p.coach.daily, extra: (p.coach.daily.extra || []).map((x) => ({ ...x })) } : null);
    // 写真を おくったときの ことば（と その前の ことば）に 出てくる 教科 → その教科の 範囲・テストに ひもづける
    // （ピヨ先生が まとめで photo を つけわすれても、「国語の 漢字の ページ」と 言って 見せた写真は のこる）
    const said = messages.flatMap((m, k) => (m.photoId && !m.photoId.startsWith('tmp-')
      ? [{ id: m.photoId, text: `${messages[k - 1]?.role === 'user' ? messages[k - 1].text : ''} ${m.text}` }] : []));
    const talksAbout = (text, subject, topic = '') => !!subject && (text.includes(subject)
      || (/国語|漢字/.test(`${subject}${topic}`) && /漢字|国語/.test(text)));
    const mentioned = (x) => said.filter((s) => talksAbout(s.text, x.subject, x.topic)).map((s) => s.id);
    // 範囲（extra）に 写真を ひもづける。ピヨ先生が「この写真の範囲」と言った範囲・写真と いっしょに 教科を 言った範囲には この会議の写真、ほかは 前の写真を そのまま
    if (daily) {
      daily.extra = daily.extra.map((x) => {
        const old = prevExtra.find((o) => poolKey(o) === poolKey(x));
        const named = mentioned(x);
        const photos = x.photo && ids.length ? ids
          : named.length ? [...new Set([...(old?.photos || x.photos || []), ...named])].slice(-SEND_PHOTOS) : (old?.photos || x.photos || []);
        delete x.photo;
        // 写真が かわった範囲は、前に作った問題を すてて 写真から 作りなおす
        if (photos.join() !== (old?.photos || []).join()) delete pools[poolKey(x)];
        return { ...x, photos };
      });
      // 写真は テストの フォルダへ（テストの日が 同じ 予定が あれば）
      daily.extra.forEach((x) => {
        const test = x.until && p.items.find((i) => i.type === 'test' && !i.done && i.date === x.until);
        // 範囲が 空の テストには 作戦会議で 決めた 範囲を 書いておく（ホームの「テスト範囲を 入れてね」が きえる）
        if (test && !String(test.range || '').trim() && (!test.subject || test.subject === x.subject || test.subject === 'その他')) test.range = x.topic;
        if (test) x.photos.forEach((id) => { const meta = (p.photos || []).find((m) => m.id === id); if (meta && meta.folder === 'other') movePhoto(p, id, test.id); });
      });
    }
    // 教科を 言って 見せた写真は、その教科の テストの しりょうへ（テスト予定から 自動で 作る 範囲も 写真から 作れるように）
    said.forEach((s) => {
      const meta = (p.photos || []).find((m) => m.id === s.id);
      if (!meta || meta.folder !== 'other') return;
      const test = p.items.filter((i) => i.type === 'test' && !i.done && daysUntil(i.date) >= 0 && talksAbout(s.text, i.subject && i.subject !== 'その他' ? i.subject : i.title))
        .sort((x, y) => x.date.localeCompare(y.date))[0];
      if (test) movePhoto(p, s.id, test.id);
    });
    // 漢字の 出し方を 話したときだけ かえる（話さなければ 前のまま）
    if (profile.kanji) p.kanjiStyle = profile.kanji;
    // デイリーの話をしなかったときは 前の きまりを そのまま。作った一問一答も のこす
    p.coach = { ...profile, daily, pools, poolSrc: { ...(p.coach?.poolSrc || {}) }, misses: p.coach?.misses || [], checks: p.coach?.checks || [], at: today() };
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

  // 「範囲を 入れてね」から ひらいたときは、言うことを 入れておく（写真を そえて おくるだけ）
  if (deps.ask) input.value = deps.ask;
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
