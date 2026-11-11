-- Phase 2: accounts. Every signed-in person gets a profile (created automatically on sign-up)
-- holding their onboarding answers. Admins are listed in their own table so nobody can make
-- themselves an admin by editing their profile. The database enforces who can see what.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role_id text references public.roles (id),
  subjects text[] not null default '{}',
  systems text[] not null default '{}',        -- school systems they use, e.g. Schoology, Infinite Campus
  onboarded_at timestamptz,
  vendor_opt_in boolean not null default false, -- Phase 3: share their name with tool makers only if true
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_by uuid references auth.users (id),
  added_at timestamptz not null default now()
);

-- True when the given user (by default, whoever is calling) is an admin.
create function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = uid)
$$;

-- Create a profile for each new account, using the name from Google/Microsoft when there is one.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Admins add or remove other admins. The last admin can't remove themselves.
create function public.set_admin(target uuid, make boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change admins';
  end if;
  if make then
    insert into public.admins (user_id, added_by) values (target, auth.uid()) on conflict do nothing;
  else
    if (select count(*) from public.admins) <= 1 then
      raise exception 'There must be at least one admin';
    end if;
    delete from public.admins where user_id = target;
  end if;
end $$;

alter table public.profiles enable row level security;
alter table public.admins enable row level security;

create policy "People read their own profile; admins read all" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "People update their own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "People see whether they are an admin; admins see all" on public.admins
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Profiles can only change these columns from the app (email and dates are managed by the database).
revoke update on public.profiles from authenticated;
grant update (display_name, role_id, subjects, systems, onboarded_at, vendor_opt_in) on public.profiles to authenticated;

revoke execute on function public.set_admin(uuid, boolean) from public, anon;
grant execute on function public.set_admin(uuid, boolean) to authenticated;
