// まなびタウンの AI 受け口（Supabase Edge Function）。
// Claude API のキーは Supabase のシークレット ANTHROPIC_API_KEY にだけ置く。アプリやGitHubには置かない。
// action:
//   ping  … キーが置かれているかだけ確認（Claude は呼ばない）
//   hint  … 問題のヒント（答えは言わない。level 1→3 で少しずつ近づく）
//   judge … 手書きの字の画像が、お手本の漢字と同じか判定
//   quiz  … にがてな単元から、にた問題（3択）を作る
//   scan  … プリントや範囲の写真から、テスト・宿題の予定（教科・名前・はんい・日にち）を読み取る（Haiku）
//   ask   … ピヨ先生への質問（チャット・写真つき・図（SVG）つき）。mode: ask / zu（図で）/ yomu（英語よみあげ）/ talk（英会話）。Haiku（算数・数学・理科の計算と図は Sonnet）
//   usage … 今月の AI 使用額（推定）。せってい画面に出す。Claude は呼ばない
//   plan  … ピヨ先生と作戦会議（進め方・得意苦手・理解度チェックする単元を決める）。ここだけ Sonnet
//   consult … おとなモードの「ピヨと相談」。ルーティーンと目標・試験を会話で決める（Haiku）
//   town  … まちづくり（3Dの草原）の つかいかたの しつもん。アプリが送る つかいかた（js/townguide.js）を読んで答える（Haiku）
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
async function callClaude(action: string, who: string, key: string, content: unknown[], system: string, maxTokens = 200, model = MODEL, history?: unknown[], think = false) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    // Haiku 5.5 はなにも書かないと「考える」が入り、短い max_tokens を考えるだけで使いきって 答えが空になる（ヒントが出なかった原因）。
    // 短い答えでよい Haiku の呼び出しは 考えずに答えさせる（Sonnet 5.5 は disabled を受けつけないので そのまま）
    // think=true（しつもん・図）は 考えてから答える（計算まちがいを へらす）。そのぶん max_tokens を大きく
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: history || [{ role: 'user', content }], ...(model === MODEL && !think ? { thinking: { type: 'disabled' } } : {}) }),
  });
  const j = await r.json();
  if (j?.usage) await recordUsage(action, who, model, j.usage);
  if (!r.ok) throw new Error(j?.error?.message || `claude ${r.status}`);
  return (j.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('').trim();
}

const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);

