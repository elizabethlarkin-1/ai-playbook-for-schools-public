# AI Playbook for Schools

A fact-checked, role-first guide that helps school staff choose AI tools that are safe and fair for every student. Built for the **WAI Canada 2026 Hackathon** by **Team 1: Stone Arch Collective Wonder Women**.

**Theme:** Responsible AI, Privacy & Digital Trust, with UN Sustainable Development Goal 4: Quality Education.

| | |
| --- | --- |
| **Live site** | https://ai-playbook-for-schools-nfw1.vercel.app |
| **Demo video** | https://elizabethlarkin-1.github.io/ai-playbook-for-schools-public/#video |

This repository is a public snapshot of the code as of Nov 10, 2026. Development continues in a private team repository.

## What it does
- **Pick your role** (teacher, special education, counselor, administrator, front office, coach) and the tools that fit that work come first, with the reason on each tag.
- **Facts behind every badge:** FERPA, COPPA and data agreements in the company's own words, one topic per bubble, from official vendor pages only.
- **Where your data goes:** where each company is based, where it stores data and where data may be processed. "Not stated by the company" when it doesn't say.
- **Honest about gaps:** anything unconfirmed is listed under "Under review"; what a tool doesn't offer is listed as "Confirmed: not offered".
- **Equity check** on every tool: free school-wide, any device, languages, accessibility.
- **Copy-ready plays** (prompts) tagged to SDG 4 targets, with reminders to remove student names and IDs first.
- **Ratings by role** with anti-gaming rules: one rating per person, a fair average, at least 10 ratings from a role before it counts, no paid placement. A person reviews every written or voice review before it's shown.

## Responsible AI by design
| Pillar | How it shows up |
| --- | --- |
| Privacy-preserving | No student data stored; "remove names and IDs" in every play; "Where your data goes" for every tool; row-level security on every table |
| Bias & fairness | Equity check; fair-average ratings by role; no paid placement |
| Explainable | Every tag and badge explains why, from the company's own pages; published ranking rules |
| Trust | Official sources only; one site-wide recheck date; "Under review" instead of guessing |
| Safety & governance | People approve every fact and every review; DPA and district AI policy checks; security tests and code review on every change |

## How it's built
- **Next.js 16** (App Router, React 19, TypeScript) on **Vercel**; **Supabase** (Postgres, Auth, Storage) with row-level security.
- Content lives in `web/src/data/content.json` and the database; `web/supabase/` holds migrations and the seed.
- Tests: `web/scripts/check-security.mjs` (database security rules) and `tests/e2e-live.mjs` (40 live-site checks as a visitor).
- Built with **Claude** (Anthropic) as an AI pair programmer, with people reviewing every change.

See `web/README.md` to run it locally.

## Repository map
| Path | What it is |
| --- | --- |
| `web/` | The app |
| `tests/` | Live-site end-to-end test |
| `video/pitch/` | Scripts that record and assemble the demo video from the live site |
| `docs/` | The project page (GitHub Pages): demo video |
| `index.html` | The original one-file prototype (Oct 2026) |

## Credits
Elizabeth M. Larkin, AI-Native Developer · Cecily Hibbs, Developer · Shannon Seaver, guidance and oversight · Stone Arch Collective.
Music in the demo video: "Life of Riley" by Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0.

Demo with sample content. Tool facts were checked on official vendor sites; always confirm with the company and your district before using a tool with student information.
