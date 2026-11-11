-- Role-based ranking, step 1 (blueprint 4a · 4): save the rater's role with each rating.
--
-- Ratings only linked to the person, and people can change their role later. To rank tools
-- "by people in your role", each rating now keeps the role the person had when they rated.
-- The database sets it from the person's profile on every insert or star change, so nobody
-- can set it by hand. Nothing changes on screen yet; step 2 (ordering and "Top rated by …"
-- badges) will read these totals.
--
-- Note: numbered 0007 to follow 0006_tool_not_offered (PR #29). The two are independent and
-- can run in either order on the live database.

alter table public.ratings
  add column rater_role text references public.roles (id) on delete set null;

create index ratings_tool_role_idx on public.ratings (tool_id, rater_role);

-- Existing ratings: use each person's role today (the best we know). The rate-limit trigger is
-- paused so this doesn't change anyone's "rated on" date.
alter table public.ratings disable trigger ratings_rate;
update public.ratings r set rater_role = p.role_id
  from public.profiles p where p.id = r.user_id and p.role_id is not null;
alter table public.ratings enable trigger ratings_rate;

create function public.set_rating_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Always the rater's current profile role, whatever the client sent.
  select p.role_id into new.rater_role from public.profiles p where p.id = new.user_id;
  return new;
end $$;
revoke execute on function public.set_rating_role() from public, anon, authenticated;

create trigger ratings_role before insert or update on public.ratings
  for each row execute function public.set_rating_role();
