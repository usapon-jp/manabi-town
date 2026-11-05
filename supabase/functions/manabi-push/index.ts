// スマホへのお知らせ（Web プッシュ）。
// - アプリが「この端末に、何時に、なにを知らせるか」の一覧（reminders）を送ってくる。中身はタイトルと時刻だけ
// - pg_cron が毎分 action:tick で呼ぶ → 時刻になった分を その端末へ送る（アプリを閉じていても届く）
// - VAPID の鍵は はじめて使うときに ここで作って app_secret にしまう（外には出さない。公開鍵だけ返す）
// - いまはおとなのルーティーン。あとで 宿題・勉強のお知らせも同じ reminders に入れれば届く（kind で見分ける）
import webpush from 'npm:web-push@3.6.7';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'content-type': 'application/json' } });

function rest(path: string, init: RequestInit = {}) {
  return fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'content-type': 'application/json', ...(init.headers || {}) },
  });
}
async function secret(name: string): Promise<string | null> {
  const r = await rest(`app_secret?name=eq.${name}&select=value`);
  const j = r.ok ? await r.json() : [];
  return j[0]?.value ?? null;
}
async function sha(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

let vapid: { publicKey: string; privateKey: string } | null = null;
async function keys() {
  if (vapid) return vapid;
  const s = await secret('push_vapid');
  if (s) { vapid = JSON.parse(s); return vapid!; }
  const k = webpush.generateVAPIDKeys();
  // 2つ同時に作っても 先に入ったほうを使う
  await rest('app_secret?on_conflict=name', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ name: 'push_vapid', value: JSON.stringify(k) }) });
  vapid = JSON.parse((await secret('push_vapid')) || JSON.stringify(k));
  return vapid!;
}

type Reminder = { id: string; kind?: string; title: string; body?: string; time: string; days?: number[]; skipUntil?: string; url?: string };
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const clip = (s: unknown, n: number) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
function cleanReminders(list: unknown): Reminder[] {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 40).map((x: any) => ({
    id: clip(x?.id, 80),
    kind: clip(x?.kind, 20) || 'routine',
    title: clip(x?.title, 60),
    body: clip(x?.body, 120),
    time: String(x?.time || ''),
    days: Array.isArray(x?.days) ? x.days.map(Number).filter((d: number) => Number.isInteger(d) && d >= 0 && d < 7) : [],
    skipUntil: ISO.test(String(x?.skipUntil || '')) ? String(x.skipUntil) : '',
    url: clip(x?.url, 40),
  })).filter((r) => r.id && r.title && HM.test(r.time));
}
function cleanSub(s: any) {
  const endpoint = String(s?.endpoint || '');
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000) return null;
  const p256dh = String(s?.keys?.p256dh || ''); const auth = String(s?.keys?.auth || '');
  if (!p256dh || !auth || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint, keys: { p256dh, auth } };
}
function okTz(tz: unknown) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: String(tz) }); return String(tz).slice(0, 60); } catch { return 'Asia/Tokyo'; }
}

// その地域の いまの日付・時刻・曜日
function localNow(tz: string, now = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute), dow };
}
const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const LATE = 20; // 毎分の呼び出しが おくれても、20分以内なら送る（同じ日に2回は送らない）

async function send(sub: any, payload: unknown) {
  const k = await keys();
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), {
      vapidDetails: { subject: 'mailto:manabi-town@example.com', publicKey: k.publicKey, privateKey: k.privateKey },
      TTL: 60 * 60, urgency: 'high',
    });
    return 'ok';
  } catch (e: any) {
    return e?.statusCode === 404 || e?.statusCode === 410 ? 'gone' : `error ${e?.statusCode || ''} ${String(e?.body || e?.message || e).slice(0, 120)}`;
  }
}

async function findDevice(device: string, sec: string) {
  const r = await rest(`push_subs?device=eq.${encodeURIComponent(device)}&select=*`);
  const row = r.ok ? (await r.json())[0] : null;
  if (!row) return { row: null, ok: true };
  return { row, ok: row.secret_hash === await sha(sec) };
}

