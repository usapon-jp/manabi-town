// 町の 銀行。算数の たまごが 孵化して、銀行の 建物が できると ひらく。画面は js/bankui.js、3D は js/eggs3d.js。
//
// きまり（企画 2026-11-15）:
//   - ポイント（つかえる ほう）を あずけると、毎日 すこし ふえる。算数を 勉強すると 銀行が そだち、ふえる 割合が 上がる
//   - やらなかった日に へることは ない。おろすのも いつでも できる
//   - レベル用の けいけんち（p.xp）には さわらない。あずける＝spendPoints、おろす＝p.points を 戻すだけ
//     （おろしても けいけんちは ふえない。レベルや島の ひらく はやさは かわらない）
//   - ふえすぎないよう、あずけられる 上限と、1日に ふえる 上限が ある（レベルごと）
//
// 保存の形（はじまりの島の 入れ物 islandData(p, 'start') の中 = 端末どうしで そろう）:
//   bank = {
//     bankIn: 700,                     // あずけた 合計（ふえる だけ）
//     bankOut: 250,                    // おろした 合計（ふえる だけ）
//     int: { '2026-11-16': 3.2, ... }, // 毎日の 利子。日づけごとに 1回だけ（2台で 同じ日を 開いても 二重に ならない）
//     old: 0,                          // ふるい 利子を まとめた 分
//     min: 95,                         // 算数を 勉強した 分（そだち用。へらない）
//   }
//   ちょきん = bankIn − bankOut + old + 利子の ごうけい。「保存した ちょきん」は 持たず、毎回 ここから 計算する。
//   bankIn / bankOut は 2台の 端末で 別々に ふえても 足しあわせて そろう（js/merge.js）。
import { islandData, START } from './islands.js';
import { featureOpen, registerFeature, eggsOf, eggSubject, studyMinutes } from './eggs.js';
import { today, toISO, spendPoints, save } from './store.js';

// ---- 数字（ためしてから 調整できるように ここに まとめる） ----
export const TUNE = {
  // 銀行レベルごと。算数を 勉強した 分で 上がる（へらない）
  levels: [
    { min: 0,   rate: 1.0, limit: 150,  cap: 2 },    // Lv1: 1日 +1%
    { min: 30,  rate: 1.5, limit: 300,  cap: 5 },
    { min: 90,  rate: 2.0, limit: 500,  cap: 9 },
    { min: 180, rate: 2.5, limit: 800,  cap: 15 },
    { min: 300, rate: 3.0, limit: 1200, cap: 24 },
    { min: 480, rate: 4.0, limit: 2000, cap: 40 },   // Lv6
  ],
  catchUpDays: 60,       // 開かなかった 日の 利子は ここまで さかのぼって つける（へりは しない）
  keepDays: 366,         // 日ごとの 利子の 記録を のこす 数。古い 分は old に まとめる
};
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const r2 = (v) => Math.round(v * 100) / 100;

// ---- 入れ物 ----
export function bankOf(p) {
  const b = p?.world?.isles?.[START]?.bank;
  return plain(b) ? b : null;
}
function own(p) {
  const rec = islandData(p, START);
  if (!plain(rec.bank)) rec.bank = {};
  const b = rec.bank;
  if (!plain(b.int)) b.int = {};
  for (const k of ['bankIn', 'bankOut', 'old', 'min']) if (typeof b[k] !== 'number' || !Number.isFinite(b[k])) b[k] = 0;
  return b;
}

// 銀行が ひらいているか（算数の たまごが 孵化して、銀行の 建物が できた）
export function bankOpen(p) {
  const e = eggsOf(p);
  return !!e && !!e.hatch?.sansu && !!e.built?.sansu && featureOpen(p, 'bank');
}

// ---- レベル ----
// 算数を 勉強した 分（銀行が ひらく 孵化のあとから）。ためた 分は へらさない
export function bankMinutes(p, subjects) {
  const e = eggsOf(p);
  const at = e?.hatch?.sansu;
  const now = at ? studyMinutes(p, eggSubject(p, 'sansu', subjects), at) : 0;
  return Math.max(now, num(bankOf(p)?.min));
}
export function bankLevel(p, subjects) {
  const min = bankMinutes(p, subjects);
  let lv = 0;
  TUNE.levels.forEach((l, i) => { if (min >= l.min) lv = i; });
  const cur = TUNE.levels[lv];
  const nxt = TUNE.levels[lv + 1] || null;
  return {
    lv: lv + 1, max: !nxt, min, rate: cur.rate, limit: cur.limit, cap: cur.cap,
    k: nxt ? Math.min(1, (min - cur.min) / (nxt.min - cur.min)) : 1,   // 次の レベルまでの すすみ（0〜1）
  };
}

