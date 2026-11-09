# Injury watch — all sports (10 Nov 2026)

Same public fields as NBA: `injury_warning` (bool) + `injury_note` (string).
Lights are never changed. Closing line always:

> Light not changed by this. Players listed may miss the game or play reduced minutes, so factor that in.

## Sources and key-player rules

| Sport | Source | Key-player rule | Feed path |
| --- | --- | --- | --- |
| NBA | Supabase `public_feed` + `injuries_current` / v2 rotation | Uncertain (Q/D/GTD/Out+GTD) averaging ≥20 min | Already live in `public_feed` |
| NFL | ESPN `site.api.../football/nfl/injuries` | QB any uncertain; RB/WR/TE/OL when Out/Doubtful/IR/Questionable | Edge enrich until `public_feed` (NFL) ships fields; SQL sketch in `nfl_public_feed_injury.sql` |
| NHL | ESPN `.../hockey/nhl/injuries` | G: Out/Doubtful/IR/Day-to-day/Questionable; skaters: Out/Doubtful/Day-to-day/Questionable (IR skipped — long-term noise; proxy for top-6 F / top-4 D / starter G) | Edge enrich on `/today` + hubs |
| EPL | ESPN `.../soccer/eng.1/injuries` | Out/Doubtful/Questionable/Day-to-day | Edge enrich |
| Championship | ESPN `.../soccer/eng.2/injuries` | Same as EPL | Edge enrich |
| Tennis | — | **Skipped** — no reliable free pre-match injury/withdrawal feed keyed to our fixtures | — |

## Site wiring

- `functions/_shared/injury-enrich.js` — ESPN → `injury_warning` / `injury_note`
- `functions/_shared/injury-warning.js` — UI badge (all sports)
- `functions/today.js` + `functions/_shared/site.js` — render badge on lists/cards

## Rollback

See `ROLLBACK.md`. Edge enrich is code-only; revert the preview branch / PR. NBA SQL rollback is unchanged from prior `public_feed_out_note` ops.
