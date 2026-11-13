-- ProbaLab Chat /ask rate limits (per Discord user).
-- Written only by Pages Functions with the service role key (api/discord/interactions).
-- RLS on with no policies: anon and authenticated clients can neither read nor write it.
-- Do not apply this to the production database until John says so.
-- The preview bot still works without this table (it falls back to the Cache API).
create table if not exists public.discord_ask_rate_limits (
  discord_user_id  text not null check (discord_user_id ~ '^[0-9]{15,22}$'),
  bucket           text not null check (bucket in ('hour', 'day')),
  window_start     timestamptz not null,
  hit_count        integer not null default 0 check (hit_count >= 0),
  updated_at       timestamptz not null default now(),
  primary key (discord_user_id, bucket)
);

alter table public.discord_ask_rate_limits enable row level security;
revoke all on public.discord_ask_rate_limits from anon, authenticated;

comment on table public.discord_ask_rate_limits is
  'Per-user rate limits for ProbaLab Chat /ask. Service role only. 5/hour and 30/day, counted in this table when present.';
