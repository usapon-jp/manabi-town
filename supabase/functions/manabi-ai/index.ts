// まなびタウンの AI 受け口（Supabase Edge Function）。
// Claude API のキーは Supabase のシークレット ANTHROPIC_API_KEY にだけ置く。アプリやGitHubには置かない。
// action:
//   ping  … キーが置かれているかだけ確認（Claude は呼ばない）
//   hint  … 問題のヒント（答えは言わない。level 1→3 で少しずつ近づく）
//   judge … 手書きの字の画像が、お手本の漢字と同じか判定
//   quiz  … にがてな単元から、にた問題（3択）を作る
//   scan  … プリントや範囲の写真から、テスト・宿題の予定（教科・名前・はんい・日にち）を読み取る（Haiku）
//   ask   … ピヨ先生への質問（チャット・写真つき・図（SVG）つき）。Haiku
//   usage … 今月の AI 使用額（推定）。せってい画面に出す。Claude は呼ばない
//   plan  … ピヨ先生と作戦会議（進め方・得意苦手・理解度チェックする単元を決める）。ここだけ Sonnet
//   consult … おとなモードの「ピヨと相談」。ルーティーンと目標・試験を会話で決める（Haiku）
import { recordUsage, summary } from '../_shared/usage.ts';

const MODEL = 'claude-haiku-5-5';
const MODEL_SMART = 'claude-sonnet-5-5';
const ALLOWED = ['https://usapon-jp.github.io', 'http://localhost:8766'];

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
    'Content-Type': 'application/json',
  };
}

