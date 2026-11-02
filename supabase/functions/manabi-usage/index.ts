// AI 使用額を読むだけの URL（Muse などのエージェントが定期的に開いて数字を確認する用）。
// GET .../functions/v1/manabi-usage?k=<合言葉>        … 数行の文章
// GET .../functions/v1/manabi-usage?k=<合言葉>&f=json … JSON
// 合言葉は Supabase のシークレット USAGE_TOKEN。数字だけを返し、子どもの名前や勉強の中身は出さない。
// verify_jwt=false でデプロイする（URL だけで開けるように）。合言葉がちがえば 404。
import { ALERT, summary, WARN } from '../_shared/usage.ts';

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;
const yen = (n: number, rate: number) => `約${Math.round(n * rate).toLocaleString('ja-JP')}円`;
const pct = (r: number) => `${Math.round(r * 100)}%`;
const LABEL: Record<string, string> = {
  hint: 'ヒント', judge: '手書き判定', quiz: 'にた問題', scan: 'プリント読み取り', ask: '質問',
  plan: '作戦会議', consult: 'おとな相談', ping: 'つながり確認',
};

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = Deno.env.get('USAGE_TOKEN') || '';
  const nf = () => new Response('not found', { status: 404 });
  if (req.method !== 'GET' || token.length < 24 || !safeEqual(url.searchParams.get('k') || '', token)) return nf();
  const noStore = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
  try {
    const s = await summary();
    if (url.searchParams.get('f') === 'json') {
      return new Response(JSON.stringify(s), { headers: { ...noStore, 'content-type': 'application/json; charset=utf-8' } });
    }
    const r = s.yenPerUsd;
    const state = s.level === 'alert' ? `警告（${pct(ALERT)}をこえました）`
      : s.level === 'warn' ? `注意（${pct(WARN)}をこえました）` : 'OK';
    const asOf = new Date(Date.parse(s.asOf) + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');
    const calls = Object.entries(s.calls).sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${LABEL[k] || k} ${n}`).join('・') || 'なし';
    const lines = [
      `まなびタウン AI使用額（${asOf} 日本時間・推定）`,
      `状態: ${state}`,
      `今月: ${usd(s.monthUsd)}（${yen(s.monthUsd, r)}）／上限 ${usd(s.limitUsd)} … ${pct(s.ratio)}`,
      `きょう: ${usd(s.todayUsd)}　きのう: ${usd(s.yesterdayUsd)}`,
      `月末の見込み: ${usd(s.forecastUsd)}（${yen(s.forecastUsd, r)}）… ${pct(s.forecastRatio)}`,
      `直近7日: ${s.last7.map((x) => `${x.day.slice(5)} ${usd(x.usd)}`).join(' / ')}`,
      `今月の人ごと: ${Object.entries(s.byWho).sort((a, b) => b[1].usd - a[1].usd).map(([w, v]) => `${w} ${usd(v.usd)}（${v.calls}回）`).join('・') || 'なし'}`,
      `今月の回数: ${calls}`,
    ];
    return new Response(lines.join('\n') + '\n', { headers: { ...noStore, 'content-type': 'text/plain; charset=utf-8' } });
  } catch (e) {
    return new Response(`読み取りに失敗しました（${String((e as Error).message || e).slice(0, 80)}）\n`, { status: 502, headers: { ...noStore, 'content-type': 'text/plain; charset=utf-8' } });
  }
});
