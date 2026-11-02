// ほかの端末（iPad・iPhone・Android）と進みをそろえる。
// - 家族でひとつのアカウント（おうちの人のメールとパスワード）。各端末で1回ログインすれば、ずっとそのまま
// - データはこれまでどおり端末にも保存する。ネットがないときも使えて、つながったら送る
// - 1人分ずつ Supabase の表 manabi_profiles に入れる。rev（版の番号）で、上書きの取り合いをふせぐ
// - 2台で同時に進めても merge.js で足しあわせる
import { getState, replaceProfiles } from './store.js';
import { mergeProfile, same } from './merge.js';

const BASE_URL = 'https://gfuzmxkhhouhdrpjwajn.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdXpteGtoaG91aGRycGp3YWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MTk3NDcsImV4cCI6MjEwMjA5NTc0N30.gW8pyf186tWTMq-sGSHL8_rZjPzl1j1FMyffcY1ruE0';
const AUTH_KEY = 'manabi-auth';
const BASE_KEY = 'manabi-sync-base'; // { [id]: { rev, data } } この端末が最後にそろえたクラウドの中身
const LAST_KEY = 'manabi-sync-last';

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

let status = 'off'; // off | ok | busy | offline | error
let statusText = '';
const subs = new Set();
function setStatus(s, text = '') { status = s; statusText = text; subs.forEach((fn) => fn()); }
export function onSyncStatus(fn) { subs.add(fn); return () => subs.delete(fn); }
export function syncInfo() {
  const a = read(AUTH_KEY);
  return { email: a?.user?.email || null, status, text: statusText, last: read(LAST_KEY) };
}
export const loggedIn = () => !!read(AUTH_KEY)?.refresh_token;

// ---- ログイン ------------------------------------------------------------------