// ---- ちょきん ----
export function balance(p) {
  const b = bankOf(p);
  if (!b) return 0;
  const sum = Object.values(plain(b.int) ? b.int : {}).reduce((s, v) => s + num(v), 0);
  return Math.max(0, r2(num(b.bankIn) - num(b.bankOut) + num(b.old) + sum));
}
export const shown = (p) => Math.floor(balance(p));

// 1日ぶんの 利子（レベルの わりあい。上限を こえない）
export function dailyGain(bal, level) {
  if (!(bal > 0)) return 0;
  const raw = bal * level.rate / 100;
  return r2(Math.min(raw, level.cap));
}
// あした ふえる 見こみ { gain, capped }（通帳に 出す）
export function nextGain(p, subjects) {
  const lv = bankLevel(p, subjects);
  const bal = shown(p);
  const raw = bal * lv.rate / 100;
  const mult = Math.round((100 + lv.rate) * 10) / 1000;
  // after: 通帳の 式の 答え（50 × 1.01 = 50.5。切りすてると「= 50」に なって 式が まちがって 見える）
  return { bal, gain: Math.floor(Math.min(raw, lv.cap)), capped: raw > lv.cap, mult, after: r2(bal * mult) };
}

const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return toISO(new Date(y, m - 1, d + n)); };
const lastDay = (b) => Object.keys(b.int).reduce((a, k) => (k > a ? k : a), '');

// 日づけが かわった ぶんの 利子を つける。そだち（min）も ここで 書きとめる。
// つけた 利子の ごうけい を かえす（なければ 0）。ひらいて いなければ 何もしない
export function settle(p, now = Date.now(), subjects) {
  if (!p || !bankOpen(p)) return 0;
  const b = own(p);
  const minNow = bankMinutes(p, subjects);
  if (minNow > b.min) b.min = Math.round(minNow * 10) / 10;
  const level = bankLevel(p, subjects);
  const t = toISO(new Date(now));
  const last = lastDay(b);
  let gained = 0;
  if (last && last < t && balance(p) > 0) {
    let d = addDays(last, 1);
    const from = addDays(t, -TUNE.catchUpDays);
    if (d < from) d = from;
    for (; d <= t; d = addDays(d, 1)) {
      if (b.int[d] != null) continue;           // 同じ日は 1回だけ
      const g = dailyGain(balance(p), level);
      if (!(g > 0)) break;
      b.int[d] = g;
      gained += g;
    }
  }
  fold(b);
  return r2(gained);
}
// 日ごとの 記録が ふえすぎたら、古い 分を old に まとめる
function fold(b) {
  const keys = Object.keys(b.int).sort();
  if (keys.length <= TUNE.keepDays) return;
  for (const k of keys.slice(0, keys.length - TUNE.keepDays)) { b.old = r2(b.old + num(b.int[k])); delete b.int[k]; }
}
// ちょきんが マイナスに なる（2台で 同時におろした など）と 数字が おかしくなるので、0 に もどす
function mend(b) {
  const raw = num(b.bankIn) - num(b.bankOut) + num(b.old) + Object.values(b.int).reduce((s, v) => s + num(v), 0);
  if (raw < 0) b.old = r2(b.old - raw);
}

// いま あずけられる 最大（もっている ポイント と 上限の 空き）
export function canDeposit(p, subjects) {
  const room = Math.max(0, bankLevel(p, subjects).limit - shown(p));
  return Math.max(0, Math.min(Math.floor(p.points || 0), room));
}
export const canWithdraw = (p) => shown(p);

// ---- あずける・おろす ----
export function deposit(p, n, now = Date.now(), subjects) {
  n = Math.floor(n);
  if (!bankOpen(p) || !(n > 0) || n > canDeposit(p, subjects)) return false;
  settle(p, now, subjects);                       // 先に 今日までの 利子を つけてから
  const b = own(p);
  mend(b);
  const t = toISO(new Date(now));
  if (b.int[t] == null) b.int[t] = 0;             // 今日の 利子は もう つけた ことに する（あずけた 日の 分は つかない）
  b.bankIn += n;
  spendPoints(p, n, '銀行に あずけた');         // けいけんち・レベルは へらない（save も ここ）
  return true;
}
export function withdraw(p, n, now = Date.now(), subjects) {
  n = Math.floor(n);
  if (!bankOpen(p) || !(n > 0)) return false;
  settle(p, now, subjects);
  const b = own(p);
  mend(b);
  if (n > shown(p)) return false;
  b.bankOut += n;
  // けいけんちは ふやさない（spend: true の 記録は けいけんち・勉強した日に 数えない）
  p.points += n;
  p.log.unshift({ at: now, n, reason: '銀行から おろした', spend: true });
  if (p.log.length > 200) p.log.length = 200;
  save();
  return true;
}

// ---- 入口 ----
let registered = false;
export function registerBank() {
  if (registered) return;
  registered = true;
  registerFeature('bank', { label: '銀行', line: '銀行が できたら ポイントを あずけられるよ', built: 'タッチすると ポイントを あずけられるよ' });
}
