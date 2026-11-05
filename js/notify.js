// スマホへのお知らせ（Web プッシュ）。
// - 端末ごとに「通知をオン」にする。オンにした人（プロフィール）の お知らせだけ、この端末に届く
// - 時刻になったら Supabase（manabi-push）から送るので、アプリを閉じていても届く
// - iPhone・iPad は「ホーム画面に追加」したアイコンから開いたときだけ オンにできる（iOS 16.4 から）
// - お知らせの元（sources）: いまは おとなのルーティーン。宿題・勉強のお知らせは ここに足せば同じしくみで届く
import { h, toast } from './ui.js';
import { getState, onChange } from './store.js';
import { routineReminders } from './adult.js';
import { icon } from './icons.js';

const ENDPOINT = 'https://gfuzmxkhhouhdrpjwajn.supabase.co/functions/v1/manabi-push';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdXpteGtoaG91aGRycGp3YWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MTk3NDcsImV4cCI6MjEwMjA5NTc0N30.gW8pyf186tWTMq-sGSHL8_rZjPzl1j1FMyffcY1ruE0';
const KEY = 'manabi-push'; // { device, secret, profiles: [id], sent: 'さいごに送った一覧' } この端末だけの記録（同期しない）

// プロフィールから お知らせを集める。kind ごとに足していける
const SOURCES = [routineReminders];

const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const write = (v) => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* 保存できなくても続ける */ } };
const rand = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => x.toString(16).padStart(2, '0')).join('');

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// いまの状態: unsupported | need-home（iPhoneでホーム画面に追加がいる） | denied | off | on
export function pushState(p) {
  if (!pushSupported()) return isIOS() && !standalone() ? 'need-home' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const s = read();
  return s?.device && p && s.profiles?.includes(p.id) ? 'on' : 'off';
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

function collect(ids) {
  const out = [];
  getState().profiles.filter((p) => ids.includes(p.id)).forEach((p) => SOURCES.forEach((fn) => out.push(...fn(p))));
  return out;
}

// 一覧が前と変わっていたら サーバーへ送る（ルーティーンを足した・チェックした・ほかの端末から そろったとき）
async function push(force = false) {
  const s = read();
  if (!s?.device || !pushSupported() || Notification.permission !== 'granted') return;
  const reminders = collect(s.profiles || []);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo';
  const sub = await subscription();
  const sig = JSON.stringify([sub.endpoint, tz, reminders]);
  if (!force && sig === s.sent) return;
  await call({ action: 'save', device: s.device, secret: s.secret, sub: sub.toJSON(), tz, reminders });
  write({ ...read(), sent: sig });
}

let timer = null;
function later() {
  clearTimeout(timer);
  timer = setTimeout(() => { if (navigator.onLine) push().catch(() => {}); }, 2500);
}

// アプリを開いたとき・データが変わったとき・ネットにつながったとき・日づけが変わって開きなおしたとき
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
  const s = read() || { device: rand(16), secret: rand(24), profiles: [] };
  if (!s.profiles.includes(p.id)) s.profiles.push(p.id);
  write(s);
  await push(true);
}

export async function disablePush(p) {
  const s = read();
  if (!s) return;
  s.profiles = (s.profiles || []).filter((id) => id !== p.id);
  if (s.profiles.length) { write(s); await push(true); return; }
  // だれも受けとらないなら、端末の登録ごと消す
  try { await call({ action: 'off', device: s.device, secret: s.secret }); } catch { /* ネットがなくても 端末はオフにする */ }
  try { const reg = await navigator.serviceWorker.ready; await (await reg.pushManager.getSubscription())?.unsubscribe(); } catch { /* なくてもよい */ }
  write(null);
}

export async function testPush() {
  const s = read();
  if (!s?.device) throw new Error('off');
  await push(true);
  await call({ action: 'test', device: s.device, secret: s.secret });
}

const errText = (e) => {
  const m = String(e?.message || e);
  if (m === 'need-home') return 'iPhone・iPad は「ホーム画面に追加」した アイコンから ひらいてね';
  if (m === 'unsupported') return 'このブラウザでは お知らせが つかえません';
  if (m === 'denied') return '通知が「ゆるさない」に なっています。端末の せっていで ゆるしてね';
  if (!navigator.onLine || /failed to fetch|network/i.test(m)) return 'インターネットに つながっていないみたい';
  return `うまくいかなかった（${m.slice(0, 60)}）`;
};

// お知らせカード（ルーティーンのタブ・せってい で共通）
export function notifyCard(p, { rerender } = {}) {
  const st = pushState(p);
  const box = h('div', { class: `card notify-card ${st}` });
  const busy = (btn, fn) => async () => {
    btn.disabled = true;
    try { await fn(); } catch (e) { toast(errText(e), 4000); }
    btn.disabled = false;
    (rerender || (() => box.replaceWith(notifyCard(p, { rerender }))))();
  };
  const head = h('h3', {}, icon('bell'), ' スマホに お知らせ');
  if (st === 'on') {
    const test = h('button', { class: 'btn' }, 'ためしに 送る');
    test.onclick = busy(test, async () => { await testPush(); toast('送りました。すこし まってね'); });
    const off = h('button', { class: 'link' }, 'オフにする');
    off.onclick = busy(off, async () => { await disablePush(p); toast('この端末の お知らせを オフにしました'); });
    const n = routineReminders(p).length;
    box.append(head,
      h('p', {}, `この端末に とどきます（${n ? `時刻つき ${n}こ` : 'まだ時刻つきの ルーティーンは ありません。「なおす」で時刻を入れてね'}）`),
      h('div', { class: 'row' }, test, off));
    return box;
  }
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
  if (st === 'denied') { box.append(head, h('p', {}, '通知が「ゆるさない」に なっています。端末の せってい → 通知 → まなびタウン で ゆるしてから、もういちど ひらいてね')); return box; }
  const on = h('button', { class: 'btn primary' }, icon('bell'), ' この端末で オンにする');
  on.onclick = busy(on, async () => { await enablePush(p); toast('オンにしました。時刻になったら お知らせします'); });
  box.append(head, h('p', {}, '時刻を入れた ルーティーンを、その時間に この端末へ お知らせします（アプリを とじていても とどきます）'), on);
  return box;
}
