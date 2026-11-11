# AI Playbook for Schools

A demo of the "AI Playbook" model for school staff (all grade levels; public, charter and private schools): tool comparisons, plays (copy-ready prompts), system prompts, a plain-English glossary and a Top 5 per role. Audience: teachers, special education, counselors, admins, front office, coaches. Many use school-issued Chromebooks and older iPads.

@web/AGENTS.md

## Repo map
| Path | What it is | Edit? |
| --- | --- | --- |
| `web/` | **The real app.** Next.js 16 (App Router, React 19, TypeScript) on Vercel; content in Supabase, with `web/src/data/content.json` as fallback. | Yes |
| `index.html` | The original single-file demo. `video/record.mjs` screen-records it. | Only for the video |
| `video/` | Demo video scripts and voice-over. See README. | Rarely |

## Commands (run from `web/`)
- `npm run dev`: dev server. It re-adds a block to `web/AGENTS.md`; that block is expected, leave it.
- `npm run build`: production build plus type check. Run it before saying a change works; CSS order can differ between dev and build.
- `npm run lint`: ESLint (next core-web-vitals + typescript).
- `node --env-file=.env.local scripts/check-security.mjs`: tests the database security rules against a local Supabase (see `web/README.md`). **Run the security checks when you change the database.**
- `node tests/e2e-live.mjs` (from the repo root): live-site end-to-end test, 26 happy-path and 14 edge-case checks as a visitor (read-only; never signs in). Add `SITE=http://localhost:3100` to test a local `next start`. Run it after merges that change what visitors see, and before recording demo videos.
- GitHub runs **Checks** on every pull request: lint, type check, build, dependency audit, and the security tests on a throwaway Supabase. Fix a red X before asking for approval.
- To verify UI, run `npm run build && npx next start` and check the page in light and dark mode at phone width (375px) and desktop.

## Git rules
- **Start every new task or change from the latest `main`:** `git checkout main && git pull`, then create a new branch named for the change (for example `add-counselor-plays`) and do all the work there.
- Propose code changes and get approval before making them. Show the diff and get an OK before committing.
- When the work is ready, commit to the branch, push it, and open a PR against `main`.
- **Never commit or push to `main`, and never merge anything.** Merging happens only through a PR approved by one of the other code owners (see `.github/CODEOWNERS`).
- If there are merge conflicts (on pull, or on the PR), stop and tell Cecily. Don't resolve or merge them yourself.

## How the app works
- `src/lib/content.ts`: `getContent()` is a `"use cache"` function (1 hour, tag `content`). It reads Supabase when `NEXT_PUBLIC_SUPABASE_*` are set; otherwise it reads the seed JSON. The secret service key is server-only; the browser may use the public key, protected by row-level security.
- **Members-only text:** prompt text isn't readable from the `plays` / `system_prompts` tables. It comes from `play_texts()` / `system_prompt_texts()`, which return previews (`locked`) to non-members. The cached content holds previews; `useMemberContent` swaps in full text for members and admins. Free samples are the `free_plays` / `free_system_prompts` settings.
- `src/app/layout.tsx` loads content once and passes it to `PlaybookProvider`, the client shell (header, tabs, drawer, search, tooltips, toast). Views read content and helpers through `usePlaybook()`.
- Each route in `src/app/*/page.tsx` renders one view from `src/components/views/`.
- **Tooltips:** any element with `data-tip="…"` and `tabIndex={0}` gets a hover/focus/tap tooltip. A delegated listener in the provider handles this, so don't add per-element tooltip state.
- **Glossary terms:** `<button className="term" data-term="id">` opens the term pop-up. In content text, write `[[term-id|label]]` and render it with `rich()` from `src/lib/text.tsx`; use `plain()` for search.
- **Cross-view links:** `goTo(kind, id)` navigates, and the target view calls `useFocusFlash` to scroll to and highlight the item.
- **Per-viewer prefs** (role, layout): `usePref()` in `src/lib/prefs.ts` (localStorage, hydration-safe). Shared or durable data belongs in Supabase, not localStorage.
- Types live in `src/lib/types.ts`. The DB uses snake_case; `content.ts` maps it to camelCase. Schema changes need a new file in `supabase/migrations/` plus updates to `types.ts`, `content.ts`, `content.json` and `scripts/seed-supabase.mjs`. Run the security checks when you change the database, and add checks for any new rules.

## Styling rules
Full reference (loaded below): `web/STYLEGUIDE.md`. Update it whenever you add or change a token.

@web/STYLEGUIDE.md

