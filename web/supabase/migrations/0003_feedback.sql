-- Phase 3: ratings, written and voice feedback, admin approval, membership credits, rankings.
-- Anyone signed in can rate and give feedback. Feedback is private until an admin approves it;
-- approved feedback earns membership days (an admin setting) and appears on the tool without names.

create table public.ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  tool_id text not null references public.tools (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, tool_id)
);
create index ratings_tool_idx on public.ratings (tool_id);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tool_id text not null references public.tools (id) on delete cascade,
  kind text not null check (kind in ('text', 'voice')),
  body text not null check (char_length(body) between 20 and 4000),
  audio_path text,                         -- voice-feedback bucket path; deleted after 30 days
  role_id text references public.roles (id),
  share_name boolean not null default false, -- the person agreed to share their name with the tool maker
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  admin_note text,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index feedback_status_idx on public.feedback (status, created_at);
create index feedback_tool_idx on public.feedback (tool_id) where status = 'approved';

-- Membership time earned (Phase 4 adds paid memberships and reads these).
create table public.membership_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  days int not null check (days > 0),
  source text not null check (source in ('feedback', 'admin')),
  feedback_id uuid unique references public.feedback (id) on delete set null,
  created_at timestamptz not null default now()
);
create index credits_user_idx on public.membership_credits (user_id);

insert into public.app_settings (key, value) values
  ('feedback_reward_days', '30'),
  ('feedback_reward_monthly_limit', 'null')   -- null = no limit; admins can set a number
on conflict (key) do nothing;

alter table public.ratings enable row level security;
alter table public.feedback enable row level security;
alter table public.membership_credits enable row level security;

create policy "People manage their own ratings" on public.ratings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "People add their own feedback" on public.feedback
  for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy "People see their own feedback; admins see all" on public.feedback
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "Admins review feedback" on public.feedback
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Only these columns can be set when adding feedback (status, review fields stay with admins).
revoke insert, update on public.feedback from authenticated;
grant insert (user_id, tool_id, kind, body, audio_path, role_id, share_name) on public.feedback to authenticated;
grant update (status, admin_note, reviewed_by, reviewed_at) on public.feedback to authenticated;

create policy "People see their own credits; admins see all" on public.membership_credits
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Admins may change settings (prices, reward days); everyone can already read them.
create policy "Admins change settings" on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- On approval: stamp the reviewer and award membership days (once per feedback, within the monthly limit).
create function public.on_feedback_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  reward int := coalesce((select (value #>> '{}')::int from app_settings where key = 'feedback_reward_days'), 30);
  monthly int := (select nullif(value #>> '{}', 'null')::int from app_settings where key = 'feedback_reward_monthly_limit');
  this_month int;
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
    end if;
  end if;
  return new;
end $$;
create trigger feedback_review before update on public.feedback
  for each row execute function public.on_feedback_review();

-- Public numbers per tool: average stars, rating count, approved feedback count, and a ranking
-- score. The score is a Bayesian average: each tool starts with 5 "virtual" ratings at the
-- editorial score (or the site-wide average), so one 5-star rating can't outrank 200 ratings of 4.6.
create function public.tool_stats()
returns table (tool_id text, avg_stars numeric, rating_count int, feedback_count int, score numeric)
language sql stable security definer set search_path = public as $$
  with r as (select tool_id, avg(stars)::numeric as a, count(*)::int as n from ratings group by tool_id),
       f as (select tool_id, count(*)::int as n from feedback where status = 'approved' group by tool_id),
       g as (select coalesce(avg(stars), 3.5)::numeric as m from ratings)
  select t.id,
         round(r.a, 2),
         coalesce(r.n, 0),
         coalesce(f.n, 0),
         round((5 * coalesce(t.editorial_score, g.m) + coalesce(r.a * r.n, 0)) / (5 + coalesce(r.n, 0)), 3)
  from tools t cross join g
  left join r on r.tool_id = t.id
  left join f on f.tool_id = t.id
$$;

-- Approved feedback for one tool, without names or account ids.
create function public.approved_feedback(p_tool text)
returns table (id uuid, body text, kind text, role_label text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, f.body, f.kind, r.label, f.created_at
  from feedback f left join roles r on r.id = f.role_id
  where f.tool_id = p_tool and f.status = 'approved'
  order by f.created_at desc
  limit 20
$$;

grant execute on function public.tool_stats() to anon, authenticated;
grant execute on function public.approved_feedback(text) to anon, authenticated;

-- Voice recordings: a private bucket. People upload into a folder named with their account id;
-- they and admins can listen. Files are deleted after 30 days by /api/cron/purge-voice.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-feedback', 'voice-feedback', false, 10485760, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'])
on conflict (id) do nothing;

create policy "People upload their own voice feedback" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'voice-feedback' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "People and admins listen to voice feedback" on storage.objects
  for select to authenticated
  using (bucket_id = 'voice-feedback' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
