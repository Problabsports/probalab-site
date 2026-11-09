# Rollback — injury all sports

## Site (edge enrich + UI)

1. Revert or close PR `preview/injury-all-sports`.
2. Redeploy previous production commit once Cloudflare Pages Functions are healthy.

## NBA public_feed

No change in this pack to the live NBA SQL. If a future NFL SQL migration is applied from `nfl_public_feed_injury.sql`, restore the prior function body from `nfl_public_feed_injury.before.sql` (filled when migration is applied).

## Do not

- Do not flip light colours
- Do not post Discord/Telegram
