# Championship on John's desk (7 Nov 2026)

John asked for the EFL Championship on his members desk, working the same as the other sports: the site's Championship picks appear in **Upcoming**, and a Championship bet he has placed appears in **Tips**, then in **Results** and **Summary**.

## Already done on the site (this repo)
- The desk understands sport code **`CHAMP`**. It is in the sport dropdown (shown as "Championship"), the Summary sport buttons, and the Upcoming sport order (after EPL). Sport-code cells show `CHAMP`.
- The lobby card and the desk text now say five sports.
- Nothing else changes. With no `CHAMP` rows in the snapshot, the desk looks exactly as before.

## Still to do on the box (`/workspace/betting/scripts/tips_page/export_tips.py` and the ledger capture)
Do everything the same way as the EPL; only the source files and codes differ.

1. **Capture PL picks.** Read `https://probalabsports.com/data/championship-picks.json`. It has the same fields as `epl-picks.json`: game_id, round, start_utc, home, away, p_home, p_draw, p_away, pick (home/draw/away) and light (GREEN/ORANGE/RED).
   - Map each row to a ledger pick with `sport = "CHAMP"`, `pick_id = "PLCHAMP-<game_id>"` and `market = "Match Result"`.
   - `selection` is the home team, the away team or "Draw" (as EPL); `win_pct` is the pick's chance; `light` comes from the file.
   - Lights apply to every Championship pick: green 55%+, orange 45–55%, red under 45%. Unlike the EPL, there is no switch-on date.
   - `min_price` and `fair_price` are 1 ÷ win_pct, as for EPL.
2. **Upcoming (`today`).** Add the captured CHAMP picks, with `tipoff_utc` from `start_utc` and the game written as "Home v Away".
3. **Match Betfair bets to picks.** On Betfair the Championship is the "English Championship" competition, Match Odds market. Match a bet to `PLCHAMP-<id>` by teams and kick-off, as EPL bets are matched to `PLEPL-<id>`.
   - Team names in the feed are ESPN display names, e.g. "Queens Park Rangers", "West Bromwich Albion", "Sheffield Wednesday", "Preston North End". Add aliases where Betfair differs (QPR, West Brom, Sheff Wed, Preston).
   - A matched bet goes to `open_bets` with `tag = "PL"`, then to `results` when settled. These are the same rules as EPL, including `light_at_placement` and `rule_flags` (UNDER_MIN).
4. **Settle and PL record.** Results are in `https://probalabsports.com/data/championship-grades.json` (same shape as `epl-grades.json`, keyed by game_id; `graded: true` only when two score sources agree). Use it for settlement checks and for `pl_results` (flat 1u at the captured price), the same as EPL.
5. **Tipster meta.** In the snapshot, `tipsters.john.focus` becomes "NBA, NFL, NHL, EPL and Championship".

## Check after deploying
- The snapshot `today` includes `sport: "CHAMP"` rows on Championship match days. The next round is Tuesday/Wednesday midweek, then the weekend.
- A Championship bet placed on Betfair shows on the desk's Tips tab with the Championship light.
- The desk's Summary "Championship" button filters both John's record and the PL comparison.
