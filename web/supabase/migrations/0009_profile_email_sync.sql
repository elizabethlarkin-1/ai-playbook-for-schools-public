-- Account settings: keep profiles.email in step with the sign-in email.
--
-- People change their email from Account settings (supabase.auth.updateUser). Supabase only
-- applies the change after both the old and new addresses confirm it (double_confirm_changes).
-- When it does, this trigger copies the new address to the profile, which admins see.
-- People still can't edit profiles.email directly (see 0002: it isn't in their update grant).

create function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;

create trigger on_auth_user_email_change
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.sync_profile_email();
