-- Voice feedback review (Nov 2026).
-- 1. Admins can correct a transcript while listening, before approving. The first time the text
--    changes, the person's original words are kept in original_body, so nothing is silently rewritten.
-- 2. People can delete their own recording early (the written text stays).
-- 3. Deleting an admin's account no longer fails when they've reviewed feedback: the review
--    stays, and the reviewer link is cleared.
-- 4. The daily cleanup job (/api/cron/purge-voice) also removes recordings with no feedback row,
--    such as those left by deleted accounts. That needs no database change.

alter table public.feedback add column original_body text;
-- Admins (only: the update policy from 0003 allows admins alone) may now change the text.
grant update (body) on public.feedback to authenticated;

create function public.keep_original_feedback()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.body is distinct from old.body and old.original_body is null then
    new.original_body := old.body;
  end if;
  if new.original_body is distinct from old.original_body and old.original_body is not null then
    new.original_body := old.original_body; -- the original can't be overwritten
  end if;
  return new;
end $$;

create trigger feedback_keep_original before update on public.feedback
  for each row execute function public.keep_original_feedback();

-- Remove your own recording: clears the link on your feedback and returns the file path, which the
-- app then deletes from storage (allowed by the policy below). Only for your own feedback.
create function public.remove_my_recording(p_feedback uuid)
returns text language plpgsql security definer set search_path = public as $$
declare path text;
begin
  select audio_path into path from feedback where id = p_feedback and user_id = auth.uid() and audio_path is not null;
  if path is null then
    raise exception 'That recording isn''t yours or is already deleted.' using errcode = 'P0001';
  end if;
  update feedback set audio_path = null where id = p_feedback;
  return path;
end $$;
revoke execute on function public.remove_my_recording(uuid) from public, anon;
grant execute on function public.remove_my_recording(uuid) to authenticated;

create policy "People delete their own voice feedback" on storage.objects
  for delete to authenticated
  using (bucket_id = 'voice-feedback' and (storage.foldername(name))[1] = auth.uid()::text);

-- An admin's account can be deleted even after they've reviewed feedback.
alter table public.feedback drop constraint feedback_reviewed_by_fkey;
alter table public.feedback add constraint feedback_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users (id) on delete set null;