// ピヨ先生の返事を { say, svg, en, fix } にする。JSON でも、文章＋<svg>＋<en> でも、```でかこまれていても読める
export function parseReply(text: string) {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  let t = String(text || '');
  const j = t.match(/^\s*(?:```(?:json)?\s*)?(\{[\s\S]*\})\s*(?:```)?\s*$/);
  if (j) {
    try {
      const o = JSON.parse(j[1]);
      if (o && typeof o === 'object') return { say: str(o.say), svg: str(o.svg), en: str(o.en), fix: str(o.fix) };
    } catch { /* JSON がこわれていたら 下で 文章として読む */ }
  }
  const svgM = t.match(/<svg[\s>][\s\S]*?<\/svg>/i);
  const svg = svgM ? svgM[0].trim() : '';
  t = t.replace(/<svg[\s>][\s\S]*?<\/svg>/gi, '').replace(/<svg[\s>][\s\S]*$/i, '');   // とちゅうで切れた図も すてる
  const enM = t.match(/<en>([\s\S]*?)<\/en>/i);
  const fixM = t.match(/<fix>([\s\S]*?)<\/fix>/i);
  t = t.replace(/<(en|fix)>[\s\S]*?<\/\1>/gi, '');
  // JSON がこわれていたときの のこり（"say": "…"）から 文だけ とりだす
  const sayM = t.match(/"say"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  let say = sayM ? sayM[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : t;
  say = say.replace(/```[a-z]*\s*/gi, '').replace(/^[\s{}"',:]+|[\s{}"',:]+$/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return { say, svg, en: enM ? enM[1].trim() : '', fix: fixM ? fixM[1].trim() : '' };
}

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
        'まとめ: {"say":"まとめのひとこと","done":true,"plan":{"routines":[{"title":"短い名前(15文字まで)","days":[曜日 0=日〜6=土。毎日なら空],"weekly":週に何回(数。曜日を決めず「週に3回」のようなときだけ。それ以外は0),"when":"あさ|ひる|よる|"}],"goals":[{"type":"goal|test","title":"短い名前","subject":"資格・勉強|仕事|健康|くらし|しゅみ|その他","range":"テキストのページなど（なければ空）","minutes":1日の分(数),"date":"YYYY-MM-DD"}],"memo":"次に相談するとき覚えておくこと1文"}}',
        'routines は 1〜4こ、goals は 0〜2こ。test は試験日が決まっているときだけ。date は今日より後。',
        '「週に3枚イラストを描く」のように回数で決めたいものは weekly にする（やれた日にスタンプ、達成でボーナスが出る）。',
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
      // mode: ask（ふつう）/ zu（かならず図）/ yomu（英語よみあげ）/ talk（英会話）
      const mode = ['zu', 'yomu', 'talk'].includes(String(body.mode)) ? String(body.mode) : 'ask';
      const grade = clip(body.grade, 20);
      const svgRule = 'svg のきまり: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"> で始める。シンプルに。文字は font-family="sans-serif" font-size 14〜18 の日本語OK。線は #5e4a35（太さ2）、ぬりは #8fa871 #f0d59a #dfe9c9 #f4c7b8 など。背景は透明。script・外部参照・画像・アニメーションは使わない。';
      // 図（SVG）は JSON に入れると 引用符がこわれやすいので、ふつうの文章＋タグで返してもらう
      const FREE_FORMAT = '返事の書き方: まず せつめいを ふつうの文章で書く。図があるときは そのあとに <svg …>…</svg> を そのまま書く。読み上げたい英語があれば <en>英語</en> と書く。JSON・```・マークダウンは使わない。';
      const base = [
        'あなたは「ピヨ先生」。小学生・中学生の家庭教師で、子どもの質問に答える。やさしい話し言葉、ひらがな多め（学年で習う漢字はOK）。',
        `子どもは ${grade}。教科: ${clip(body.subject, 20) || 'わからない'}。学年に合った言葉と やり方で。`,
      ];
      const byMode: Record<string, string[]> = {
        ask: [
          'いきなり答えだけを言わない。考え方 → 途中 → 答え の順に、みじかく。「わからない」と言われたら もっとやさしく言いかえる。',
          '答える前に 計算を自分で たしかめる（まちがえたまま書かない）。1回の返事は300文字くらいまで。まちがいを おそれない・責めない。最後に「わかったかな？」など、つぎに つながる ひとことを。',
          '答える前に「この問題は 図があると ずっと分かりやすいか」を自分で判断する。図形・角度・面積や体積・グラフや関数・速さ・割合や比・線分図で考える文章題・場合の数・てこや電気・天気図・地図・年表・ものの流れ などは 図（svg）を つける。ことばの意味・漢字・英単語・暗記なら 図は いらない。図をつけたら せつめいの中で「図を見てね」と ひとこと言う。',
          svgRule,
          '英語の文や単語を声で聞かせると良い時は、<en>英語</en> で つける。',
          '写真がついていたら、その問題を読んで答える。読めない所は、読めないと言う。',
          FREE_FORMAT,
        ],
        zu: [
          '子どもは「図で おしえて」とたのんでいる。かならず 図（svg）を1まい つける。図が主役で、せつめいは 図の見かた・考え方を150文字くらいで。',
          '算数・数学の図形は、座標をきちんと計算して正確にかく（辺の長さ・角度・平行・直角の記号・補助線は点線 stroke-dasharray="5 4"）。長さや角度の数字・頂点の記号（A B C）を図に書く。',
          '文章題は線分図・面積図・表、割合は帯グラフ、関数は座標軸つきのグラフ、理科は かんたんな模式図に。だいじな所は ぬりで目立たせる。文字が図と重ならないように。',
          '答える前に 計算を自分で たしかめる（まちがえたまま書かない）。いきなり答えだけを言わない。考え方 → 途中 → 答え の順に。最後に つぎに つながる ひとことを。',
          svgRule,
          '写真がついていたら、その問題を読んで図にする。読めない所は、読めないと言う。',
          FREE_FORMAT,
        ],
        yomu: [
          '子どもは「英語を よみあげて」とたのんでいる。アプリが en を英語の声で読み上げる。',
          'en には 読み上げる英語だけを入れる（日本語・記号・番号は入れない。600文字まで）。子どもが書いた英語は、つづりのまちがいを直して en に入れる。写真なら写っている英文を そのまま書き起こす。',
          '日本語で「〇〇を英語で」と聞かれたら、学年に合った かんたんな英語にして en に入れる。',
          'say には みじかい日本語の意味と、読み方のポイント（つなげて読む所・アクセント）を1つ、100文字くらいで。発音をカタカナで書きすぎない。',
          '返事は JSON だけ: {"say":"日本語","en":"English"}',
        ],
        talk: [
          `子どもと英会話の練習をする。${grade}が分かる、みじかく かんたんな英語で（小学生は1文5〜8語、中学生は習った文法まで）。`,
          'en には ピヨ先生の英語の返事（1〜2文）。かならず 質問で終えて、会話が つづくようにする。話題は 学校・すきなもの・きょうのこと・食べ物・どうぶつ など。',
          'say には en の日本語の意味を みじかく（ひらがな多め）。',
          '子どもの英語に まちがいがあれば、fix に正しい英文を1つだけ（責めない）。まちがいがなければ fix は空文字。子どもが日本語で書いたら、fix に その英語の言い方を入れて、en で やさしく つづける。',
          '返事は JSON だけ: {"en":"English","say":"日本語の意味","fix":"直した英文 か空文字"}',
        ],
      };
      const system = [...base, ...byMode[mode]].join('\n');
      const raw = (Array.isArray(body.messages) ? body.messages : []).slice(-12)
        .map((m: { role?: string; text?: string }) => ({ role: m?.role === 'assistant' ? 'assistant' : 'user', content: clip(m?.text, 800) }))
        .filter((m: { content: string }) => m.content);
      // deno-lint-ignore no-explicit-any
      const msgs: { role: string; content: any }[] = [];
      for (const m of raw) {
        const last = msgs[msgs.length - 1];
        if (last && last.role === m.role) last.content += `\n${m.content}`; else msgs.push(m);
      }
      // ピヨ先生から話しはじめた会話（英会話）は、先頭に「はじめ」を おく
      if (msgs.length && msgs[0].role !== 'user') msgs.unshift({ role: 'user', content: '（はじめよう）' });
      if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return new Response(JSON.stringify({ error: 'no-question' }), { status: 400, headers });
      // 写真をつけると msgs と raw の中身が 配列に かわるので、その前に しつもんの文を とっておく
      const lastText = String(raw.filter((m: { role: string }) => m.role === 'user').pop()?.content || '');
      const img = clip(body.image, 1_800_000).replace(/^data:image\/\w+;base64,/, '');
      if (img) {
        const lastM = msgs[msgs.length - 1];
        lastM.content = [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } }, { type: 'text', text: String(lastM.content) }];
      }
      // 計算や図形の しつもんは まちがえないよう Sonnet（考えてから答える）。ほかの しつもんは Haiku が考えてから答える
      // 教科が算数・数学／「図で」／しつもんの文に 式・計算・図形のことばが あるとき
      const mathWords = /[0-9０-９]+\s*[+\-−×÷*/=＝＋－]|計算|けいさん|式|方程式|関数|グラフ|面積|体積|割合|わりあい|速さ|比例|反比例|図形|角度|三角形|円周|分数|小数|約分|通分|証明|確率/;
      // 理科の計算（密度・電流・圧力・溶解度 など）も まちがえやすいので Sonnet。理科で 数字が出てくる しつもんも
      const sciWords = /密度|濃度|のうど|電流|電圧|抵抗|オーム|電力|圧力|水圧|浮力|てこ|滑車|かっしゃ|溶解度|質量|化学反応式|熱量|発熱量|湿度|しつど|露点|震源|初期微動|g\/cm|cm3|㎤|[0-9０-９]+\s*(?:g|ｇ|kg|mA|A|V|Ω|W|J|N|Pa|℃|%|％)/;
      const isSci = /理科/.test(clip(body.subject, 20)) && (/[0-9０-９]/.test(lastText) || sciWords.test(lastText));
      const isMath = /算数|数学/.test(clip(body.subject, 20)) || mode === 'zu' || isSci || (mode === 'ask' && (mathWords.test(lastText) || sciWords.test(lastText)));
      const thinkHard = mode === 'ask' || mode === 'zu';
      // 本気モード（メガネ）: 子どもが えらんだら しつもんでも かならず Sonnet
      const smart = isMath || (body.smart === true && thinkHard);
      const text = await claude(key, [], system, thinkHard ? 12000 : mode === 'talk' ? 500 : 1500, smart ? MODEL_SMART : MODEL, msgs, thinkHard);
      const r = parseReply(text);
      let svg = r.svg;
      if (!/^<svg[\s>]/.test(svg) || svg.length > 20000 || /<script|<foreignObject|<image|\son\w+\s*=|href\s*=\s*["']?(https?:|javascript:|data:)/i.test(svg)) svg = '';
      const en = clip(r.en, 800);
      const fix = clip(r.fix, 200);
      const say = clip(r.say || (mode === 'zu' && !svg ? 'ごめんね、図が うまく かけなかった。もういちど 聞いてみてね' : ''), 2000);
      return ok({ say, svg, en, fix });
    }
    if (body.action === 'town') {
      // まちづくりの つかいかた。説明書（guide）は アプリが送る（3Dが かわっても デプロイ いらず）
      const keys = (Array.isArray(body.keys) ? body.keys : []).map((k: unknown) => clip(k, 12)).filter((k: string) => /^[a-z]{2,12}$/.test(k)).slice(0, 40);
      const system = [
        'あなたは「ピヨ」。まなびタウン（勉強すると まちが そだつ アプリ）の まちづくり画面の あんない役。子どもの「どうやるの？」に答える。',
        `子どもは ${clip(body.grade, 20) || '小学生'}。やさしい話し言葉、ひらがな多め（小4までに習う漢字はOK）。`,
        '答えは 下の「つかいかた」に 書いてある ことだけを もとにする。書いていない 操作や ボタンを 作り話しない。',
        'まだ できない ことを 聞かれたら「まだ できないけど、ほしいって つたえておくね」と言う。こまっている・うまく いかない ときは、ためせる ことを 1つ 言って「つたえておくね」と言う。',
        '手じゅんは 1→2→3 の ように みじかく、多くて 4つ。1回の 返事は 150文字くらいまで。ボタンは 形と 場所（右下・左上 など）で 言う。',
        `とくに 見せたい ボタンが あれば、さいごに <show>キー</show> を 1つだけ つける（なければ つけない）。キー: ${keys.join(' ')}`,
        'さいごに しつもんの しゅるいを <tag>つかいかた</tag> <tag>ほしい</tag> <tag>こまった</tag> <tag>その他</tag> の どれか 1つで つける。',
        'マークダウン・JSON は 使わない。',
        '【つかいかた】',
        clip(body.guide, 8000),
      ].join('\n');
      const msgs: { role: string; content: string }[] = [];
      for (const m of (Array.isArray(body.messages) ? body.messages : []).slice(-10)) {
        const role = m?.role === 'assistant' ? 'assistant' : 'user';
        const content = clip(m?.text, 400);
        if (!content) continue;
        const last = msgs[msgs.length - 1];
        if (last && last.role === role) last.content += `\n${content}`; else msgs.push({ role, content });
      }
      if (msgs.length && msgs[0].role !== 'user') msgs.shift();
      if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return new Response(JSON.stringify({ error: 'no-question' }), { status: 400, headers });
      let text = await claude(key, [], system, 600, MODEL, msgs);
      const showM = text.match(/<show>\s*([a-z]+)\s*<\/show>/i);
      const tagM = text.match(/<tag>\s*([^<]{1,10}?)\s*<\/tag>/);
      text = text.replace(/<(show|tag)>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*$/, '').replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n').trim();
      const show = showM && keys.includes(showM[1].toLowerCase()) ? showM[1].toLowerCase() : '';
      const tag = tagM && ['つかいかた', 'ほしい', 'こまった', 'その他'].includes(tagM[1]) ? tagM[1] : '';
      return ok({ say: clip(text, 800), show, tag });
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
