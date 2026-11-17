-- Green first in the NBA feed (18 Nov 2026). public_feed() only; stored predictions / snapshots are not touched.
-- A Best value pick (light SUPER) whose shown chance is in the NBA green range (65%+, rounded down, same as the site)
-- is sent as light GREEN with best_value true. Best value as the light stays only from 60% up to the green cut-off.
-- Every game gets best_value (true / false / null when there is no light).
-- The cut-offs are lights.json's nba.green_min (0.65) and best_value.min_p (0.60); tests/green-first-pipeline.test.mjs
-- checks they still match.
--
-- How: edits the live function definition in place (one expression), so the rest of public_feed() stays exactly as
-- deployed. Stops with an error, changing nothing, unless the expected text is found exactly once. Safe to re-run.
-- Order: deploy the site change first (it reads best_value), then run this. Rollback: rollback.sql.
do $$
declare
  d text;
  old_expr constant text := 'coalesce(s.light, p.light) light,';
  new_expr constant text := 'case when coalesce(s.light, p.light) = ''SUPER'' and floor(round(coalesce(s.pick_p, p.pick_p)::numeric, 3) * 100 + 0.0000001) >= 65 then ''GREEN'' else coalesce(s.light, p.light) end light,
         (coalesce(s.light, p.light) = ''SUPER'' and floor(round(coalesce(s.pick_p, p.pick_p)::numeric, 3) * 100 + 0.0000001) >= 60) best_value, -- green first (ops/20261118_green_first_feed)';
begin
  d := pg_get_functiondef('public.public_feed()'::regprocedure);
  if position('ops/20261118_green_first_feed' in d) > 0 then
    raise notice 'public_feed(): green first already applied, nothing changed';
    return;
  end if;
  if (length(d) - length(replace(d, old_expr, ''))) / length(old_expr) <> 1 then
    raise exception 'public_feed(): expected "%" exactly once; the live function differs from 18 Nov. Nothing changed.', old_expr;
  end if;
  execute replace(d, old_expr, new_expr);
  raise notice 'public_feed(): green first applied';
end $$;
