# NFL Totals desk (slug: nfl-weather)

Members title: **NFL Totals**. Live on production (`main`, probalabsports.com). John approved this desk on 7 Nov 2026.

- Pipeline: `/workspace/betting/scripts/nfl_weather/run_desk.py`
- Private state (watch + tip method fields): `/workspace/betting/data/nfl_weather/state.json`
- Public snapshot: `data/tipsters/nfl-weather.json` (no method / watch list)
- Publish to Upcoming: as soon as the private rule holds. Chat alerts stay off.
- Tips tab: same open tips only in the last 4 hours before kickoff (not duplicated on Tips earlier).
- Tip row (members): kickoff · game · total · Over/Under · bookie
- Summary: one growth line for this desk only

No alerts.
