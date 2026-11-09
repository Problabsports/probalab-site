-- SKETCH ONLY — not applied.
-- Goal: ship injury_warning / injury_note on the NFL public feed the same way as NBA.
-- Source table TBD (nfl_injuries_current or ESPN ingest). Key rule: QB + skill/OL uncertain.
-- Fill nfl_public_feed_injury.before.sql from pg_get_functiondef before applying.

-- Placeholder: document intent for Models / DBA. Edge enrich covers the site until this lands.
SELECT 'nfl injury public_feed migration not applied — site uses ESPN edge enrich' AS status;