- **One CSS Module per component:** `Foo.tsx` imports `./Foo.module.css`. `src/app/globals.css` (with `src/styles/`) holds only tokens, the reset and base styles, and shared primitives: `.btn`, `.chip`, `.seg`, `.label`, `.muted`, `.sr`, `.term`, badges, `.empty`, `.flash`.
- **Use tokens; never hard-code a color, font, font size, radius, border width, shadow, duration or z-index that has a token.** If a value repeats and has no token, add one to `src/styles/tokens.css` and to the style guide.
- Inline `style` only for per-item CSS variables, e.g. `style={{ "--c": catOf(t).color }}`. Everything else goes in the module.
- Category colors are stored in the database as `var(--pop)`, `var(--blue)`, `var(--red)`, `var(--gold)`, `var(--plum)`. Don't rename those tokens without a migration.
- Dark mode: every color token is set twice, under `@media (prefers-color-scheme: dark)` and under `:root[data-theme="dark"]`. Keep both in sync. Don't switch to `light-dark()`: older school iPads don't support it.
- Keep the look: pinks, purples, lavender; Big Shoulders headings, Atkinson Hyperlegible body; thick ink borders with offset "sticker" shadows; no handwritten fonts; cards stay uncluttered, with reasons in tooltips.

## Performance budget
Measure with Lighthouse (mobile) on `next start`, never on `next dev`.
- Performance ≥ 95, Accessibility ≥ 95 on every route. LCP < 2.5 s, CLS < 0.1, TBT < 200 ms (INP < 200 ms in the field).
- Keep pages static (all routes prerender today). Don't read cookies, headers or search params in the layout without a Suspense boundary.
- Every font weight or style is a separate download on the critical path. Load only the weights in the style guide.
- New client-side dependencies need a reason. Check the bundle (`.next/static/chunks`) before and after adding one.
- The whole content object is serialized to the client (each page's HTML is about 41 KB gzipped, November 2026). Don't add large fields to it; if content grows a lot, split it per route.
- Memoize every provider's context value (`usePlaybook()`, `useAccount()`, `useCommunity()`): each one re-renders every component that reads it.
- Supabase in the browser loads lazily. Never import values from `@supabase/ssr` or `@supabase/supabase-js` in client code (type-only imports are fine). In components use `useBrowserSupabase()` (null until loaded); in effects and click handlers use `await loadBrowserSupabase()`; to ask "is sign-in set up?" use `supabaseConfigured()`. All are in `src/lib/supabase/browser.ts`.
- Effects that fetch data for the signed-in person depend on `user?.id`, never the `user` object. Supabase hands out a new object on every token refresh.
- Measure the DOM (`getBoundingClientRect`, `scrollIntoView`) in an effect keyed on what changed, never in a ref callback or on every mouse event.
- If the heading font or its weights change, re-measure "Big Shoulders Fallback" in `src/styles/base.css` so headings keep the same width while the font loads.
- Don't turn on `experimental.inlineCss`. Tested November 2026: no LCP gain, and it doubles the HTML.
- After a change, check first-load JS for `/` (gzipped `<script src>` chunks in `.next/server/app/index.html`, excluding the `noModule` polyfills; about 157 KB in November 2026, with Supabase loading separately), and run Lighthouse on `/`, `/plays`, `/lingo`, `/top-5`, `/system-prompts` and `/what-we-check`.

## Accessibility
- WCAG 2.2 AA: text contrast ≥ 4.5:1 (≥ 3:1 for text 24px and up, or 19px and up when bold). Check both themes.
- Everything works by keyboard. Interactive elements are `<button>` or `<a>`, never a clickable `<div>`. Keep `:focus-visible` outlines.
- Each view has a heading outline (h2 before h3; use `.sr` for a visually hidden heading).
- Animations are disabled under `prefers-reduced-motion`.

## Content house rules
- No real student names, IDs or other student information anywhere in the repo.
- Every tool fact (price, privacy, connections) needs an official vendor source. If it can't be confirmed, mark it "Under review".
- **One date, every tool:** the site shows one "Tools last checked" date (`checkedOn`, under the Demo bubble). Change it after rechecking **every** tool on official vendor pages, including tools added since the last recheck, even if some facts still can't be confirmed (those keep their "Check" flag and "Under review" wording). Unconfirmed facts show automatically under **Under review** (built from the "Check" flags by `underReview()` in `src/lib/review.ts`); a confirmed "no" is recorded as a real value (e.g. `dpa: "none"`, or an item in the tool's `notOffered` list, shown as "Confirmed: not offered"), not as review. Rewrite `notOffered` at each recheck. The plain-language explanation for staff lives on `/what-we-check`; keep it in step with this rule.
- **Scouting at each recheck:** look for new tools in teacher communities (Reddit: r/Teachers, r/edtech, r/education, r/specialed, r/SchoolCounseling; X, formerly Twitter, which shows little without signing in), Common Sense Education reviews, the SDPC agreement registry, the Clever and ClassLink app libraries, and the yearly EdTech Top 40 report. These are for finding tools only, never for facts. List every candidate found for Elizabeth (evidence and concerns for each), then recommend 3; nothing is added without her OK. Skip companies owned or based in China, Russia or the Middle East, and flag other non-U.S. companies.
- Plain English, short sentences. Keep the sports framing (Roster, Plays, Scouting report, Coach's tip).
