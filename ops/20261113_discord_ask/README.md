# ProbaLab Chat (/ask) — preview/discord-ask

A Cloudflare Pages Function answers `/ask` and the **Ask ProbaLab** message action
through Discord Interactions. There is no always-on gateway process. This is a
**separate** Discord app from "ProbaLab Members" (role sync).

Do not merge to main, do not change production environment variables, and do not
register commands or post in Discord until John says so.

## Interactions URL (preview)

Once this branch is on Cloudflare Pages:

`https://preview-discord-ask.probalab-site.pages.dev/api/discord/interactions`

In the Discord Developer Portal, ProbaLab Chat → General Information → Interactions
Endpoint URL, paste that address. Discord sends a signed PING; the Function must
return PONG, which needs `DISCORD_CHAT_PUBLIC_KEY` on the **Preview** environment.

Application id: `1570608256567476334`  
Public key (not a secret): `afb11be3be9aa79e176f54d9da78cb76c758c46a20d88e234f1ee919fc604f53`

## Cloudflare Pages → probalab-site → Preview variables

| Name | Type | Notes |
|---|---|---|
| `DISCORD_ASK_ENABLED` | Plain text | `on` |
| `DISCORD_CHAT_APP_ID` | Plain text | `1570608256567476334` |
| `DISCORD_CHAT_PUBLIC_KEY` | Plain text | `afb11be3be9aa79e176f54d9da78cb76c758c46a20d88e234f1ee919fc604f53` |
| `DISCORD_CHAT_BOT_TOKEN` | **Secret** | ProbaLab Chat bot token, via secret-request only |
| `DISCORD_PREMIUM_ROLE_ID` | Plain text | Same Premium role id already used for role sync |
| `DISCORD_ASK_CHANNEL_IDS` | Plain text | Comma-separated channel ids for `#general-chat` and `#questions` only (Developer Mode → Copy Channel ID) |
| `LLM_API_KEY` | **Secret** | Via secret-request only |
| `LLM_MODEL` | Plain text, optional | Default `gpt-4.1-mini` |
| `LLM_API_URL` | Plain text, optional | Default `https://api.openai.com/v1/chat/completions` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Already on Pages; used for rate limits and Premium desk snapshots |

Do not add these to the Production environment.

`DISCORD_CHAT_BOT_TOKEN` is only needed for the command-registration script, not for
answering an interaction (follow-ups use the interaction token).

## Command registration (do not run until John asks)

```bash
export DISCORD_CHAT_APP_ID=1570608256567476334
export DISCORD_CHAT_BOT_TOKEN=...   # from secret-request, never pasted into chat
export DISCORD_GUILD_ID=...         # preview: guild commands appear at once
node tools/register-discord-ask.mjs
```

## Database

`discord_ask_rate_limits.sql` is additive. **Ask before applying it** to the
production (or shared) Supabase database. Until then the Function falls back to
the Cache API for the 5/hour and 30/day cap.

Rollback: `drop table public.discord_ask_rate_limits;`

## Behaviour

- Answers only in the allowlisted channels, only when `@mentioned` via `/ask` or
  **Ask ProbaLab**.
- Public lights, records and today's site predictions: everyone in those channels.
- John / ProbaLab / Sniper desk snapshots (`tips_page_snapshot` ids `latest`,
  `probalab`, `sniper`): Premium role only.
- Never mentions NHL Value, NBA Price Gap, or NFL Totals.
- No bet placing, no dollar staking advice, no guaranteed-winner talk.
- If a figure is missing, the bot says so and tags `@teamjwc`.
- Off unless `DISCORD_ASK_ENABLED=on`.

## Tests

```bash
node tests/discord-ask.test.mjs
```

## Rollback

Set `DISCORD_ASK_ENABLED=off` (or remove the Preview variables) and clear the
Interactions Endpoint URL in the Developer Portal. The Function becomes a no-op
for commands; unsigned requests still get 401.
