# AI Playbook for Schools: web app

The React (Next.js) version of the playbook, hosted on Vercel, with content in a Supabase database. Built in four phases:

1. **Phase 1:** the playbook rebuilt in React, content moved into a database.
2. **Phase 2:** accounts and sign-in (admins and end users), role onboarding steps, personalized roster.
3. **Phase 3:** star ratings, written or voice feedback for every tool, admin approval, membership days for approved feedback, rankings.
4. Phase 4: memberships (Stripe) and earning membership time with feedback.

New to the code? Read [`DEVELOPING.md`](DEVELOPING.md) for how it fits together, how to make common changes, and the security checklist.

## How it's built

| Path | What it is |
| --- | --- |
| `src/app/` | Pages: `/` (The Roster), `/top-5`, `/plays`, `/system-prompts`, `/lingo`, `/sign-in`, `/welcome` (setup steps), `/admin`; `auth/callback` finishes sign-in |
| `src/components/` | The playbook shell (header, tabs, scouting report, search, pop-ups) and one view per page |
| `src/lib/content.ts` | Loads all content. Uses Supabase when its keys are set; otherwise uses `src/data/content.json` |
| `src/data/content.json` | The content (tools, plays, system prompts, glossary, Top 5), exported from the original demo |
| `supabase/migrations/` | The database tables, in order |
| `supabase/seed.sql` | The content as one SQL file to paste into the Supabase SQL Editor (generated; don't edit by hand) |
| `scripts/build-seed-sql.mjs` | Regenerates `supabase/seed.sql` from `content.json` |
| `scripts/seed-supabase.mjs` | Loads `content.json` into the database through the API (needs the secret key) |
| `scripts/content-rows.mjs` | The table-by-table mapping both seed scripts share |
| `src/lib/supabase/env.ts` | Reads the Supabase settings, accepting both key naming styles |
| `src/components/AccountProvider.tsx` | Who's signed in, their profile, admin status and playbook answers (guests' answers are kept on the device, then copied into their account) |
| `src/components/CommunityProvider.tsx`, `Feedback.tsx` | Rating numbers and ranking scores, the reader's own ratings, and the written/voice feedback form |
| `src/components/AdminFeedback.tsx` | Admin feedback approvals and reward settings |
| `src/app/api/cron/purge-voice/` + `vercel.json` | Daily job that deletes voice recordings older than 30 days (the written text stays) |
| `scripts/check-security.mjs` | Tests the database security rules with a throwaway account (local Supabase only) |

Content is cached for an hour, so the site stays fast as traffic grows.

## Run it on your computer

Needs Node.js 20 or newer. From this `web` folder:

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000. Without Supabase keys it uses the content file, so this works right away.

## One-time setup (Stone Arch Collective owns these accounts)

### 1. Supabase (database)
1. At https://supabase.com, create a project in the Stone Arch Collective organization. Save the database password in your password manager.
2. In the project, open **SQL Editor** and run each file in `supabase/migrations/` in order: paste `0001_content.sql`, click **Run**, then do the same with `0002_accounts.sql`, `0003_feedback.sql` (which also creates the private `voice-feedback` storage bucket) and `0004_limits.sql`.
3. **Load the content:** in the SQL Editor, paste the whole of `supabase/seed.sql` and click **Run**. It adds the tools, plays, system prompts, glossary and Top 5 lists. It's safe to run again later to refresh the content, and it doesn't change admin settings. (Developers can instead run `node --env-file=.env.local scripts/seed-supabase.mjs`, which loads the same rows through the API.)
4. Open **Project Settings → API keys**. You'll need the **Project URL**, the **public** key (called "publishable" or "anon") and the **secret** key (called "secret" or "service_role"). Treat the secret key like a password: never paste it in chat, email or the code.

