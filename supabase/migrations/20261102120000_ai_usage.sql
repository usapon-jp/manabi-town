-- AI（Claude API）の呼び出しごとの記録。子どもの名前や勉強の中身は入れない（数字だけ）。
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  action text not null,          -- hint / ask / plan … どの機能か
  who text not null default '',  -- 子どもは学年（中2・小6・小4）だけ。おとなは「おとな:ハンドルネーム」
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0
);
create index if not exists ai_usage_created_at_idx on public.ai_usage (created_at);
-- アプリ（anon）からは読み書きさせない。Edge Function が service_role で書く・読む。
alter table public.ai_usage enable row level security;

-- Edge Function だけが読む小さな設定（manabi-usage の合言葉のハッシュなど）
create table if not exists public.app_secret (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_secret enable row level security;
