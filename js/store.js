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
];

export const SUBJECTS = ['国語', '算数・数学', '理科', '社会', '英語', 'その他'];

let state = load();
const listeners = new Set();

function empty() {
  return { version: VERSION, profiles: [], currentId: null };
}

function migrate(s) {
  if (!s || typeof s !== 'object') return empty();
  if (s.version === VERSION) return s;
  return empty();
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { /* 保存が使えない環境でも動かす */ }
  return empty();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 無視 */ }
  listeners.forEach((fn) => fn());
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

export function addPoints(p, n, reason) {
  p.points += n;
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