async function authCall(path, body) {
  const r = await fetch(`${BASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: ANON },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = String(j.error_description || j.msg || j.message || j.error || r.status);
    const e = new Error(msg); e.status = r.status; e.code = j.error_code || j.code; throw e;
  }
  return j;
}

function keepSession(j) {
  write(AUTH_KEY, {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
    user: { id: j.user?.id, email: j.user?.email },
  });
}

export function friendlyError(e) {
  const m = String(e?.message || e);
  if (/invalid login credentials/i.test(m)) return 'メールかパスワードが ちがうみたい';
  if (/email not confirmed/i.test(m)) return 'メールの「確認」リンクを まだ押していないみたい';
  if (/already registered|already exists/i.test(m)) return 'このメールは もう登録ずみ。「ログイン」してね';
  if (/password/i.test(m) && /(6|characters|short|weak)/i.test(m)) return 'パスワードは 8文字以上にしてね';
  if (/rate limit/i.test(m)) return 'たくさん ためしたので、すこし まってね';
  if (!navigator.onLine || /failed to fetch|network/i.test(m)) return 'インターネットに つながっていないみたい';
  return `うまくいかなかった（${m.slice(0, 60)}）`;
}

export async function signIn(email, password) {
  keepSession(await authCall('token?grant_type=password', { email, password }));
  write(BASE_KEY, null); // はじめてのアカウントなので、そろえた記録は まっさらから
  await syncNow({ first: true });
}

// 登録。メールの確認が いるときは false（リンクを押してから ログイン）
export async function signUp(email, password) {
  const j = await authCall('signup', { email, password });
  if (j.access_token) { keepSession(j); write(BASE_KEY, null); await syncNow({ first: true }); return true; }
  return false;
}

export function signOut() {
  const a = read(AUTH_KEY);
  if (a?.access_token) {
    fetch(`${BASE_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${a.access_token}` } }).catch(() => {});
  }
  write(AUTH_KEY, null); write(BASE_KEY, null); write(LAST_KEY, null); write(UP_KEY, null);
  setStatus('off');
}

async function token() {
  const a = read(AUTH_KEY);
  if (!a?.refresh_token) return null;
  if (a.access_token && a.expires_at - 60 > Date.now() / 1000) return a;
  try {
    keepSession(await authCall('token?grant_type=refresh_token', { refresh_token: a.refresh_token }));
  } catch (e) {
    // 鍵がもう使えない（ほかでログアウトした・パスワードを変えた）ときだけ、ログアウト
    if (e.status === 400 || e.status === 401) { write(AUTH_KEY, null); write(BASE_KEY, null); setStatus('error', 'もういちど ログインしてね'); }
    throw e;
  }
  return read(AUTH_KEY);
}

async function rest(a, method, path, body, extra = {}) {
  const r = await fetch(`${BASE_URL}/rest/v1/${path}`, {
    method,
    headers: { 'content-type': 'application/json', apikey: ANON, Authorization: `Bearer ${a.access_token}`, ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) { const e = new Error(`http ${r.status}`); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json();
}

// ---- そろえる ------------------------------------------------------------------

let running = null;
let again = false;

export function syncNow(opts) {
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      for (let i = 0; i < 4; i++) {
        again = false;
        const r = await syncOnce(opts);
        if (!r.retry && !again) break;
      }
    } finally { running = null; }
  })();
  return running;
}

async function syncOnce({ first = false } = {}) {
  const a = await token().catch(() => null);
  if (!a) { if (!read(AUTH_KEY)) setStatus('off'); else setStatus('offline', 'つながったら 送るよ'); return {}; }
  if (!navigator.onLine) { setStatus('offline', 'つながったら 送るよ'); return {}; }
  setStatus('busy');
  let rows;
  try {
    rows = await rest(a, 'GET', 'manabi_profiles?select=id,data,rev,deleted&deleted=eq.false&order=updated_at.asc');
  } catch (e) {
    setStatus(e.status === 401 ? 'error' : 'offline', e.status === 401 ? 'もういちど ログインしてね' : 'つながったら 送るよ');
    return {};
  }

  const before = JSON.stringify(getState().profiles);
  const local = JSON.parse(before);
  const base = read(BASE_KEY) || {};
  const remote = new Map(rows.map((r) => [r.id, r]));
  const out = [];
  const pushes = [];
  const nextBase = { ...base };
  const renamed = {}; // 引っ越しで、同じ名前のクラウドの人にまとめたとき 古いid → 新しいid
  let merged = 0;

  const remoteByName = new Map();
  rows.forEach((r) => { if (!local.some((p) => p.id === r.id)) remoteByName.set(String(r.data?.name || '').trim(), r); });

  local.forEach((L) => {
    let R = remote.get(L.id);
    const B = base[L.id];
    if (!R && !B) {
      // はじめて送る人。クラウドに同じ名前の人がいたら、その人にまとめる（2台に別々にいたとき）
      const twin = remoteByName.get(String(L.name || '').trim());
      if (twin) { remoteByName.delete(String(L.name || '').trim()); renamed[L.id] = twin.id; R = twin; merged++; }
    }
    if (!R) {
      out.push(L);
      pushes.push({ kind: 'insert', id: L.id, data: L });
      return;
    }
    remote.delete(R.id);
    const bData = B && B.rev === R.rev ? B.data : (renamed[L.id] ? null : B?.data);
    if (B && B.rev === R.rev) {
      // クラウドは前のまま
      out.push(L);
      if (!same(L, B.data)) pushes.push({ kind: 'update', id: R.id, rev: R.rev, data: L });
      return;
    }
    // クラウドが進んでいる → まとめる
    const M = renamed[L.id] ? mergeProfile(null, L, R.data) : mergeProfile(bData ?? null, L, R.data);
    out.push(M);
    nextBase[R.id] = { rev: R.rev, data: R.data };
    if (!same(M, R.data)) pushes.push({ kind: 'update', id: R.id, rev: R.rev, data: M });
  });
  // ほかの端末で ふえた人
  remote.forEach((R) => { out.push(R.data); nextBase[R.id] = { rev: R.rev, data: R.data }; });
  Object.keys(renamed).forEach((id) => delete nextBase[id]);

  // そろえている間に この端末で進んだら、やりなおす（進みを なくさないため）
  if (JSON.stringify(getState().profiles) !== before) return { retry: true };
  if (!same(out, local)) {
    const cur = getState().currentId;
    replaceProfiles(out, renamed[cur] || cur);
  }
  write(BASE_KEY, nextBase);

  let retry = false;
  for (const p of pushes) {
    try {
      if (p.kind === 'insert') {
        const r = await rest(a, 'POST', 'manabi_profiles', { id: p.id, data: p.data, rev: 1 }, { Prefer: 'return=representation' });
        nextBase[p.id] = { rev: r[0].rev, data: p.data };
      } else {
        const r = await rest(a, 'PATCH', `manabi_profiles?id=eq.${encodeURIComponent(p.id)}&rev=eq.${p.rev}`,
          { data: p.data, rev: p.rev + 1 }, { Prefer: 'return=representation' });
        if (!r.length) { retry = true; continue; } // ほかの端末が先に送った → もういちど まとめる
        nextBase[p.id] = { rev: p.rev + 1, data: p.data };
      }
    } catch (e) {
      if (e.status === 409) { retry = true; continue; }
      write(BASE_KEY, nextBase);
      setStatus('offline', 'つながったら 送るよ');
      return {};
    }
  }
  write(BASE_KEY, nextBase);
  if (!retry) {
    await syncPhotos(a).catch(() => {});
    write(LAST_KEY, Date.now());
    setStatus('ok');
    if (first && merged) window.dispatchEvent(new CustomEvent('manabi-sync-merged', { detail: merged }));
  }
  return { retry };
}

// ---- しりょうの写真（本体） -------------------------------------------------------
// 一覧（p.photos）はプロフィールと いっしょに そろう。本体は Storage の manabi-photos/<user>/<id>.jpg と
// この端末の IndexedDB（photos.js）のあいだで行き来する。1回に少しずつ（重くしないため）。
const UP_KEY = 'manabi-photos-up'; // クラウドにあると わかっている写真の id
const PHOTO_STEP = 8;

async function syncPhotos(a) {
  const ph = await import('./photos.js');
  const want = new Set(getState().profiles.flatMap((p) => (Array.isArray(p.photos) ? p.photos : []).map((m) => m.id)).filter(Boolean));
  const have = new Set(await ph.localIds());
  const up = new Set(read(UP_KEY) || []);
  const obj = (id) => `${BASE_URL}/storage/v1/object/manabi-photos/${a.user.id}/${encodeURIComponent(id)}.jpg`;
  const auth = { apikey: ANON, Authorization: `Bearer ${a.access_token}` };
  let n = 0; let got = 0;
  const keep = () => write(UP_KEY, [...up]);
  for (const id of want) {
    if (n >= PHOTO_STEP) break;
    if (have.has(id) && !up.has(id)) {
      // 送る
      const data = await ph.getData(id);
      if (!data) continue;
      n++;
      const blob = await (await fetch(data)).blob();
      const r = await fetch(obj(id), { method: 'POST', headers: { ...auth, 'content-type': blob.type || 'image/jpeg', 'x-upsert': 'true' }, body: blob });
      if (r.ok) { up.add(id); keep(); }
    } else if (!have.has(id)) {
      // もらう（まだ どの端末からも 送られていなければ 404。あとで もういちど）
      n++;
      const r = await fetch(obj(id).replace('/object/', '/object/authenticated/'), { headers: auth });
      if (!r.ok) continue;
      const blob = await r.blob();
      const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
      await ph.putData(id, url);
      up.add(id); keep(); got++;
    }
  }
  // 一覧から消えた写真は、クラウドからも消す（この端末が送った・もらったものだけ）
  for (const id of [...up]) {
    if (want.has(id)) continue;
    const r = await fetch(`${BASE_URL}/storage/v1/object/manabi-photos`, { method: 'DELETE', headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: [`${a.user.id}/${id}.jpg`] }) }).catch(() => null);
    if (r?.ok) { up.delete(id); keep(); }
  }
  if (got) window.dispatchEvent(new CustomEvent('manabi-photos-synced', { detail: got }));
  if (n >= PHOTO_STEP) later(1500); // のこりは すこし あとで
}

// ---- いつ そろえるか -----------------------------------------------------------

let timer = null;
function later(ms = 2500) { clearTimeout(timer); timer = setTimeout(() => { if (loggedIn()) syncNow(); }, ms); }

export function startSync() {
  window.addEventListener('manabi-saved', () => later());
  window.addEventListener('online', () => later(500));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) later(300); });
  setInterval(() => { if (!document.hidden && loggedIn()) syncNow(); }, 60000);
  if (loggedIn()) later(800);
}
