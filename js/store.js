// データの保存。お試し版は端末の中（localStorage）だけに保存する。
// 形を変えるときは VERSION を上げて migrate() に移し替えを書く。
const KEY = 'manabi-town';
const VERSION = 1;

export const GRADES = [
  { id: 'e3', label: '小3', bucket: 'e4' },
  { id: 'e4', label: '小4', bucket: 'e4' },
  { id: 'e5', label: '小5', bucket: 'e4' },
  { id: 'e6', label: '小6', bucket: 'e6' },
  { id: 'j1', label: '中1', bucket: 'j' },
  { id: 'j2', label: '中2', bucket: 'j' },
  { id: 'j3', label: '中3', bucket: 'j' },
  // おとな（保護者が自分のために使う）。子ども用クエストは出さない（js/adult.js）
  { id: 'adult', label: 'おとな', bucket: 'j' },
];

export const SUBJECTS = ['国語', '算数・数学', '理科', '社会', '英語', 'その他'];

const BACKUP_KEY = 'manabi-town-backup';   // 1日1回とっておく、ひとつ前の正常なデータ
const BROKEN_KEY = 'manabi-town-broken';   // 読めなかったデータの原文（あとで直せるように捨てない）

let lastWritten = null; // このタブが最後に書いた中身（ほかのタブが書いたかを見分ける）
let state = load();
const listeners = new Set();

function empty() {
  return { version: VERSION, profiles: [], currentId: null };
}

// 形を確かめて、足りないところをおぎなう。だめなら null
function normalize(s) {
  if (!s || typeof s !== 'object' || s.version !== VERSION || !Array.isArray(s.profiles)) return null;
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const arr = (v) => (Array.isArray(v) ? v : []);
  s.profiles = s.profiles.filter((p) => p && typeof p === 'object' && typeof p.id === 'string').map((p) => ({
    ...p,
    name: String(p.name ?? ''),
    points: Number.isFinite(Number(p.points)) ? Number(p.points) : 0,
    items: arr(p.items).filter((i) => i && typeof i === 'object'),
    quizzes: arr(p.quizzes).filter((q) => q && typeof q === 'object' && Array.isArray(q.questions)),
    daily: obj(p.daily),
    log: arr(p.log),
  }));
  if (!s.profiles.some((p) => p.id === s.currentId)) s.currentId = s.profiles[0]?.id ?? null;
  return s;
}

function readKey(key) {
  let raw = null;
  try {
    raw = localStorage.getItem(key);
    return raw ? { raw, data: normalize(JSON.parse(raw)) } : null;
  } catch (e) { return { raw, data: null }; }
}

function load() {
  let main;
  try { main = readKey(KEY); } catch (e) { return empty(); }
  if (!main) return empty();
  if (main.data) { lastWritten = main.raw; return main.data; }
  // 読めなかった: 原文をとっておいて、バックアップからもどす
  try { if (main.raw) localStorage.setItem(BROKEN_KEY, main.raw); } catch (e) { /* 容量がないときは あきらめる */ }
  const backup = readKey(BACKUP_KEY);
  if (backup?.data) {
    setTimeout(() => window.dispatchEvent(new CustomEvent('manabi-restored')), 1500);
    return backup.data;
  }
  return empty();
}

export function save() {
  let ok = true;
  try {
    const raw = JSON.stringify(state);
    localStorage.setItem(KEY, raw);
    lastWritten = raw;
    // 1日1回、正常に書けたデータをバックアップにも入れる
    const t = today();
    if (localStorage.getItem(`${BACKUP_KEY}-day`) !== t) {
      localStorage.setItem(BACKUP_KEY, raw);
      localStorage.setItem(`${BACKUP_KEY}-day`, t);
    }
  } catch (e) {
    ok = false;
  }
  // 保存できなかったら、画面でお知らせする（main.js）
  window.dispatchEvent(new CustomEvent(ok ? 'manabi-saved' : 'manabi-save-error'));
  listeners.forEach((fn) => fn());
  return ok;
}

// ほかのタブ（同じアプリを2つ開いたとき）が保存したら、こちらも読みなおす。
// これがないと、あとから保存したほうが前の進みを上書きしてしまう。
function syncFromOtherTab() {
  let raw;
  try { raw = localStorage.getItem(KEY); } catch (e) { return; }
  if (!raw || raw === lastWritten) return;
  const next = readKey(KEY)?.data;
  if (!next) return;
  lastWritten = raw;
  state = next;
  listeners.forEach((fn) => fn());
  window.dispatchEvent(new CustomEvent('manabi-synced'));
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) syncFromOtherTab(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncFromOtherTab(); });
}

