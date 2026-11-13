# Discord Premium role (preview/discord-role)

Members link Discord at `/members/discord` (OAuth2 `identify`). The Stripe webhook then adds or
removes the **Premium** role through the Discord REST API with the "ProbaLab Members" bot token.
There is no bot process.

## Database
`member_discord_links.sql` creates `public.member_discord_links` (service role only). It is additive
and unused until the settings below exist.

## Settings (Cloudflare Pages → probalab-site → Settings → Variables and Secrets)
Everything is off unless **all** of these are set in an environment and `DISCORD_ROLE_SYNC=on`.

| Name | Type | Value |
|---|---|---|
| `DISCORD_BOT_TOKEN` | Secret | Bot token of "ProbaLab Members" |
| `DISCORD_CLIENT_SECRET` | Secret | OAuth2 client secret |
| `DISCORD_CLIENT_ID` | Plain text | OAuth2 client ID |
| `DISCORD_GUILD_ID` | Plain text | ProbaLab server ID |
| `DISCORD_PREMIUM_ROLE_ID` | Plain text | ID of the "Premium" role |
| `DISCORD_ROLE_SYNC` | Plain text | `on` |
| `DISCORD_REDIRECT_URI` | Plain text, optional | Override; default is `<request origin>/api/discord/callback` |

Preview only until "make live". Discord redirect for the preview:
`https://preview-discord-role.probalab-site.pages.dev/api/discord/callback`

## Behaviour
- Checkout completed → site access granted → if the email has a linked Discord account, role added.
- Subscription updated/deleted → role follows site access (active, trialing, past_due, paused keep it).
- Owner/admin emails keep the role on revoke, like site access.
- Linked but not in the server yet → member presses "Check again" after joining.
- Discord failures never fail the webhook; the outcome is stored in `role_state` / `last_error`.

## Rollback
Remove the Pages variables (or set `DISCORD_ROLE_SYNC=off`): everything becomes a no-op.
Table: `drop table public.member_discord_links;`
