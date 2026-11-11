# Developing AI Playbook for Schools

How the app fits together and how to change it safely. Setup steps are in `README.md`.

## How it works

```
Browser (React)                     Next.js on Vercel                    Supabase
───────────────                     ─────────────────                    ────────
Pages + components  ── render ───── layout.tsx loads content ─── read ── content tables
AccountProvider     ── sign-in / profile / admin ─────────────────────── auth + profiles
CommunityProvider   ── ratings, tool_stats() ─────────────────────────── ratings, feedback
Feedback form       ── upload recording ──────────────────────────────── voice-feedback bucket
                                     /auth/callback (finishes sign-in)
                                     /api/cron/purge-voice (daily, server key)
```

- **Content** (tools, plays, prompts, terms, Top 5) is loaded once on the server by `src/lib/content.ts`, cached for an hour, and handed to the page. Without Supabase keys it falls back to `src/data/content.json`.
- **Everything about people** (sign-in, profiles, ratings, feedback) runs in the browser with the public "anon" key. That's safe because **the database decides who can see and change what** (row-level security). Never rely on hiding a button for security.
- The **service role key** bypasses those rules. It's used only by `scripts/` and server routes (`/api/...`), never in a component or anything starting with `NEXT_PUBLIC_`.

## Where things live

| Folder | What's there |
| --- | --- |
| `src/app/` | One folder per page (`page.tsx` is small and just renders a view). Route handlers live in `auth/` and `api/`. |
| `src/components/views/` | One file per page's main content (`RosterView`, `PlaysView`, `AdminView`...). Start here to change a page. |
| `src/components/` | Shared pieces: the shell (`PlaybookProvider`), account and community providers, the scouting report drawer, search, card tags (`ToolBits`), feedback. |
| `src/lib/` | Plain helpers: content loading, types, text helpers, saved preferences, the browser Supabase client. |
| `supabase/migrations/` | Database changes, numbered and applied in order. |
| `scripts/` | Seed the database, test the security rules. |

## Common changes

**Edit tools, plays, prompts or terms.** Change `src/data/content.json` (the shapes are in `src/lib/types.ts`), then regenerate `supabase/seed.sql` (`node scripts/build-seed-sql.mjs`) and commit both files. Load the change into a database by pasting `seed.sql` into the Supabase SQL Editor, or with `node --env-file=.env.local scripts/seed-supabase.mjs`. Every tool fact needs an official vendor source; mark anything unconfirmed `"free": "review"` or with a `review` note.

**Add a page.** Make `src/app/<name>/page.tsx` that renders a new view in `src/components/views/`. Add a tab in `PlaybookProvider.tsx` if it belongs in the main navigation.

**Change the database.** Never edit a migration that has already been merged. Add the next numbered file (for example `0005_something.sql`). In it:
1. Turn on row-level security for every new table (`alter table ... enable row level security`) and write a policy for each thing people should be able to do. No policy means no access.
2. Limit which columns people can write (`revoke`/`grant update (col, ...)`), so they can't set fields like `status` or `is_admin` themselves.
3. Add size checks (`check (char_length(...) <= ...)`) and, for anything people can submit, a rate limit (`perform public.check_rate_limit('bucket', max, interval)` in a trigger).
4. Add tests for the new rules to `scripts/check-security.mjs`, both "can do" and "can't do".

**Admin-editable settings** live in the `app_settings` table (key → JSON value). Admins can change them; everyone can read them. Read them where they're used rather than hard-coding numbers.

## Security checklist for every pull request
- [ ] No secrets in code, commits or screenshots. Keys go in `.env.local` (never committed) or Vercel's settings.
- [ ] New tables have row-level security and policies, and new rules are covered in `check-security.mjs`.
- [ ] The browser is never trusted for prices, roles, status or who someone is. The database or a server route decides.
- [ ] People's text is shown as text (React does this by default; never use `dangerouslySetInnerHTML` with user content).
- [ ] No student information is collected, stored or logged.
- [ ] Payment code (Phase 4) only trusts Stripe after verifying the webhook signature.

## Code style
- Small files with one job, named for what they do. Comments explain *why*, not *what*.
- Prefer plain functions and React state over new libraries. Add a dependency only when it does real work, and pin its version.
- Styles: one `Component.module.css` next to each component; shared tokens and primitives in `src/styles/` (see `STYLEGUIDE.md`). Keep the look: pinks, purples and lavender; Big Shoulders headings and Atkinson Hyperlegible text; no handwritten fonts; details in hover/tap tips so cards stay clean.
- Write user-facing text in plain, friendly words. Error messages say what went wrong and what to do next.

## Before you open a pull request
From the `web` folder: `npm run lint`, `npm run typecheck` and `npm run build` should all pass. If you changed the database, run the security checks against a local Supabase (see `README.md`). The **Checks** on GitHub run all of this automatically, so a red X means something to fix before asking for approval.
