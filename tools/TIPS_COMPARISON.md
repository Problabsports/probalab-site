# Private tips comparison data (additive schema v1)

The existing snapshot keeps all original data, including CL. The UI hides pure CL rows, includes dual-tagged PL bets as PL, and never shows CL summary cards.

`tips_snapshot_enrichment.py` adds `pl_results` to each refreshed private snapshot, from every settled, captured PL ledger pick (not just John's bets). Each row has pick_id, sport, game, selection, light, result, tipoff_utc, settled_utc, game_date, price_taken, units, pnl_units, tag=PL. P/L is hypothetical flat 1u at captured price, before commission. Unknown prices give null units/P&L. No model fair odds are used. Existing CL data stays untouched.

The box exporter has the small hook in `tips-exporter-integration.patch` applied. It loads a copy of the helper beside export_tips.py (override with TIPS_SNAPSHOT_ENRICHER). The helper copy is installed at `/workspace/betting/scripts/tips_page/tips_snapshot_enrichment.py`, so unrelated site branch checkouts cannot remove it. It runs inside build(), so all existing automatic uploads carry the extension. To update, copy this site's helper into that directory. If missing, the exporter falls back to the old shape and the UI explicitly reports history unavailable.

Unknown stake rows display a dash, including their historical placeholder 0 P/L. A genuine known zero stake/P&L remains zero. Invalid blank-game/numeric-selection rows are hidden, not deleted. Summary counts and chart are computed from visible valid rows, never pre-aggregated CL-inclusive totals.
