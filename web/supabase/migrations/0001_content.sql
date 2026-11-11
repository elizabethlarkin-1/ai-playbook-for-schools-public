-- Phase 1: playbook content. Everyone (signed in or not) can read it; only the service role
-- (seed script, later the admin area) can change it. Later phases add accounts, ratings,
-- feedback and memberships in their own migrations.

create table public.roles (
  id text primary key,
  label text not null,
  one text not null,
  tag text not null,
  hint text not null default '',
  sort int not null default 0
);

create table public.subjects (
  id text primary key,
  label text not null,
  sort int not null default 0
);

create table public.tool_categories (
  id text primary key,
  label text not null,
  color text not null
);

create table public.sdg_targets (
  id text primary key,          -- e.g. '4.5'
  text text not null
);

create table public.tools (
  id text primary key,
  name text not null,
  company text not null,
  category_id text not null references public.tool_categories (id),
  ease smallint not null check (ease between 1 and 3),
  verified boolean not null default false,
  subjects text[] not null default '{}',     -- subject ids, or '{all}'
  description text not null,
  uses text[] not null default '{}',
  personas jsonb not null default '[]',      -- [{ id, why, top }]
  free_status text not null check (free_status in ('yes', 'limited', 'no', 'review')),
  pricing text not null,
  privacy jsonb not null,
  connects jsonb,                            -- { roster, lms, grades, paid, note }
  equity jsonb,                              -- { free, device, lang, access }
  review_note text,
  urls text[] not null default '{}',
  editorial_score numeric,                   -- Phase 3: blended with user ratings for ranking
  updated_at timestamptz not null default now()
);

create table public.terms (
  id text primary key,
  abbr text not null,
  full_name text not null,
  kind text not null check (kind in ('school', 'privacy', 'ai')),
  definition text not null
);

create table public.plays (
  id text primary key,
  no int not null unique,
  title text not null,
  roles text[] not null default '{}',
  subjects text[] not null default '{}',
  sdg text[] not null default '{}',
  inclusion boolean not null default false,
  touches_student_info boolean not null default false,
  tools text[] not null default '{}',
  prompt text not null,
  tip text not null default ''
);

create table public.system_prompts (
  id text primary key,
  title text not null,
  roles text[] not null default '{}',
  where_key text not null,
  where_text text not null,
  prompt text not null,
  example text,
  try_it text not null default ''
);

create table public.top_five (
  role_id text not null references public.roles (id),
  rank smallint not null check (rank between 1 and 5),
  kind text not null check (kind in ('play', 'sys')),
  ref_id text not null,
  why text not null,
  primary key (role_id, rank)
);

-- Site-wide settings admins will edit (prices, feedback reward days, "facts checked on").
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index plays_roles_idx on public.plays using gin (roles);
create index tools_subjects_idx on public.tools using gin (subjects);

do $$
declare t text;
begin
  foreach t in array array['roles', 'subjects', 'tool_categories', 'sdg_targets', 'tools', 'terms', 'plays', 'system_prompts', 'top_five', 'app_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Anyone can read %1$s" on public.%1$I for select to anon, authenticated using (true)', t);
  end loop;
end $$;
