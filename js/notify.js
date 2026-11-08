// スマホへのお知らせ（Web プッシュ）。
// - 端末ごとに「通知をオン」にする。オンにした人（プロフィール）の お知らせだけ、この端末に届く
// - 時刻になったら Supabase（manabi-push）から送るので、アプリを閉じていても届く
// - iPhone・iPad は「ホーム画面に追加」したアイコンから開いたときだけ オンにできる（iOS 16.4 から）
// - お知らせの元（sources）: おとなのルーティーン と 宿題の「あした ていしゅつ」（前の日の夕方）
// - 子どもの宿題は、おとなの端末でも「◯◯の宿題」をオンにすれば いっしょに届く
import { h, toast } from './ui.js';
import { getState, onChange, save, today, toISO, daysUntil } from './store.js';
import { routineReminders, isAdult } from './adult.js';
import { buildSteps } from './planner.js';
import { icon } from './icons.js';
import { loggedIn, accessToken, userId } from './sync.js';

const ENDPOINT = 'https://gfuzmxkhhouhdrpjwajn.supabase.co/functions/v1/manabi-push';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdXpteGtoaG91aGRycGp3YWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MTk3NDcsImV4cCI6MjEwMjA5NTc0N30.gW8pyf186tWTMq-sGSHL8_rZjPzl1j1FMyffcY1ruE0';
const KEY = 'manabi-push';      // { device, secret, profiles: [id], pendingOff } この端末だけの記録（同期しない）
const SENT_KEY = 'manabi-push-sent'; // { rem, sub } さいごに送った中身（同じなら送らない）

// 宿題の「あした ていしゅつ」お知らせ。p.dueNotify = { time: 'HH:MM', off: true } （同期される）
export const DUE_TIME = '18:00';
export const dueTime = (p) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(p?.dueNotify?.time || '') ? p.dueNotify.time : DUE_TIME);
export const dueOn = (p) => !p?.dueNotify?.off;
const dayBefore = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d - 1); };

// 出していない宿題で、前の日が きょう〜2週間先のもの。前の日の dueTime に1回だけ
// （on はサーバーが「この日だけ」に使う。skipUntil・days は 古いサーバーでも ほぼ前の日だけになるよう そえておく）
export function homeworkReminders(p) {
  if (!dueOn(p)) return [];
  const t = today();
  return (p.items || [])
    .filter((i) => i.type === 'homework' && !i.done && i.date && daysUntil(i.date) >= 1 && daysUntil(i.date) <= 15)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 20)
    .map((i) => {
      const before = dayBefore(i.date);
      const on = toISO(before);
      const total = buildSteps(i).length;
      const left = Math.max(0, total - Math.min(i.stepsDone || 0, total));
      return {
        id: `h-${p.id}-${i.id}`.slice(0, 80), kind: 'due', title: `あした ていしゅつ：${i.title}`.slice(0, 60), time: dueTime(p),
        body: left && total > 1 ? `${p.name}さん、あと ${left}ページ。きょうの うちに やろう` : `${p.name}さん、あした だす日だよ。わすれずに かばんに 入れよう`,
        on, skipUntil: on < t ? t : on, days: [before.getDay()], url: '',
      };
    });
}

// プロフィールから お知らせを集める。kind ごとに足していける
const SOURCES = [routineReminders, homeworkReminders];

const readK = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const writeK = (k, v) => { try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch { /* 保存できなくても続ける */ } };
const read = () => readK(KEY);
const write = (v) => writeK(KEY, v);
const rand = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => x.toString(16).padStart(2, '0')).join('');

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// いまの状態: unsupported | need-home（iPhoneでホーム画面に追加がいる） | denied | off | on
export function pushState(p) {
  if (!pushSupported()) return isIOS() && !standalone() ? 'need-home' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const s = read();
  return s?.device && !s.pendingOff && p && s.profiles?.includes(p.id) ? 'on' : 'off';
}

