-- スマホへのお知らせ（Web プッシュ）。
-- push_subs: 通知を受ける端末（1端末1行）。送り先（ブラウザがくれる URL と鍵）と、だれの分を受けるか
-- push_profiles: 人ごとの お知らせ一覧（タイトル・時刻・曜日だけ）。owner は 家族のアカウントの id、ログインなしなら dev:端末
create table if not exists public.push_subs (
  device text primary key,                 -- アプリが作る端末の番号
  endpoint text not null unique,
  sub jsonb not null,                      -- { endpoint, keys: { p256dh, auth } }
  secret_hash text not null,               -- 端末の合言葉の SHA-256（ほかの人が書きかえられないように）
  tz text not null default 'Asia/Tokyo',
  owner text not null,                     -- auth のユーザー id か dev:端末
  profiles jsonb not null default '[]',    -- この端末で受けとる人（プロフィール id）
  sent jsonb not null default '{}',        -- { reminderId: 'YYYY-MM-DD' } 同じ日に2回送らない
  last_result text,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;  -- アプリ（anon）からは直接さわれない
grant select, insert, update, delete on public.push_subs to service_role;

create table if not exists public.push_profiles (
  owner text not null,
  profile text not null,
  reminders jsonb not null default '[]',   -- [{ id, kind, title, body, time:'07:00', days:[0-6], skipUntil:'YYYY-MM-DD' }]
  updated_at timestamptz not null default now(),
  primary key (owner, profile)
);
alter table public.push_profiles enable row level security;
grant select, insert, update, delete on public.push_profiles to service_role;
grant insert on public.app_secret to service_role;        -- VAPID の鍵を はじめてしまうため

-- 毎分 manabi-push を呼ぶ。合言葉は DB の中だけで作って、呼ぶたびに表から読む
create extension if not exists pg_cron;
create extension if not exists pg_net;
insert into public.app_secret (name, value)
  values ('push_cron', encode(extensions.gen_random_bytes(24), 'hex'))
  on conflict (name) do nothing;

select cron.unschedule('manabi-push-tick') where exists (select 1 from cron.job where jobname = 'manabi-push-tick');
select cron.schedule('manabi-push-tick', '* * * * *', $$
  select net.http_post(
    url := 'https://gfuzmxkhhouhdrpjwajn.supabase.co/functions/v1/manabi-push',
    headers := jsonb_build_object('content-type', 'application/json',
                                  'x-cron', (select value from public.app_secret where name = 'push_cron')),
    body := '{"action":"tick"}'::jsonb,
    timeout_milliseconds := 20000
  );
$$);

-- pg_net の返事の記録は ふえるので 1日1回かたづける
select cron.unschedule('manabi-push-cleanup') where exists (select 1 from cron.job where jobname = 'manabi-push-cleanup');
select cron.schedule('manabi-push-cleanup', '17 4 * * *', $$ delete from net._http_response where created < now() - interval '1 day' $$);
