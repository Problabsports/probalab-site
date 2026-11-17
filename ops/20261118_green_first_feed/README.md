# Green first in the NBA feed (18 Nov 2026)

Rule (same as the site since c2e6f3f, and `lights.json`): an NBA game whose shown chance (rounded down) is in the green
range, 65%+, is **GREEN** even when the price beats our fair price; it carries `best_value: true` and counts once, in the
green record. **Best value** as the light is only for Best value picks from 60% up to 64%. The word "Super" is never
shown publicly (SUPER stays the internal key).

## Where the light comes from
* `nba-collect` (Supabase Edge Function, project `zwdpsereqicvzbtfrrnd`, v32) decides the light in `priceAndAlert`
  (`light = "SUPER"` when the value test passes, around line 516 of `index.ts`) and stores it in `predictions` /
  `model_prices`; `pretip_snapshots` freezes it at tip-off.
* `public_feed()` (SQL, same project) returns `coalesce(pretip_snapshots.light, predictions.light)` as `light`.
* `probalab-feed` (Edge Function) only calls `public_feed()`; `/api/feed` on the site caches it for 90 s.

**This change is made in `public_feed()` only.** `nba-collect` is not changed: its SUPER light also drives private
betting logic that is not a display label (the tips-chat "BACK / BET 1u" alert, the `alerts.signal_type = 'super'`
row used for CLV, the held-value recheck). Stored rows are not rewritten, so the history is untouched and this is
fully reversible.

## Effect (checked read-only against live data on 18 Nov 2026)
| feed sends | before | after |
|---|---|---|
| settled NBA Best value 65%+ (20 games, 15 won) | `SUPER` | `GREEN`, `best_value: true` |
| settled NBA Best value 60–64% (10 games, 4 won) | `SUPER` | `SUPER`, `best_value: true` |
| upcoming LAC 77.7%, LAL 76.4% | `SUPER` | `GREEN`, `best_value: true` |
| every other game | unchanged | unchanged, `best_value: false` (null with no light) |

The site already shows and counts these games this way, so its pages and records do not change.

## Other readers of the feed light: check before applying
These read `light` from the feed and will see GREEN instead of SUPER for 65%+ Best value games:
* **John's NBA rule (results_5pm / john_desk `export_tips.py`, `ledger_lib/tipmatch.py`)**: `qualifies = light == "GREEN"
  and price in range`. Today a 65%+ SUPER game never qualifies; after this it can. That changes John's rule
  bookkeeping, so decide first whether that is wanted (if not, those two checks should use `light == "GREEN" and not
  best_value`).
* **Ledger capture (`ledger_lib/probalab.py`)** stores the feed light for new rows: new 65%+ Best value tips are stored
  GREEN. The lights patch v2 makes the members-desk export carry `best_value`; the capture itself does not store it.
* tips_check, sheets_8am, telegram_tips treat GREEN and SUPER both as tips: no change in what counts.

## Steps (Supabase SQL editor, project zwdpsereqicvzbtfrrnd)
1. Merge and deploy the site branch first (`preview/green-first-pipeline`): the site reads `best_value`.
2. Save the current definition (for the record): `select pg_get_functiondef('public.public_feed()'::regprocedure);`
   -> `before.sql` in this folder.
3. Run `verify.sql`: 65%+ Best value games show `SUPER`.
4. Run `apply.sql`. It edits the live definition in place (one expression). It stops with an error and changes nothing
   unless the expected text is found exactly once; running it twice does nothing.
5. Run `verify.sql` again: expect `GREEN / true` settled 20 (15 won), `SUPER / true` settled 10 (4 won), plus today's
   upcoming 65%+ Best value games as `GREEN / true`.
6. Wait about 2 minutes for the feed caches, then check `/api/feed`: the Clippers / Lakers games have `"light": "GREEN",
   "best_value": true`, and probalabsports.com still shows them Green + Best value.

Rollback: run `rollback.sql` (same safety checks). The site keeps working with either feed.