// ほかの端末の進みを入れる（sync.js から）。manabi-saved は出さない（送りかえさないため）
// ひらいている画面（クイズ・シートなど）が持っている人やテストの入れ物は そのまま使いつづけるので、
// 入れかえずに 中身だけ書きかえる（入れかえると、そのあとの ポイントが 古い入れ物に入って消える）
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const keyOf = (x) => (plain(x) ? (x.id ?? x.key ?? null) : null);
function patchInPlace(t, s) {
  if (Array.isArray(t)) {
    const pool = new Map();
    t.forEach((x) => { const k = keyOf(x); if (k != null && !pool.has(k)) pool.set(k, x); });
    const next = s.map((x) => {
      const k = keyOf(x); const old = k != null ? pool.get(k) : null;
      if (old && plain(x)) { pool.delete(k); patchInPlace(old, x); return old; }
      return x;
    });
    t.length = 0; t.push(...next);
    return t;
  }
  Object.keys(t).forEach((k) => { if (!(k in s)) delete t[k]; });
  Object.keys(s).forEach((k) => {
    const a = t[k]; const b = s[k];
    if ((plain(a) && plain(b)) || (Array.isArray(a) && Array.isArray(b))) patchInPlace(a, b);
    else t[k] = b;
  });
  return t;
}

export function replaceProfiles(profiles, currentId) {
  // 送る途中のデータと 入れ物を わけあわないように、写しをつくる
  const next = normalize({ version: VERSION, profiles: JSON.parse(JSON.stringify(profiles)), currentId: currentId ?? state.currentId });
  if (!next) return false;
  const old = new Map(state.profiles.map((p) => [p.id, p]));
  state.profiles = next.profiles.map((p) => (old.has(p.id) ? patchInPlace(old.get(p.id), p) : p));
  state.currentId = next.currentId;
  try { const raw = JSON.stringify(state); localStorage.setItem(KEY, raw); lastWritten = raw; } catch (e) { /* 次の保存で もういちど */ }
  listeners.forEach((fn) => fn());
  window.dispatchEvent(new CustomEvent('manabi-synced'));
  return true;
}

// 書き出し（保存できないときに、データをコピーしてとっておく）
export function exportData() { return JSON.stringify(state); }

// 書き出したデータを もどす。成功なら true
export function importData(raw) {
  let data;
  try { data = normalize(JSON.parse(String(raw || '').trim())); } catch (e) { return false; }
  if (!data || !data.profiles.length) return false;
  state = data;
  save();
  return true;
}

export function onChange(fn) { listeners.add(fn); }

export function getState() { return state; }

export function currentProfile() {
  return state.profiles.find((p) => p.id === state.currentId) || null;
}

export function gradeBucket(p) {
  return (GRADES.find((g) => g.id === p.grade) || GRADES[1]).bucket;
}

export function gradeLabel(p) {
  return (GRADES.find((g) => g.id === p.grade) || GRADES[1]).label;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function addProfile(name, grade) {
  const p = {
    id: uid(), name, grade, points: 0,
    character: 'piyo',
    items: [],      // テスト・宿題
    quizzes: [],    // とりこんだ小テスト
    daily: {},      // 日付 -> { score, total }
    log: [],        // ポイントの記録
  };
  state.profiles.push(p);
  state.currentId = p.id;
  save();
  return p;
}

export function switchProfile(id) {
  state.currentId = id;
  save();
}

export function updateProfile(p, fields) {
  Object.assign(p, fields);
  save();
}

// study: false のときは「勉強した日」にしない（見るだけ・ごほうびの受けとり）
export function addPoints(p, n, reason, { study = true } = {}) {
  p.points += n;
  // けいけんち（へらない）と、勉強した日のしるし
  if (typeof p.xp !== 'number') p.xp = (p.log || []).reduce((sum, e) => sum + Math.max(0, e.n), 0);
  if (n > 0) {
    p.xp += n;
    if (study) p.activeDays = { ...(p.activeDays || {}), [today()]: true };
  } else {
    p.xp = Math.max(0, p.xp + n);
  }
  p.log.unshift({ at: Date.now(), n, reason });
  if (p.log.length > 200) p.log.length = 200;
  save();
}

export function addItem(p, item) {
  p.items.push({ id: uid(), done: false, createdOn: today(), ...item });
  save();
}

export function removeItem(p, id) {
  p.items = p.items.filter((i) => i.id !== id);
  save();
}

export function addQuiz(p, quiz) {
  p.quizzes.push({ id: uid(), cleared: false, ...quiz });
  save();
}

export function removeQuiz(p, id) {
  p.quizzes = p.quizzes.filter((q) => q.id !== id);
  save();
}

// 端末の時刻での「きょう」(YYYY-MM-DD)
export function today() {
  return toISO(new Date());
}

export function toISO(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// date までの日数（きょう = 0）
export function daysUntil(date) {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - base) / 86400000);
}