async function tick() {
  const r = await rest('push_subs?select=device,sub,tz,reminders,sent');
  const rows = r.ok ? await r.json() : [];
  let sent = 0;
  for (const row of rows) {
    const t = localNow(row.tz || 'Asia/Tokyo');
    const done: Record<string, string> = { ...(row.sent || {}) };
    const due = (row.reminders as Reminder[] || []).filter((x) => {
      if (done[x.id] === t.date) return false;
      if (x.days?.length && !x.days.includes(t.dow)) return false;
      if (x.skipUntil && t.date < x.skipUntil) return false;
      const d = t.min - toMin(x.time);
      return d >= 0 && d <= LATE;
    });
    if (!due.length) continue;
    due.forEach((x) => { done[x.id] = t.date; });
    // 1つの端末には まとめて1通
    const first = due[0];
    const payload = due.length === 1
      ? { title: first.title, body: first.body || 'じかんです', tag: first.id, url: first.url || '' }
      : { title: `${first.title} ほか${due.length - 1}こ`, body: due.map((x) => x.title).join('・').slice(0, 120), tag: `many-${t.date}-${t.min}`, url: first.url || '' };
    const res = await send(row.sub, payload);
    if (res === 'gone') { await rest(`push_subs?device=eq.${encodeURIComponent(row.device)}`, { method: 'DELETE' }); continue; }
    // 失敗しても同じ日に何度も送りなおさない（記録は残す）
    await rest(`push_subs?device=eq.${encodeURIComponent(row.device)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ sent: pruneSent(done, t.date), last_result: res, last_sent_at: new Date().toISOString() }) });
    if (res === 'ok') sent += 1;
  }
  return { rows: rows.length, sent };
}
// 送った記録は きょうと きのうの分だけ
function pruneSent(m: Record<string, string>, today: string) {
  const y = new Date(`${today}T00:00:00Z`); y.setUTCDate(y.getUTCDate() - 1);
  const keep = y.toISOString().slice(0, 10);
  return Object.fromEntries(Object.entries(m).filter(([, d]) => d >= keep));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'post only' }, 405);
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === 'tick') {
      const want = await secret('push_cron');
      if (!want || req.headers.get('x-cron') !== want) return json({ error: 'forbidden' }, 403);
      return json(await tick());
    }
    if (b.action === 'key') return json({ publicKey: (await keys()).publicKey });

    const device = clip(b.device, 64); const sec = String(b.secret || '');
    if (!/^[\w-]{16,64}$/.test(device) || sec.length < 20 || sec.length > 100) return json({ error: 'bad device' }, 400);
    const found = await findDevice(device, sec);
    if (!found.ok) return json({ error: 'forbidden' }, 403);

    if (b.action === 'save') {
      const sub = cleanSub(b.sub);
      if (!sub) return json({ error: 'bad sub' }, 400);
      const reminders = cleanReminders(b.reminders);
      const row = { device, sub, secret_hash: await sha(sec), tz: okTz(b.tz), reminders, updated_at: new Date().toISOString() };
      // 同じ endpoint の古い行（端末の記録を消した時など）はかたづける
      await rest(`push_subs?endpoint=eq.${encodeURIComponent(sub.endpoint)}&device=neq.${encodeURIComponent(device)}`, { method: 'DELETE' });
      const r = await rest('push_subs?on_conflict=device', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ ...row, endpoint: sub.endpoint }) });
      if (!r.ok) return json({ error: `save ${r.status} ${(await r.text()).slice(0, 120)}` }, 500);
      return json({ ok: true, count: reminders.length });
    }
    if (b.action === 'off') {
      if (found.row) await rest(`push_subs?device=eq.${encodeURIComponent(device)}`, { method: 'DELETE' });
      return json({ ok: true });
    }
    if (b.action === 'test') {
      if (!found.row) return json({ error: 'not saved' }, 404);
      const res = await send(found.row.sub, { title: 'まなびタウン', body: 'お知らせは こんなふうに届きます', tag: 'test', url: '' });
      if (res === 'gone') { await rest(`push_subs?device=eq.${encodeURIComponent(device)}`, { method: 'DELETE' }); return json({ error: 'gone' }, 410); }
      return res === 'ok' ? json({ ok: true }) : json({ error: res }, 502);
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});
