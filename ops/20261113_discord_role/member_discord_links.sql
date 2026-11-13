-- ProbaLab Members: which Discord account belongs to which membership email.
-- Written only by Pages Functions with the service role key (api/discord/*, api/stripe-webhook).
-- RLS on with no policies: anon and authenticated clients can neither read nor write it.
create table if not exists public.member_discord_links (
  email            text primary key check (email = lower(email)),
  discord_user_id  text not null unique check (discord_user_id ~ '^[0-9]{15,22}$'),
  discord_username text,
  linked_at        timestamptz not null default now(),
  role_state       text check (role_state in ('granted', 'removed', 'not_in_guild', 'error')),
  role_synced_at   timestamptz,
  last_error       text
);

alter table public.member_discord_links enable row level security;
revoke all on public.member_discord_links from anon, authenticated;

comment on table public.member_discord_links is
  'Member email -> linked Discord user (OAuth2 identify). Drives the Premium role via the ProbaLab Members bot. Service role only.';
