// AI 使用額の記録と集計（manabi-ai と manabi-usage で共用）。
// 保存するのは「いつ・どの機能・モデル・トークン数・推定料金」だけ。子どもの名前や勉強の中身は入れない。
// Anthropic の残高は API から読めないので、ここで記録した推定額を月の上限と比べる。

// 1M トークンあたりのドル（2026-11 時点の Anthropic 料金）
const PRICE: Record<string, { in: number; out: number }> = {
  'claude-haiku-5-5': { in: 0.10, out: 0.50 },
  'claude-sonnet-5-5': { in: 2.00, out: 10.00 },
  'claude-opus-5-5': { in: 4.00, out: 20.00 },
};
export const LIMIT_USD = Number(Deno.env.get('AI_MONTH_LIMIT_USD') || 5); // Anthropic 側の月の上限と合わせる
export const YEN_PER_USD = Number(Deno.env.get('YEN_PER_USD') || 150);
export const WARN = 0.7;
export const ALERT = 0.9;

export function costUsd(model: string, inTok: number, outTok: number) {
  const p = PRICE[model] || PRICE['claude-sonnet-5-5']; // 知らないモデルは高めに見積もる
  return (inTok * p.in + outTok * p.out) / 1_000_000;
}

function rest(path: string, init: RequestInit = {}) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return Promise.resolve(null);
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init.headers || {}) },
  });
}

// 失敗してもアプリの返事は止めない
const WHO = ['小3', '小4', '小5', '小6', '中1', '中2', '中3', 'おとな'];
// 子どもは学年だけ。おとなは「おとな:ハンドルネーム」まで残す
function cleanWho(who: string) {
  if (WHO.includes(who)) return who;
  const m = /^おとな:(.{1,12})$/u.exec(who.replace(/[\u0000-\u001f<>]/g, '').trim());
  return m ? `おとな:${m[1].trim()}` : '';
}
export async function recordUsage(action: string, who: string, model: string, usage: { input_tokens?: number; output_tokens?: number } | undefined) {
  try {
    const input_tokens = Number(usage?.input_tokens) || 0;
    const output_tokens = Number(usage?.output_tokens) || 0;
    await rest('ai_usage', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ action: action.slice(0, 20), who: cleanWho(who), model, input_tokens, output_tokens, cost_usd: costUsd(model, input_tokens, output_tokens) }),
    });
  } catch { /* 記録できなくても続ける */ }
}

// 日本時間の日付 YYYY-MM-DD
const jst = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

export async function summary(now = new Date()) {
  const today = jst(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  // 今月と、月はじめが近いときのために 8日前から読む
  const from = new Date(Math.min(Date.parse(`${monthStart}T00:00:00+09:00`), now.getTime() - 8 * 86400_000)).toISOString();
  const rows: { created_at: string; action: string; who: string; cost_usd: number }[] = [];
  for (let offset = 0; offset < 50_000; offset += 1000) {
    const r = await rest(`ai_usage?select=created_at,action,who,cost_usd&created_at=gte.${encodeURIComponent(from)}&order=id&limit=1000&offset=${offset}`);
    if (!r || !r.ok) throw new Error(`usage ${r?.status ?? 'no-env'}`);
    const page = await r.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const byDay: Record<string, number> = {};
  const byAction: Record<string, number> = {};
  const byWho: Record<string, { usd: number; calls: number }> = {};
  let month = 0;
  for (const x of rows) {
    const day = jst(new Date(x.created_at));
    const c = Number(x.cost_usd) || 0;
    byDay[day] = (byDay[day] || 0) + c;
    if (day >= monthStart) { month += c; byAction[x.action] = (byAction[x.action] || 0) + 1;
      const w = byWho[x.who || '不明'] ||= { usd: 0, calls: 0 }; w.usd += c; w.calls++; }
  }
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)), d = Number(today.slice(8, 10));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const yesterday = jst(new Date(now.getTime() - 86400_000));
  const last7 = Array.from({ length: 7 }, (_, i) => jst(new Date(now.getTime() - (6 - i) * 86400_000)))
    .map((day) => ({ day, usd: byDay[day] || 0 }));
  // 月末の見込み: 直近7日の平均ペース × 残りの日数（月はじめは今月の平均）
  const pace = last7.reduce((a, b) => a + b.usd, 0) / 7;
  const forecast = month + pace * (daysInMonth - d);
  const ratio = month / LIMIT_USD;
  return {
    asOf: now.toISOString(), today, limitUsd: LIMIT_USD, yenPerUsd: YEN_PER_USD,
    monthUsd: month, ratio, todayUsd: byDay[today] || 0, yesterdayUsd: byDay[yesterday] || 0,
    forecastUsd: forecast, forecastRatio: forecast / LIMIT_USD,
    level: ratio >= ALERT ? 'alert' : ratio >= WARN ? 'warn' : 'ok',
    calls: byAction, byWho, last7,
  };
}
