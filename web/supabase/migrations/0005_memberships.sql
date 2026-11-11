-- Phase 4a: memberships. A person is a member while they have paid time (a Stripe subscription,
-- written only by the server's verified webhook) or earned time (approved feedback). Members-only
-- prompt text is never sent to anyone else: the database hands out previews instead.

-- Paid time. One row per person; only the server (service key) writes it, after checking Stripe's signature.
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  plan text check (plan in ('monthly', 'yearly')),
  status text not null default 'incomplete',     -- Stripe's status: active, past_due, canceled, ...
  paid_through timestamptz,                       -- member until this moment (end of the paid period)
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Stripe webhook events already handled, so a repeated event is never applied twice.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

-- Earned time. Set only by the database (feedback approvals and the trial setting), never by the app:
-- profiles' update grant (0002) lists the columns people may change, and this isn't one of them.
alter table public.profiles add column earned_until timestamptz;

insert into public.app_settings (key, value) values
  ('price_monthly', '"Under review"'),   -- display text only; the real price lives in Stripe
  ('price_yearly', '"Under review"'),
  ('trial_days', '0'),                   -- free days for new accounts; 0 = no trial
  ('free_plays', '["lesson", "family-email", "iep-goals", "agenda", "college"]'),  -- the sample plays
  ('free_system_prompts', '[]')
on conflict (key) do nothing;

alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;

create policy "People see their own subscription; admins see all" on public.subscriptions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.subscriptions from anon, authenticated;
revoke all on public.stripe_events from anon, authenticated;

-- True while the given person (by default, whoever is calling) has paid or earned time left.
create function public.is_member(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from subscriptions where user_id = uid and paid_through > now())
      or exists (select 1 from profiles where id = uid and earned_until > now())
$$;

-- The caller's membership, for their account page.
create function public.my_membership()
returns table (member boolean, paid_through timestamptz, earned_until timestamptz, plan text, status text, cancel_at_period_end boolean)
language sql stable security definer set search_path = public as $$
  select public.is_member(p.id), s.paid_through, p.earned_until, s.plan, s.status, coalesce(s.cancel_at_period_end, false)
  from profiles p left join subscriptions s on s.user_id = p.id
  where p.id = auth.uid()
$$;

-- ---- Members-only prompt text ----
-- Prompt text is no longer readable straight from the tables. Everyone reads it through
-- play_texts() / system_prompt_texts(), which give members (and admins) the full text and
-- everyone else the first line as a preview. Which items are free is an admin setting.

revoke select on public.plays from anon, authenticated;
grant select (id, no, title, roles, subjects, sdg, inclusion, touches_student_info, tools) on public.plays to anon, authenticated;
revoke select on public.system_prompts from anon, authenticated;
grant select (id, title, roles, where_key, where_text) on public.system_prompts to anon, authenticated;

-- First line of a prompt, cut to about 140 characters.
create function public.preview(t text)
returns text language sql immutable set search_path = public as $$
  select rtrim(left(split_part(t, E'\n', 1), 140)) || '…'
$$;

create function public.play_texts()
returns table (id text, prompt text, tip text, members_only boolean, locked boolean)
language sql stable security definer set search_path = public as $$
  with a as (
    select public.is_member() or public.is_admin() as member,
           coalesce((select value from app_settings where key = 'free_plays'), '[]'::jsonb) as free
  )
  select p.id,
         case when x.locked then public.preview(p.prompt) else p.prompt end,
         case when x.locked then '' else p.tip end,
         x.members_only,
         x.locked
  from plays p cross join a
  cross join lateral (select not (a.free ? p.id) as members_only, not (a.free ? p.id) and not a.member as locked) x
$$;

create function public.system_prompt_texts()
returns table (id text, prompt text, example text, try_it text, members_only boolean, locked boolean)
language sql stable security definer set search_path = public as $$
  with a as (
    select public.is_member() or public.is_admin() as member,
           coalesce((select value from app_settings where key = 'free_system_prompts'), '[]'::jsonb) as free
  )
  select s.id,
         case when x.locked then public.preview(s.prompt) else s.prompt end,
         case when x.locked then null else s.example end,
         case when x.locked then '' else s.try_it end,
         x.members_only,
         x.locked
  from system_prompts s cross join a
  cross join lateral (select not (a.free ? s.id) as members_only, not (a.free ? s.id) and not a.member as locked) x
$$;

grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.my_membership() to authenticated;
grant execute on function public.play_texts() to anon, authenticated;
grant execute on function public.system_prompt_texts() to anon, authenticated;
revoke execute on function public.my_membership() from anon;

-- ---- Earned days stack ----
-- Approved feedback adds the reward days after whatever time the person already has (paid or earned),
-- so paid and earned time never overlap. Same rules as 0003 otherwise: once per feedback, monthly limit.
create or replace function public.on_feedback_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  reward int := coalesce((select (value #>> '{}')::int from app_settings where key = 'feedback_reward_days'), 30);
  monthly int := (select nullif(value #>> '{}', 'null')::int from app_settings where key = 'feedback_reward_monthly_limit');
  this_month int;
  added int;
begin
  if new.status is distinct from old.status then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  if new.status = 'approved' and old.status <> 'approved' and reward > 0 then
    select count(*) into this_month from membership_credits
      where user_id = new.user_id and source = 'feedback' and created_at >= date_trunc('month', now());
    if monthly is null or this_month < monthly then
      insert into membership_credits (user_id, days, source, feedback_id)
      values (new.user_id, reward, 'feedback', new.id) on conflict (feedback_id) do nothing;
      get diagnostics added = row_count;
      if added > 0 then
        update profiles p
        set earned_until = greatest(now(), p.earned_until, (select s.paid_through from subscriptions s where s.user_id = p.id))
                           + make_interval(days => reward)
        where p.id = new.user_id;
      end if;
    end if;
  end if;
  return new;
end $$;

-- New accounts get the trial days, if an admin has set any (0 by default).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  trial int := coalesce((select (value #>> '{}')::int from app_settings where key = 'trial_days'), 0);
begin
  insert into public.profiles (id, email, display_name, earned_until)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    case when trial > 0 then now() + make_interval(days => trial) end
  );
  return new;
end $$;