// 呼び出しごとに使用量を ai_usage に記録する（action・モデル・トークン数・推定料金だけ）
async function callClaude(action: string, who: string, key: string, content: unknown[], system: string, maxTokens = 200, model = MODEL, history?: unknown[]) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: history || [{ role: 'user', content }] }),
  });
  const j = await r.json();
  if (j?.usage) await recordUsage(action, who, model, j.usage);
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
  const claude = (...a: Parameters<typeof callClaude> extends [string, string, ...infer R] ? R : never) =>
    callClaude(String(body.action || '?'), String(body.who || ''), ...a);
  try {
    if (body.action === 'ping') {
      if (!key) return ok({ ready: false });
      const text = await claude(key, [{ type: 'text', text: 'ひらがなで「はい」とだけ答えて' }], 'みじかく答える', 10);
      return ok({ ready: true, text });
    }
    if (body.action === 'usage') {
      const s = await summary();
      return ok({ monthUsd: s.monthUsd, limitUsd: s.limitUsd, ratio: s.ratio, forecastUsd: s.forecastUsd, yenPerUsd: s.yenPerUsd, level: s.level, byWho: s.byWho });
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
    if (body.action === 'quiz') {
      const count = Math.min(5, Math.max(1, Number(body.count) || 3));
      const system = [
        '日本の小学生・中学生向けの問題を作る先生。学年の教科書の範囲で、正確な問題だけを作る。',
        `3択の問題を ${count}もん作る。正解は1つだけ。答えがあいまいな問題・ひっかけ問題は作らない。`,
        '問題文はみじかく。学年で習っていない漢字はひらがなに。計算問題は答えを自分でたしかめてから出す。',
        '返事は JSON だけ: {"questions":[{"q":"問題文","options":["A","B","C"],"answer":正解の番号(0から)}]}',
      ].join('\n');
      // 教科書やプリントの写真（さいだい3まい）があれば、その内容から問題を作る
      const pics = (Array.isArray(body.images) ? body.images : []).slice(0, 3)
        .map((x: unknown) => clip(x, 1_500_000).replace(/^data:image\/\w+;base64,/, '')).filter(Boolean)
        .map((data: string) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }));
      const sys2 = pics.length ? system + '\n写真に教科書やプリントが写っている。その内容にそった問題だけを作る。読めない所は問題にしない。' : system;
      const text = await claude(key, [...pics, { type: 'text', text:
        `教科: ${clip(body.subject, 20)}\n学年: ${clip(body.grade, 20)}\nにがてなところ: ${clip(body.topic, 80)}` }], sys2, 900);
      const m = text.match(/\{[\s\S]*\}/);
      const r = m ? JSON.parse(m[0]) : { questions: [] };
      return ok({ questions: Array.isArray(r.questions) ? r.questions.slice(0, count) : [] });
    }
    if (body.action === 'plan') {
      const system = [
        'あなたは「ピヨ先生」。小学生・中学生の家庭教師で、いま子どもと はじめての「作戦会議」をしている。',
        'やさしい話し言葉、ひらがな多め（学年で習う漢字はOK）。1回の発言は2文・80文字くらいまで。質問は1回に1つだけ。',
        '子どもが選びやすいよう、答えの候補を2〜4こ出す（自由に書いてもいい）。責めない。できていることを具体的にほめる。',
        '聞く順番: (1)勉強の進め方（毎日少しずつ／まとめて、いつやる、何分くらい集中できる）(2)とくいな教科・にがてな教科と、そのわけ',
        '(3)いまの宿題やテストの進め方（にがては少しずつ、覚える教科は何周するか など。予定がわかっていれば具体的に）',
        '(4)さいごに「理解度チェック」する教科と単元を2〜3こ、子どもといっしょに決める。',
        '8〜12往復くらいで終える。子どもが「おわり」と言ったら すぐまとめる。',
        '返事は JSON だけ。会話中: {"say":"…","choices":["…"],"done":false}',
        'まとめ: {"say":"まとめのひとこと","done":true,"profile":{"style":"進め方を1文","when":"やる時間","focusMin":集中できる分(数),"strong":["教科"],"weak":["教科"],"plans":[{"subject":"教科","how":"進め方を1文"}],"check":[{"subject":"教科","topic":"単元"}],"memo":"先生が覚えておくこと1〜2文"}}',
      ].join('\n');
      const ctx = `名前: ${clip(body.name, 20)}\n学年: ${clip(body.grade, 20)}\nいまの予定:\n${clip(body.items, 1500) || '（まだない）'}\n` +
        (body.profile ? `前の作戦会議のメモ: ${clip(body.profile, 1200)}\n` : '');
      const log = (Array.isArray(body.messages) ? body.messages : []).slice(-30)
        .map((m: { role?: string; text?: string }) => ({ role: m?.role === 'assistant' ? 'assistant' : 'user', content: clip(m?.text, 500) }))
        .filter((m: { content: string }) => m.content);
      // 最初は user から。同じ役が続かないように まとめる
      const history: { role: string; content: string }[] = [{ role: 'user', content: `${ctx}\n（作戦会議をはじめてください）` }];
      for (const m of log) {
        const last = history[history.length - 1];
        if (last.role === m.role) last.content += `\n${m.content}`; else history.push(m);
      }
      if (history[history.length - 1].role !== 'user') history.push({ role: 'user', content: '（つづけて）' });
      const text = await claude(key, [], system, 700, MODEL_SMART, history);
      const m = text.match(/\{[\s\S]*\}/);
      let r: Record<string, unknown> = {};
      try { r = m ? JSON.parse(m[0]) : {}; } catch { r = {}; }
      return ok({
        say: clip(r.say || text.replace(/\{[\s\S]*\}/, ''), 300),
        choices: Array.isArray(r.choices) ? r.choices.slice(0, 4).map((c) => clip(c, 40)) : [],
        done: !!r.done,
        profile: r.done && r.profile && typeof r.profile === 'object' ? r.profile : null,
      });
    }
    if (body.action === 'consult') {
      const system = [
        'あなたは「ピヨ」。大人（子どもの保護者）が自分のために使う習慣・勉強アプリの相談相手。',
        'ていねいすぎない、やわらかい話し言葉。1回の発言は2文・90文字くらいまで。質問は1回に1つだけ。',
        '相手が選びやすいよう、答えの候補を2〜4こ出す（自由に書いてもいい）。責めない。無理のない小さな量からすすめる。',
        '聞くこと: (1)やりたいこと（毎日の習慣、資格や勉強、健康、くらし、しゅみ など。決まっていなければ一緒に考える）',
        '(2)1日に使える時間と、やりやすい時間帯（あさ・ひる・よる）(3)目標があれば いつまでに（試験日など）',
        '5〜8往復くらいで まとめる。相手が「まとめて」と言ったら すぐまとめる。すでにあるルーティーン・目標と重ならないようにする。',
        '返事は JSON だけ。会話中: {"say":"…","choices":["…"],"done":false}',
        'まとめ: {"say":"まとめのひとこと","done":true,"plan":{"routines":[{"title":"短い名前(15文字まで)","days":[曜日 0=日〜6=土。毎日なら空],"when":"あさ|ひる|よる|"}],"goals":[{"type":"goal|test","title":"短い名前","subject":"資格・勉強|仕事|健康|くらし|しゅみ|その他","range":"テキストのページなど（なければ空）","minutes":1日の分(数),"date":"YYYY-MM-DD"}],"memo":"次に相談するとき覚えておくこと1文"}}',
        'routines は 1〜4こ、goals は 0〜2こ。test は試験日が決まっているときだけ。date は今日より後。',
      ].join('\n');
      const ctx = `今日: ${clip(body.today, 10)}\n名前: ${clip(body.name, 20)}\nいまのルーティーン・目標:\n${clip(body.current, 1500) || '（まだない）'}\n` +
        (body.memo ? `前の相談のメモ: ${clip(body.memo, 300)}\n` : '');
      const log = (Array.isArray(body.messages) ? body.messages : []).slice(-24)
        .map((m: { role?: string; text?: string }) => ({ role: m?.role === 'assistant' ? 'assistant' : 'user', content: clip(m?.text, 500) }))
        .filter((m: { content: string }) => m.content);
      const history: { role: string; content: string }[] = [{ role: 'user', content: `${ctx}\n（相談をはじめてください）` }];
      for (const m of log) {
        const last = history[history.length - 1];
        if (last.role === m.role) last.content += `\n${m.content}`; else history.push(m);
      }
      if (history[history.length - 1].role !== 'user') history.push({ role: 'user', content: '（つづけて）' });
      const text = await claude(key, [], system, 900, MODEL, history);
      const m = text.match(/\{[\s\S]*\}/);
      let r: Record<string, unknown> = {};
      try { r = m ? JSON.parse(m[0]) : {}; } catch { r = {}; }
      return ok({
        say: clip(r.say || text.replace(/\{[\s\S]*\}/, ''), 300),
        choices: Array.isArray(r.choices) ? r.choices.slice(0, 4).map((c) => clip(c, 40)) : [],
        done: !!r.done,
        plan: r.done && r.plan && typeof r.plan === 'object' ? r.plan : null,
      });
    }
    if (body.action === 'scan') {
      const img = clip(body.image, 1_800_000).replace(/^data:image\/\w+;base64,/, '');
      if (!img) return new Response(JSON.stringify({ error: 'no-image' }), { status: 400, headers });
      const system = [
        '学校のプリント・時間割・テスト範囲表・ワークの計画表などの写真から、子どもがやることを読み取る。',
        '返事は JSON だけ: {"items":[{"type":"test"|"homework","subject":"国語|算数|数学|理科|社会|英語|音楽|美術|体育|技術家庭|その他","title":"短い名前","range":"p.40〜52 など（なければ空）","date":"YYYY-MM-DD"}],"note":"読めなかった所や、あいまいな所を短く"}',
        'テストの日・提出日が書いてあるものだけを items にする。日にちに年がなければ、今日の日付に近い未来の年にする。',
        '読めない・自信がない所は作らずに note に書く。たくさんあっても20件まで。',
      ].join('\n');
      const text = await claude(key, [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } },
        { type: 'text', text: `今日は ${clip(body.today, 10)}。学年: ${clip(body.grade, 20)}。このプリントから予定を読み取って。` },
      ], system, 1500);
      const m = text.match(/\{[\s\S]*\}/);
      let r: Record<string, unknown> = {};
      try { r = m ? JSON.parse(m[0]) : {}; } catch { r = {}; }
      const items = (Array.isArray(r.items) ? r.items : []).slice(0, 20)
        .filter((i: Record<string, unknown>) => i && i.title && /^\d{4}-\d{2}-\d{2}$/.test(String(i.date)))
        .map((i: Record<string, unknown>) => ({ type: i.type === 'test' ? 'test' : 'homework', subject: ['国語', '理科', '社会', '英語'].includes(clip(i.subject, 10)) ? clip(i.subject, 10) : /算数|数学/.test(clip(i.subject, 10)) ? '算数・数学' : 'その他', title: clip(i.title, 40), range: clip(i.range, 40), date: String(i.date) }));
      return ok({ items, note: clip(r.note, 120) });
    }
    if (body.action === 'ask') {
      const system = [
        'あなたは「ピヨ先生」。小学生・中学生の家庭教師で、子どもの質問に答える。やさしい話し言葉、ひらがな多め（学年で習う漢字はOK）。',
        `子どもは ${clip(body.grade, 20)}。教科: ${clip(body.subject, 20) || 'わからない'}。学年に合った言葉と やり方で。`,
        'いきなり答えだけを言わない。考え方 → 途中 → 答え の順に、みじかく。「わからない」と言われたら もっとやさしく言いかえる。',
        '1回の返事は200文字くらいまで。まちがいを おそれない・責めない。最後に「わかったかな？」など、つぎに つながる ひとことを。',
        '図があると分かりやすい時だけ（わり算の図・線分図・グラフ・さんかく・ものの流れなど）、svg に図を入れる。なければ空文字。',
        'svg のきまり: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"> で始める。シンプルに。文字は font-family="sans-serif" font-size 14〜18 の日本語OK。線は #5e4a35、ぬりは #8fa871 #f0d59a #dfe9c9 など。背景は透明。script・外部参照・画像は使わない。',
        '写真がついていたら、その問題を読んで答える。読めない所は、読めないと言う。',
        '返事は JSON だけ: {"say":"返事","svg":"<svg…>…</svg> か空文字"}',
      ].join('\n');
      const raw = (Array.isArray(body.messages) ? body.messages : []).slice(-10)
        .map((m: { role?: string; text?: string }) => ({ role: m?.role === 'assistant' ? 'assistant' : 'user', content: clip(m?.text, 800) }))
        .filter((m: { content: string }) => m.content);
      // deno-lint-ignore no-explicit-any
      const msgs: { role: string; content: any }[] = [];
      for (const m of raw) {
        const last = msgs[msgs.length - 1];
        if (last && last.role === m.role) last.content += `\n${m.content}`; else msgs.push(m);
      }
      while (msgs.length && msgs[0].role !== 'user') msgs.shift();
      if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return new Response(JSON.stringify({ error: 'no-question' }), { status: 400, headers });
      const img = clip(body.image, 1_800_000).replace(/^data:image\/\w+;base64,/, '');
      if (img) {
        const lastM = msgs[msgs.length - 1];
        lastM.content = [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } }, { type: 'text', text: String(lastM.content) }];
      }
      const text = await claude(key, [], system, 1500, MODEL, msgs);
      const m = text.match(/\{[\s\S]*\}/);
      let r: Record<string, unknown> = {};
      try { r = m ? JSON.parse(m[0]) : {}; } catch { r = {}; }
      let svg = typeof r.svg === 'string' ? r.svg.trim() : '';
      if (!/^<svg[\s>]/.test(svg) || svg.length > 12000 || /<script|<foreignObject|\son\w+\s*=|href\s*=\s*["']?(https?:|javascript:|data:)/i.test(svg)) svg = '';
      return ok({ say: clip(r.say || text.replace(/\{[\s\S]*\}/, ''), 600), svg });
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
