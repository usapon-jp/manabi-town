// 「ピヨ先生に つたえる」: こまったこと・ほしいものを、アプリの中から おくる。
// 送り先は Supabase の表（manabi_feedback）。アプリは書くだけで、読むことはできない。
// 名前・学年・どの画面か・アプリの版だけが つく。写真やパスワードは送らない。
import { h, toast } from './ui.js';
import { gradeLabel } from './store.js';
import { icon } from './icons.js';

const URL_ = 'https://gfuzmxkhhouhdrpjwajn.supabase.co/rest/v1/manabi_feedback';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdXpteGtoaG91aGRycGp3YWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MTk3NDcsImV4cCI6MjEwMjA5NTc0N30.gW8pyf186tWTMq-sGSHL8_rZjPzl1j1FMyffcY1ruE0';
const DAY_MAX = 10;
const COUNT_KEY = 'manabi-feedback-count';
const DRAFT_KEY = 'manabi-feedback-draft';

const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const sentToday = () => { try { const c = JSON.parse(localStorage.getItem(COUNT_KEY) || '{}'); return c.day === dayKey() ? c.n : 0; } catch { return 0; } };
const bump = () => { try { localStorage.setItem(COUNT_KEY, JSON.stringify({ day: dayKey(), n: sentToday() + 1 })); } catch { /* 無視 */ } };
const draft = (v) => { try { if (v === undefined) return localStorage.getItem(DRAFT_KEY) || ''; if (v) localStorage.setItem(DRAFT_KEY, v); else localStorage.removeItem(DRAFT_KEY); } catch { /* 無視 */ } return ''; };

export function openFeedback(p, screen, version) {
  document.querySelector('.fb-sheet')?.remove();
  const box = h('textarea', { rows: 4, maxlength: 1000, placeholder: 'れい: ここが わかりにくい／こんな きのうが ほしい', value: draft() });
  box.value = draft();
  box.oninput = () => draft(box.value);
  const status = h('p', { class: 'sheet-sub' }, '');
  const close = () => sheet.remove();
  const send = h('button', { class: 'btn primary', onclick: async () => {
    const body = box.value.trim();
    if (!body) { status.textContent = 'なにか 書いてね'; return; }
    if (sentToday() >= DAY_MAX) { status.textContent = 'きょうは たくさん ありがとう！ また あしたね'; return; }
    send.disabled = true; status.textContent = 'おくってるよ…';
    try {
      const r = await fetch(URL_, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}`, Prefer: 'return=minimal' },
        body: JSON.stringify({ who: p.name.slice(0, 20), grade: gradeLabel(p).slice(0, 20), screen: String(screen || '').slice(0, 30), body: body.slice(0, 1000), app_version: String(version || '').slice(0, 20) }),
      });
      if (!r.ok) throw new Error(`http ${r.status}`);
      bump(); draft('');
      close();
      toast('おくったよ！ ありがとう', 3000);
    } catch (e) {
      send.disabled = false;
      status.textContent = navigator.onLine ? 'おくれなかった…あとで もういちど' : 'インターネットに つながっていないみたい（書いたものは のこしておくよ）';
    }
  } }, icon('send'), ' おくる');
  const sheet = h('div', { class: 'sheet fb-sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card' },
      h('div', { class: 'coach' }, h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 40, height: 40 }), h('p', {}, 'こまったこと・ほしいものを おしえてね')),
      box, status, send,
      h('button', { class: 'link', onclick: close }, 'やめる')));
  document.body.append(sheet);
  setTimeout(() => box.focus(), 50);
}

export function feedbackCard(p, screen, version) {
  return h('div', { class: 'card form' },
    h('h3', {}, 'ピヨ先生に つたえる'),
    h('p', { class: 'ai-status' }, 'わかりにくい所や、ほしい きのうを おくってね'),
    h('button', { class: 'btn', onclick: () => openFeedback(p, screen, version) }, icon('message-circle'), ' つたえる'));
}

// アプリが だまって おくる 記録（まちのピヨへの しつもん など）。子どもには 何も 出さない。
// screen で わける（れい: 'まち:しつもん'）。1台1日 LOG_MAX まで。失敗しても 気にしない
const LOG_MAX = 40;
const LOG_KEY = 'manabi-feedback-log-count';
export async function logFeedback(p, screen, body, version) {
  try {
    const c = JSON.parse(localStorage.getItem(LOG_KEY) || '{}');
    const n = c.day === dayKey() ? c.n : 0;
    if (n >= LOG_MAX || !navigator.onLine) return;
    localStorage.setItem(LOG_KEY, JSON.stringify({ day: dayKey(), n: n + 1 }));
    await fetch(URL_, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}`, Prefer: 'return=minimal' },
      body: JSON.stringify({ who: String(p?.name || '').slice(0, 20), grade: p ? gradeLabel(p).slice(0, 20) : '', screen: String(screen || '').slice(0, 30), body: String(body || '').slice(0, 1000), app_version: String(version || '').slice(0, 20) }),
    });
  } catch { /* 記録できなくても つづける */ }
}
