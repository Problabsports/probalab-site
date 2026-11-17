-- Read only. Run before and after apply.sql. Before: 65%+ Best value games show light SUPER, best_value missing.
-- After: they show light GREEN + best_value true; SUPER only between 60% and 64%. Expected on 18 Nov 2026 (season 2027):
--   GREEN  true  settled 20 (15 won)  |  SUPER true settled 10 (4 won)  |  upcoming LAC 77.7%, LAL 76.4% GREEN true
with f as (select public.public_feed() j),
g as (select e from f, jsonb_array_elements(f.j->'games') e)
select e->>'light' light, e->>'best_value' best_value, e->>'status' = 'post' settled, count(*) n,
       count(*) filter (where (e->>'won')::boolean) won, min((e->>'pick_p')::numeric) min_p, max((e->>'pick_p')::numeric) max_p,
       string_agg(case when e->>'status' = 'pre' then (e->>'pick') || ' ' || (e->>'pick_p') end, ', ') upcoming
from g
where e->>'light' = 'SUPER' or (e->>'best_value')::boolean is true
group by 1, 2, 3 order by 3, 1;
