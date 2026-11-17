-- Rollback for apply.sql: puts back the original light expression in public_feed() and drops best_value.
-- Stops with an error, changing nothing, unless the green-first text is found exactly once. Safe to re-run.
-- The site keeps working either way (it reads the old SUPER light and the new best_value flag).
do $$
declare
  d text;
  old_expr constant text := 'coalesce(s.light, p.light) light,';
  new_expr constant text := 'case when coalesce(s.light, p.light) = ''SUPER'' and floor(round(coalesce(s.pick_p, p.pick_p)::numeric, 3) * 100 + 0.0000001) >= 65 then ''GREEN'' else coalesce(s.light, p.light) end light,
         (coalesce(s.light, p.light) = ''SUPER'' and floor(round(coalesce(s.pick_p, p.pick_p)::numeric, 3) * 100 + 0.0000001) >= 60) best_value, -- green first (ops/20261118_green_first_feed)';
begin
  d := pg_get_functiondef('public.public_feed()'::regprocedure);
  if position('ops/20261118_green_first_feed' in d) = 0 then
    raise notice 'public_feed(): green first not applied, nothing changed';
    return;
  end if;
  if (length(d) - length(replace(d, new_expr, ''))) / length(new_expr) <> 1 then
    raise exception 'public_feed(): green-first text was edited by hand; restore from before.sql instead. Nothing changed.';
  end if;
  execute replace(d, new_expr, old_expr);
  raise notice 'public_feed(): green first rolled back';
end $$;