### 2. Sign-in settings (Supabase → Authentication)
1. **URL Configuration:** set **Site URL** to the live Vercel address (for example `https://ai-playbook-for-schools.vercel.app`). Under **Redirect URLs**, add:
    - `https://<your-vercel-address>/auth/callback`
    - `https://*-stonearchcollective.vercel.app/auth/callback` (Vercel preview links for pull requests; match your Vercel team's name)
    - `http://localhost:3000/auth/callback` (for running it on your computer)
2. **Email link:** on by default (Providers → Email). For real users, set up a custom email sender under **SMTP Settings**; Supabase's built-in sender is limited to a few emails an hour.
3. **Google:** create an OAuth client in Google Cloud Console (APIs & Services → Credentials → OAuth client ID → Web application). Add the **Callback URL** Supabase shows on its Google provider page as an authorized redirect URI, then paste the client ID and secret into Supabase (Providers → Google) and turn it on.
4. **Microsoft:** in the Azure portal, open Microsoft Entra ID → App registrations → New registration. Choose "Accounts in any organizational directory and personal Microsoft accounts", add Supabase's **Callback URL** as a Web redirect URI, create a client secret, then paste the Application (client) ID and secret into Supabase (Providers → Azure) and turn it on.
5. **First admin:** sign in once on the live site, then in **SQL Editor** run (with that person's email):

    ```sql
    insert into public.admins (user_id) select id from auth.users where email = 'first.admin@example.org';
    ```

    After that, admins add or remove other admins from **Coach's office** (`/admin`).

### 3. Vercel (hosting)
1. At https://vercel.com, in the Stone Arch Collective team, click **Add New → Project** and import `StoneArchCollective/ai-playbook-for-schools` from GitHub.
2. **Framework Preset:** Next.js. **Root Directory:** `web`.
3. Under **Environment Variables**, add:
    - `NEXT_PUBLIC_SUPABASE_URL`: the Project URL
    - the public key as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the older name `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the app accepts either)
    - the secret key as `SUPABASE_SECRET_KEY` (or the older name `SUPABASE_SERVICE_ROLE_KEY`). It's used only on the server, by the daily job that deletes old voice recordings; never put it in a variable starting with `NEXT_PUBLIC_`
    - `CRON_SECRET`: any long random text (a password generator works). Vercel sends it with the daily job so nobody else can trigger it.
4. Click **Deploy**. Every pull request then gets its own preview link, and merging to `main` updates the live site. The daily cleanup job in `vercel.json` (8:00 UTC) runs automatically on the live site.

If you deploy before Supabase is set up, the site still works from the content file; sign-in stays hidden until the keys are added.

## Ratings, feedback and rankings
- Anyone signed in (free accounts included) can rate a tool 1 to 5 stars and send written or spoken feedback from its scouting report.
- **Speaking** records audio and, in Chrome, Edge and Safari, types what's said so the person can check it. Other browsers ask for a short written version. Recordings live in a private bucket and are deleted after 30 days.
- Feedback is private until an admin approves it in **Coach's office → Feedback**. Approval adds membership days for the author (admin setting, 30 by default, with an optional monthly limit) and shows the feedback on the tool without a name.
- **Rankings** ("Sort: Top rated by educators") use a fair average: each tool starts with 5 imaginary ratings at its editorial score (or the site-wide average), so one 5-star rating can't jump ahead of hundreds of strong ones.
- People can say whether their name may be shared with the tool's maker; it's stored with each piece of feedback.

## Testing with a local Supabase (optional)
With Docker Desktop running and the [Supabase CLI](https://supabase.com/docs/guides/cli) installed, from this folder:

```bash
supabase start -x studio,edge-runtime,logflare,vector,imgproxy,realtime,supavisor,postgres-meta
```

It applies the migrations and prints a local API URL and keys; put those in `.env.local` and run the seed script. Sign-in emails go to a pretend inbox at http://127.0.0.1:54324. Check the security rules with:

```bash
node --env-file=.env.local scripts/check-security.mjs
```
