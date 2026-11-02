// まなびタウンの AI 受け口（Supabase Edge Function）。
// Claude API のキーは Supabase のシークレット ANTHROPIC_API_KEY にだけ置く。アプリやGitHubには置かない。
// action:
//   ping  … キーが置かれているかだけ確認（Claude は呼ばない）
//   hint  … 問題のヒント（答えは言わない。level 1→3 で少しずつ近づく）
//   judge … 手書きの字の画像が、お手本の漢字と同じか判定
const MODEL = 'claude-haiku-5-5';
const ALLOWED = ['https://usapon-jp.github.io', 'http://localhost:8766'];

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
    'Content-Type': 'application/json',
  };
}

async function claude(key: string, content: unknown[], system: string, maxTokens = 200) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `claude ${r.status}`);
  return (j.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('').trim();
}

const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = cors(origin);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers });
  if (origin && !ALLOWED.includes(origin)) return new Response(JSON.stringify({ error: 'origin' }), { status: 403, headers });
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* 空のまま */ }
  const ok = (data: unknown) => new Response(JSON.stringify(data), { headers });
  try {
    if (body.action === 'ping') {
      if (!key) return ok({ ready: false });
      const text = await claude(key, [{ type: 'text', text: 'ひらがなで「はい」とだけ答えて' }], 'みじかく答える', 10);
      return ok({ ready: true, text });
    }
    if (!key) return ok({ error: 'no-key' });
    if (body.action === 'hint') {
      const level = Math.min(3, Math.max(1, Number(body.level) || 1));
      const system = [
        'あなたは小学生・中学生の家庭教師「ピヨ先生」。やさしい話し言葉で、ひらがな多めに。',
        'ぜったいに答えそのものを言わない・書かない。答えの漢字や数字を文中に入れない。',
        `ヒントの強さは ${level}/3。1=考え方のきっかけ、2=もう少し具体的に、3=答えの一歩手前まで。`,
        '1〜2文、60文字以内。',
      ].join('\n');
      const text = await claude(key, [{ type: 'text', text:
        `教科: ${clip(body.subject, 20)}\n学年: ${clip(body.grade, 20)}\n問題: ${clip(body.question, 300)}\n` +
        (body.context ? `例文: ${clip(body.context, 100)}\n` : '') +
        `（先生だけが知っている答え: ${clip(body.answer, 50)}）` }], system, 150);
      const answer = clip(body.answer, 50);
      return ok({ text: answer && text.includes(answer) ? 'もういちど 問題を よく読んでみよう。' : text });
    }
    if (body.action === 'judge') {
      const img = clip(body.image, 400_000).replace(/^data:image\/\w+;base64,/, '');
      const expected = clip(body.expected, 20);
      const system = '子どもが手書きした漢字を採点する先生。字のきれいさではなく、正しい字か（とめ・はね・画の数・形のちがい）を見る。返事は JSON だけ: {"ok":true/false,"comment":"ひらがな多めで30文字以内のひとこと"}';
      const text = await claude(key, [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: img } },
        { type: 'text', text: `お手本: 「${expected}」（よみ: ${clip(body.reading, 30)}）。この手書きは「${expected}」と正しく書けている？` },
      ], system, 120);
      const m = text.match(/\{[\s\S]*\}/);
      const r = m ? JSON.parse(m[0]) : { ok: false, comment: text.slice(0, 40) };
      return ok({ ok: !!r.ok, comment: clip(r.comment, 60) });
    }
    return new Response(JSON.stringify({ error: 'unknown action' }), { status: 400, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e).slice(0, 200) }), { status: 502, headers });
  }
});
