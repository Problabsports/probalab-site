# NBA Price Gap desk: fixes (8 Nov 2026)

For whoever updates the NBA Price Gap scanner on the box. Agreed with John on 8 Nov 2026 after the desk posted **both sides** of WAS @ OKC
(OKC $1.23 Unibet "+3.02%" and WAS $6.40 Sportsbet "+3.98%") one minute apart.

## What went wrong
1. **Both sides passed.** Each team is checked on its own, and two different books each beat Pinnacle's fair price.
   1/1.23 + 1/6.40 = 96.9%, i.e. Unibet + Sportsbet together were an arbitrage. That nearly always means a stale price (one AU book slow, or the
   Pinnacle snapshot old), not real value on both teams. Posting both looks broken to members.
2. **Proportional de-vig favours underdogs.** The desk turns Pinnacle prices into fair chances with (1/price) ÷ (1/home + 1/away). That spreads the
   margin evenly, which overstates the underdog's chance (favourite–longshot bias). It's why the desk's alerts are "usually on the underdog".
   With the power method (agreed standard for fair prices; see edgebot-cloud-plan "Lessons") this game becomes, assuming a ~2.5% Pinnacle margin:
   OKC fair 85.1% → edge +4.6%; WAS fair 14.9% → edge −4.3%. The Washington alert was not value.

## Changes

### 1. Fair chance = power method
Replace the proportional de-vig with the power method:

```python
def power_devig(prices):
    """Pinnacle decimal prices for all outcomes -> fair probabilities (sum to 1)."""
    q = [1.0 / p for p in prices]
    lo, hi = 0.5, 5.0                      # solve sum(q_i ** k) == 1 for k
    for _ in range(100):
        k = (lo + hi) / 2
        s = sum(x ** k for x in q)
        if s > 1: lo = k                   # sum too big -> raise k
        else: hi = k
    k = (lo + hi) / 2
    return [x ** k for x in q]
```

Everything else stays: edge = best AU price × fair chance (Betfair after 8% commission: 1 + (price − 1) × 0.92); alert at edge ≥ 3%;
minimum price = 1.03 ÷ fair chance, rounded **up** to 2 decimals.

### 2. One side per game
- Work out both sides in the same scan. If both pass, alert **only the side with the bigger edge** (after change 1) and log
  `both_sides = true` on the alert, so we can see how often it happens and how those bets do.
- Once a game has been alerted, **never alert the other side of that game** later (until tip-off). A later "back the other team" message is the same
  problem a few hours apart.
- Optional config `skip_two_sided` (default false): if true, skip games where both sides pass instead of posting the bigger one.

### 3. Message format (Discord #nba-price-gap and Telegram)
One alert per message, header once, team names, no "@" for prices, no internal words like "paper":

```
🏀 NBA Price Gap · BACK Oklahoma City Thunder
Wizards at Thunder · Sun 8 Nov, 12:10pm AEDT
Best price: $1.23 at Unibet. Take $1.23 or better.
Edge: 4.6% above the fair price · Stake: 1 unit
```

- Line 2: "Away at Home" with full team names and local time (AEDT/AEST).
- Line 3: best AU price and book; "Take $X or better" = the minimum price from change 1.
- Line 4: edge to 1 decimal; stake in units (keep "paper" only in the internal log, not the post).

### 4. Re-check the paper record
Re-score every paper alert so far with the power method and report by price band (under $1.50, $1.50–2.50, $2.50–4, over $4):
alerts that would no longer qualify, ROI and CLV per band. If the over-$4 band is negative, that confirms the bias.

### 5. Site text (after 1–2 are live)
`data/tipsters/nba-price-gap.json` (`about`, `pitch`) still describes the proportional method and says alerts are "usually on the underdog".
Update to: "...turns that into a fair chance (power de-vig, which corrects the long-shot bias) ... one side per game at most." Claude can make this
site change once the box is updated.