async function call(body) {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${ANON}`, apikey: ANON },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) { const e = new Error(j.error || `http ${r.status}`); e.status = r.status; throw e; }
  return j;
}

function b64url(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function subscription() {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { publicKey } = await call({ action: 'key' });
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64url(publicKey) });
  }
  return sub;
}

function collect(p) {
  const out = [];
  SOURCES.forEach((fn) => out.push(...fn(p)));
  return out;
}

// サーバーに送る:
// 1) お知らせの一覧（人ごと）。ログインしていれば 家族のアカウントの分として送るので、
//    通知を受ける端末が とじていても、ほかの端末で チェック・なおした分が そのまま反映される
// 2) この端末が通知を受けるなら、送り先と「だれの分を受けるか」
// オフにしたのに ネットがなくて消せなかった登録は、つながったときに 消しなおす
async function push(force = false) {
  let s = read();
  if (s?.pendingOff) {
    await call({ action: 'off', device: s.device, secret: s.secret });
    write(null); writeK(SENT_KEY, null); s = null;
  }
  const enabled = !!(s?.device && s.profiles?.length && pushSupported() && Notification.permission === 'granted');
  const token = loggedIn() ? await accessToken() : null;
  if (!enabled && !token) return;
  const cred = token ? { token } : { device: s.device, secret: s.secret };
  const owner = token ? userId() : `dev:${s.device}`;
  const sent = readK(SENT_KEY) || {};

  const people = getState().profiles.filter((p) => token || s.profiles.includes(p.id));
  const profiles = Object.fromEntries(people.map((p) => [p.id, collect(p)]));
  const rem = JSON.stringify([owner, profiles]);
  if (force || rem !== sent.rem) {
    await call({ action: 'reminders', ...cred, profiles });
    sent.rem = rem; writeK(SENT_KEY, sent);
  }
  if (!enabled) return;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo';
  const sub = await subscription();
  const subSig = JSON.stringify([owner, sub.endpoint, tz, s.profiles]);
  if (force || subSig !== sent.sub) {
    await call({ action: 'save', device: s.device, secret: s.secret, token, sub: sub.toJSON(), tz, profiles: s.profiles });
    sent.sub = subSig; writeK(SENT_KEY, sent);
  }
}

let timer = null;
function later() {
  clearTimeout(timer);
  timer = setTimeout(() => { if (navigator.onLine) push().catch(() => {}); }, 2500);
}

// アプリを開いたとき・データが変わったとき（ほかの端末から そろったときも）・ネットにつながったとき・開きなおしたとき
export function startNotify() {
  onChange(later);
  window.addEventListener('online', later);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) later(); });
  later();
}

export async function enablePush(p) {
  const st = pushState(p);
  if (st === 'need-home') throw new Error('need-home');
  if (st === 'unsupported') throw new Error('unsupported');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('denied');
  const old = read();
  const s = old?.device ? { device: old.device, secret: old.secret, profiles: old.pendingOff ? [] : (old.profiles || []) } : { device: rand(16), secret: rand(24), profiles: [] };
  if (!s.profiles.includes(p.id)) s.profiles.push(p.id);
  write(s);
  await push(true);
}

export async function disablePush(p) {
  const s = read();
  if (!s) return;
  s.profiles = (s.profiles || []).filter((id) => id !== p.id);
  if (s.profiles.length) { write(s); await push(true); return; }
  // だれも受けとらないなら、端末の登録ごと消す。消せなかったら おぼえておいて、つながったときに消す
  write({ ...s, pendingOff: true });
  try { const reg = await navigator.serviceWorker.ready; await (await reg.pushManager.getSubscription())?.unsubscribe(); } catch { /* なくてもよい */ }
  try { await call({ action: 'off', device: s.device, secret: s.secret }); write(null); writeK(SENT_KEY, null); } catch { /* つながったら later() が消しなおす */ }
}

export async function testPush() {
  const s = read();
  if (!s?.device || s.pendingOff) throw new Error('off');
  await push(true);
  await call({ action: 'test', device: s.device, secret: s.secret });
}

const errText = (e) => {
  const m = String(e?.message || e);
  if (m === 'need-home') return 'iPhone・iPad は「ホーム画面に追加」した アイコンから ひらいてね';
  if (m === 'unsupported') return 'このブラウザでは お知らせが つかえません';
  if (m === 'denied') return '通知が「ゆるさない」に なっています。スマホの せっていで ゆるしてね';
  if (!navigator.onLine || /failed to fetch|network/i.test(m)) return 'インターネットに つながっていないみたい';
  return `うまくいかなかった（${m.slice(0, 60)}）`;
};

// 子ども: 宿題の お知らせの 時間（前の日の 何時か）と、オン・オフ
function dueSettings(p, redraw) {
  const time = h('input', { type: 'time', value: dueTime(p), step: 300, 'aria-label': 'お知らせの 時間' });
  time.onchange = () => {
    if (!/^\d{2}:\d{2}$/.test(time.value)) return;
    p.dueNotify = { ...(p.dueNotify || {}), time: time.value };
    save();
    toast(`前の日の ${time.value} に お知らせするよ`);
  };
  const sw = h('button', { class: 'link' }, dueOn(p) ? '宿題の お知らせを 止める' : '宿題の お知らせを また出す');
  sw.onclick = () => { p.dueNotify = { ...(p.dueNotify || {}), off: dueOn(p) || undefined }; save(); redraw(); };
  return h('div', { class: 'due-notify' },
    dueOn(p) ? h('label', { class: 'row' }, '前の日の', time, 'に') : null,
    sw);
}

// おとな: 子どもの「あした ていしゅつ」も この端末で うけとる
function kidsSettings(busy) {
  const kids = getState().profiles.filter((k) => !isAdult(k));
  if (!kids.length) return null;
  return h('div', { class: 'kid-due' },
    h('p', {}, '子どもの「あした ていしゅつ」も この端末に とどける'),
    h('div', { class: 'row' }, kids.map((k) => {
      const on = pushState(k) === 'on';
      const b = h('button', { class: `btn small ${on ? 'primary' : ''}`, 'aria-pressed': on ? 'true' : 'false' },
        on ? icon('check') : icon('bell'), ` ${k.name}`);
      b.onclick = busy(b, async () => {
        if (on) { await disablePush(k); toast(`${k.name}さんの お知らせを オフにしました`); }
        else { await enablePush(k); toast(`${k.name}さんの 宿題も とどきます（前の日の ${dueTime(k)}）`); }
      });
      return b;
    })),
    h('small', {}, '時間は 子どもの せってい（前の日の 何時か）で きまります'));
}

// お知らせカード（ルーティーンのタブ・せってい で共通）
export function notifyCard(p, { rerender } = {}) {
  const st = pushState(p);
  const adult = isAdult(p);
  const box = h('div', { class: `card notify-card ${st}` });
  const redraw = rerender || (() => box.replaceWith(notifyCard(p, { rerender })));
  const busy = (btn, fn) => async () => {
    btn.disabled = true;
    try { await fn(); } catch (e) { toast(errText(e), 4000); }
    btn.disabled = false;
    redraw();
  };
  const head = h('h3', {}, icon('bell'), ' スマホに お知らせ');
  const here = adult ? 'この端末' : 'この スマホ';
  if (st === 'need-home') {
    box.append(head,
      h('p', {}, 'iPhone・iPad は、Safari の ', h('b', {}, '共有ボタン'), ' →「', h('b', {}, 'ホーム画面に追加'), '」で アイコンを作って、そこから ひらくと オンにできます。'),
      h('ol', { class: 'steps' },
        h('li', {}, 'Safari で まなびタウンを ひらく'),
        h('li', {}, '下の □↑ ボタン →「ホーム画面に追加」'),
        h('li', {}, 'ホーム画面の アイコンから ひらいて、ここで「オンにする」')));
    return box;
  }
  if (st === 'unsupported') { box.append(head, h('p', {}, 'このブラウザでは お知らせが つかえません。Chrome（Android）か、ホーム画面に追加した Safari（iPhone・iPad）で ためしてね')); return box; }
  if (st === 'denied') { box.append(head, h('p', {}, '通知が「ゆるさない」に なっています。スマホの せってい → 通知 → まなびタウン で ゆるしてから、もういちど ひらいてね')); return box; }
  if (st === 'on') {
    const test = h('button', { class: 'btn' }, 'ためしに 送る');
    test.onclick = busy(test, async () => { await testPush(); toast('送りました。すこし まってね'); });
    const off = h('button', { class: 'link' }, 'オフにする');
    off.onclick = busy(off, async () => { await disablePush(p); toast(`${here}の お知らせを オフにしました`); });
    let what;
    if (adult) {
      const n = routineReminders(p).length;
      what = `${here}に とどきます（${n ? `時刻つきの ルーティーン ${n}こ` : 'まだ時刻つきの ルーティーンは ありません。「なおす」で時刻を入れてね'}）`;
    } else {
      const n = homeworkReminders(p).length;
      what = dueOn(p)
        ? `「あした ていしゅつ」の 宿題を、前の日に お知らせします（いま ${n}こ）`
        : '宿題の お知らせは 止めています';
    }
    box.append(...[head, h('p', {}, what), adult ? null : dueSettings(p, redraw),
      h('div', { class: 'row' }, test, off), adult ? kidsSettings(busy) : null].filter(Boolean));
    return box;
  }
  const on = h('button', { class: 'btn primary' }, icon('bell'), ` ${here}で オンにする`);
  on.onclick = busy(on, async () => { await enablePush(p); toast(adult ? 'オンにしました。時刻になったら お知らせします' : 'オンにしたよ。あした ていしゅつの 宿題を 前の日に お知らせするね'); });
  box.append(...[head,
    h('p', {}, adult
      ? '時刻を入れた ルーティーンを、その時間に この端末へ お知らせします（アプリを とじていても とどきます）'
      : 'あした ていしゅつの 宿題を、前の日の 夕方に お知らせするよ（アプリを とじていても とどきます）'),
    adult ? null : dueSettings(p, redraw),
    on, adult ? kidsSettings(busy) : null].filter(Boolean));
  return box;
}
