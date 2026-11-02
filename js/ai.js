// Claude（AI）に聞く。キーはアプリには入れず、Supabase の受け口 manabi-ai が持っている。
// ここにある ANON は Supabase の「公開してよい」鍵（だれでも見られる前提のもの）。
const ENDPOINT = 'https://gfuzmxkhhouhdrpjwajn.supabase.co/functions/v1/manabi-ai';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdXpteGtoaG91aGRycGp3YWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MTk3NDcsImV4cCI6MjEwMjA5NTc0N30.gW8pyf186tWTMq-sGSHL8_rZjPzl1j1FMyffcY1ruE0';
// 1台・1日あたりの回数の上限（使いすぎ防止。月の上限は Anthropic 側でも $5 にしてある）
export const DAY_LIMIT = 40;
const COUNT_KEY = 'manabi-ai-count';

function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function readCount() {
  try { const c = JSON.parse(localStorage.getItem(COUNT_KEY) || '{}'); return c.day === todayKey() ? c.n : 0; } catch { return 0; }
}
function bump() { try { localStorage.setItem(COUNT_KEY, JSON.stringify({ day: todayKey(), n: readCount() + 1 })); } catch { /* 保存できなくても続ける */ } }
export function aiLeft() { return Math.max(0, DAY_LIMIT - readCount()); }

export async function askAI(body, { count = true, timeout = 20000 } = {}) {
  if (count && aiLeft() <= 0) throw new Error('limit');
  if (!navigator.onLine) throw new Error('offline');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${ANON}`, apikey: ANON },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || `http ${r.status}`);
    if (count) bump();
    return j;
  } finally { clearTimeout(timer); }
}

// こどもに見せる短いことば
export function aiErrorText(e) {
  const m = String(e?.message || e);
  if (m === 'limit') return 'きょうのヒントは ここまで。また あしたね';
  if (m === 'offline') return 'インターネットに つながっていないみたい';
  if (m === 'no-key') return 'まだ じゅんびちゅう（おうちの人に きいてね）';
  return 'いまは ヒントを 出せなかった…';
}
