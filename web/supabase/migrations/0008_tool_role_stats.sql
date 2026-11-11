-- Role-based ranking, step 2 (blueprint 4a · 4): rating totals per tool and per rater role.
--
-- Uses ratings.rater_role from 0007. Returns totals only, never who rated, and only for a
-- tool and role with at least 10 ratings: below that a "by role" average is too easy to sway
-- (and with very few raters it could hint at one person's rating). The score is the same fair
-- (Bayesian) average as tool_stats(): 5 virtual ratings at that role's average across all
-- tools (or 3.5 before any ratings), so a handful of ratings can't tip a tool.

create function public.tool_role_stats()
returns table (tool_id text, role_id text, rating_count int, avg_stars numeric, score numeric)
language sql stable security definer set search_path = public as $$
  with r as (
    select tool_id, rater_role as role_id, avg(stars)::numeric as a, count(*)::int as n
    from ratings where rater_role is not null
    group by tool_id, rater_role
  ),
  g as (
    select rater_role as role_id, avg(stars)::numeric as m
    from ratings where rater_role is not null
    group by rater_role
  )
  select r.tool_id, r.role_id, r.n, round(r.a, 2),
         round((5 * coalesce(g.m, 3.5) + r.a * r.n) / (5 + r.n), 3)
  from r left join g on g.role_id = r.role_id
  where r.n >= 10
$$;
grant execute on function public.tool_role_stats() to anon, authenticated;
