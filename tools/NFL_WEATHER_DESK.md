# NFL Totals desk (slug: nfl-weather)

Members title: **NFL Totals**. Preview branch `preview/nfl-weather` only.

- Pipeline: `/workspace/betting/scripts/nfl_weather/run_desk.py`
- Private state (watch + tip method fields): `/workspace/betting/data/nfl_weather/state.json`
- Public snapshot: `data/tipsters/nfl-weather.json` (no method / watch list)
- Publish: as soon as the private rule holds (no last-minute gate). Chat alerts stay off.
- Tip row (members): kickoff · game · total · Over/Under · bookie
- Summary: one growth line for this desk only

Do not merge to main until John says so. No alerts.
