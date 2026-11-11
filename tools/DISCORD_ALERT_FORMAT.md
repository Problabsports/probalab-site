# Discord alert format: short and to the point (11 Nov 2026)

For whoever runs the desk scanners on the box (NHL Value, NFL Totals, John's desk, and anything else that posts tips to Discord).
John asked on 11 Nov 2026 for alerts that are "shorter and more to the point". The cloud NBA Price Gap desk already uses this format.

## Format: two lines

```
<emoji> **BACK <Team> $<min price>+**
<Away> @ <Home> · <Day time> · <Book> $<best price> · +<edge>%
```

- Line 1 = what to bet and the lowest price worth taking. Bold. Team nickname only (Flyers, Golden Knights, Trail Blazers, 76ers).
- Line 2 = the game (nicknames, away @ home), short Sydney time ("Thu 1pm", "Thu 12:10pm"; no date, no "AEDT"),
  best Australian price with the book, and the edge to 1 decimal.
- Drop: the desk name header (the channel and the bot name already say it), the model %, "paper 1 unit" (stake is always 1 unit),
  the full date, "AEDT", and anything internal.
- Edge >= 10%: add ` · ⚠️ check news` to line 2 (big edges are usually a stale price or team news).
- One alert per message. Several alerts in one scan can share a message, one blank line apart.
- Betfair: show the raw Betfair price; the min price is raised so it is still worth it after 8% commission.

## Examples

NHL Value (was 4 lines, ~170 characters):
```
🏒 **BACK Flyers $2.53+**
Flyers @ Oilers · Thu 1pm · Betfair $2.77 · +9.3%
```

NBA Price Gap (live in the cloud since 11 Nov):
```
🏀 **BACK Thunder $1.23+**
Wizards @ Thunder · Sun 12:10pm · Unibet $1.25 · +4.6%
```

Daily summary (keep one line):
```
🏒 NHL Value today: 2 of 3 won · +0.85u (overall +3.39u)
```

## Bug seen in the same channel (NHL Value, 11 Nov 6:00pm)

`BACK Vegas Golden Knights · min 1.82 · best Sportsbet 1.82 · +0.0%` was posted. An alert with 0% edge should never go out:
the check should be `edge >= min_edge` (or best price >= min price) **after rounding**, and the min price should be rounded **up**.
Please check the threshold test in the NHL Value scanner.
