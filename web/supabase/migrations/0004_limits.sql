-- Hardening: limits that stop spam and oversized data, enforced by the database so they hold
-- no matter how someone calls the API.

-- Profiles: reasonable sizes for the fields people can edit.
alter table public.profiles
  add constraint profiles_display_name_len check (display_name is null or char_length(display_name) <= 120),
  add constraint profiles_subjects_max check (cardinality(subjects) <= 20),
  add constraint profiles_systems_max check (cardinality(systems) <= 30);

alter table public.feedback
  add constraint feedback_admin_note_len check (admin_note is null or char_length(admin_note) <= 1000);

insert into public.app_settings (key, value) values ('feedback_daily_limit', '5')
on conflict (key) do nothing;

-- Feedback: at most N per person per day (admin setting), and one waiting-for-review item per tool.
create function public.enforce_feedback_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  daily int := coalesce((select (value #>> '{}')::int from app_settings where key = 'feedback_daily_limit'), 5);
begin
  if exists (select 1 from feedback where user_id = new.user_id and tool_id = new.tool_id and status = 'pending') then
    raise exception 'You already have feedback on this tool waiting for review. You can add more once it''s reviewed.'
      using errcode = 'P0001';
  end if;
  if (select count(*) from feedback where user_id = new.user_id and created_at > now() - interval '1 day') >= daily then
    raise exception 'You can send up to % pieces of feedback a day. Please try again tomorrow.', daily
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger feedback_limits before insert on public.feedback
  for each row execute function public.enforce_feedback_limits();

-- A small reusable rate limiter: counts actions per person per "bucket" in a time window.
-- Only database functions use it (row-level security on, no policies).
create table public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null default now(),
  hits int not null default 0,
  primary key (user_id, bucket)
);
alter table public.rate_limits enable row level security;

create function public.check_rate_limit(p_bucket text, p_max int, p_window interval)
returns void language plpgsql security definer set search_path = public as $$
declare current_hits int;
begin
  insert into rate_limits as r (user_id, bucket, window_start, hits)
  values (auth.uid(), p_bucket, now(), 1)
  on conflict (user_id, bucket) do update
    set hits = case when r.window_start < now() - p_window then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - p_window then now() else r.window_start end
  returning hits into current_hits;
  if current_hits > p_max then
    raise exception 'Too many % in a short time. Please wait a minute and try again.', p_bucket using errcode = 'P0001';
  end if;
end $$;
revoke execute on function public.check_rate_limit(text, int, interval) from public, anon, authenticated;

-- Ratings: changing your stars is fine, but not more than 30 times a minute.
create function public.enforce_rating_rate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    perform public.check_rate_limit('ratings', 30, interval '1 minute');
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger ratings_rate before insert or update on public.ratings
  for each row execute function public.enforce_rating_rate();

-- Voice uploads: at most 10 recordings per person per day (on top of the bucket's 10 MB and
-- audio-only limits).
drop policy "People upload their own voice feedback" on storage.objects;
create policy "People upload their own voice feedback" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'voice-feedback'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (select count(*) from storage.objects o
         where o.bucket_id = 'voice-feedback' and o.owner_id = auth.uid()::text
           and o.created_at > now() - interval '1 day') < 10
  );
