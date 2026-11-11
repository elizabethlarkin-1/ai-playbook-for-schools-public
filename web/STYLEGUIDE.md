# AI Playbook for Schools: style guide

The look is a varsity playbook on a lavender whiteboard (light) or an aubergine chalkboard (dark): thick ink outlines, offset "sticker" shadows, condensed uppercase headings and highly legible body text.

Every value below is a CSS custom property in `src/styles/tokens.css`. Use the token, not the raw value.

## Color

Each color has a light and a dark value; both themes must pass WCAG AA contrast.

### Surfaces and text
| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#f7f3fc` | `#1d1528` | Page background (with the dotted grid) |
| `--surface` | `#ffffff` | `#271d35` | Cards, dialogs, inputs |
| `--surface-2` | `#efe7f8` | `#31253f` | Table headers, code blocks, hover rows, quiet pills |
| `--line` | `#dcd0ec` | `#43355a` | Quiet borders, dividers, the background grid dots |
| `--ink` | `#2a1d3d` | `#f3ecfb` | Body text, strong borders, sticker shadows |
| `--ink-soft` | `#66597a` | `#b9a9cc` | Secondary text, labels, captions |

### Brand
| Token | Light | Dark | Looks like | Use |
| --- | --- | --- | --- | --- |
| `--pop` | `#cc1e6c`\* | `#ff7ab3` | Hot pink | Main accent: "for Schools", play numbers, stamps, top picks, focus of attention |
| `--blue` | `#5b3cc4` | `#b49bff` | Violet | Links, focus ring, role tags, system prompts |
| `--red` | `#a3246f` | `#ff8fcf` | Magenta | "General AI assistant" category |
| `--green` | `#8a6fd8` | `#c9b6ff` | Lavender | Glossary icons in search, ease-of-use pips |
| `--gold` | `#a842a8`\* | `#f0a0ee` | Orchid | "Design & media" category |
| `--plum` | `#7a3c9c` | `#d9a8f0` | Plum | "Family communication" category |
| `--hi` | `#ffc8e3` | `#ff9fcd` | Highlighter pink | Primary button fill, active-tab underline, term hover, flash ring |
| `--hi-ink` | `#2a1d3d` | `#1d1528` | | Text on `--hi` |
| `--on-pop` | `#ffffff` | `#1d1528` | | Text on solid `--pop`, `--blue` or category fills (new token, replaces three dark-mode overrides) |

\* Changed from `#e0267a` and `#c04fc0` so white text on them passes 4.5:1 (the old values measured 4.44 and 4.10). `--pop` was darkened again (from `#d42070`, Nov 4, 2026) so pink bold text on `--pop-tint` boxes passes 4.5:1 (4.37 → 4.66).

The names `--blue`, `--red`, `--green` and `--gold` are historical; the colors are all purples and pinks. They stay because tool categories in the database reference them (`var(--blue)`). `--plum` (added Nov 6, 2026) is referenced the same way, so don't rename it without a migration.

### Status
| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--ok` | `#2a7353`\* | `#7fd6ac` | Confirmed: FERPA ✓, equity yes, free |
| `--warn` | `#9a5b00` | `#f2c26b` | Needs checking: FERPA ?, partly free |
| `--sdg` | `#c5192d` | `#ff8a95` | UN SDG 4 badges only |

\* Changed from `#2f7d5b` (4.43 → 5.04 on its tint).

### Tints
Tinted fills are made with `color-mix()`: the color mixed into `--surface`.
| Token | Mix | Use |
| --- | --- | --- |
| `--pop-tint` | `--pop` 8% | Guard, safety and review boxes; play links |
| `--pop-tint-strong` | `--pop` 15% | Top-pick persona tag, "Play" pill |
| `--blue-tint` | `--blue` 10% | Persona tags |
| `--blue-tint-strong` | `--blue` 15% | "System prompt" pill |
| `--ok-tint`, `--warn-tint`, `--sdg-tint` | 9% / 9% / 8% | Privacy and SDG badges |
| `--hi-tint` | `--hi` 30% | "Your playbook" bar |
| `--hi-tint-soft` | `--hi` 14% | Ratings & feedback box in the scouting report |

### Other
| Token | Use |
| --- | --- |
| `--backdrop` | Dialog backdrop, `rgba(20,10,30,.5)` |
| `--focus-ring` | `3px solid var(--blue)`, 2px offset |

## Typography

| Token | Value | Use |
| --- | --- | --- |
| `--font-display` | Big Shoulders (700, 800, 900), then "Big Shoulders Fallback" (Arial scaled to the same width, in `base.css`), then Arial Narrow | Headings, tabs, labels, stamps, numbers. Usually uppercase. |
| `--font-body` | Atkinson Hyperlegible (400, 700), then Segoe UI | Everything else. Chosen for low-vision readers. |
| `--font-mono` | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` | Prompts in `<pre>`, `<kbd>` |

No italics are loaded; don't use `<em>` for emphasis, use `<b>`.

### Body sizes
| Token | Size | Use |
| --- | --- | --- |
| `--text-2xs` | 12px | Badges, pills, counts, captions |
| `--text-xs` | 13px | Small buttons and chips, table meta |
| `--text-sm` | 14px | Buttons, chips, secondary copy, tooltips |
| `--text-md` | 15px | Card descriptions, table text, play text |
| `--text-base` | 16px | Body (line-height 1.55) |
| `--text-lg` | 18px | Search dialog input |

### Display sizes (Big Shoulders)
| Token | Size | Use |
| --- | --- | --- |
| `--display-xs` | 17px | Box titles (Under review, Student data stays home), header tagline |
| `--display-sm` | 19px | Tabs, role-card names |
| `--display-md` | 24px | Section headings (Who's on the field?), Top 5 item titles |
| `--display-lg` | 25px | Card and play titles |
| `--display-xl` | 28px | Hero headings, glossary abbreviations |
| `--display-2xl` | 34px | Scouting-report tool name |
| `--display-hero` | `clamp(30px, 5vw, 52px)` | Site title |
| `--display-rank` | 48px | Top 5 rank numbers |

Sizes within 1–2px of each other are snapped to the nearest step (24/25/26 and 28/30).

### Weights and tracking
- Weights: `--weight-regular` 400, `--weight-bold` 700, `--weight-heavy` 800, `--weight-black` 900. Display text is 800 or 900.
- Tracking for uppercase display text: `--tracking-tight` .02em (tabs, large headings), `--tracking` .04em (stamps, box titles), `--tracking-wide` .08em (pills, flags), `--tracking-widest` .1em (`.label`, search group names).

## Shape

| Token | Value | Use |
| --- | --- | --- |
| `--radius-xs` | 4px | Focus ring, tab underline |
| `--radius-sm` | 6px | Badges, A–Z letters, use tags |
| `--radius-md` | 8px | Code blocks, details, guard box, tab tops |
| `--radius-lg` | 10px | Cards, notices, tables |
| `--radius-xl` | 14px | Dialogs and pop-ups |
| `--radius-pill` | 99px | Buttons, chips, inputs, pills |
| `--border` | 2px | Card, button and dialog outlines (usually `--ink`) |
| `--border-thin` | 1.5px | Badges, pills, dashed dividers |

### Shadows
- **Sticker shadows** are hard offset shadows in an accent color: `box-shadow: var(--lift) var(--pop)`.
  - `--lift-sm` 3px 3px 0: button hover
  - `--lift` 4px 4px 0: cards, plays, Top 5 items
  - `--lift-lg` 6px 6px 0: dialogs, term pop-up
  - `--lift-xl` 7px 7px 0: card hover
- `--shadow` is the soft shadow for floating layers (tooltip, toast).

## Components (shared primitives)

`src/app/globals.css` only imports three files: `src/styles/tokens.css` (tokens), `src/styles/base.css` (reset and base elements) and `src/styles/primitives.css` (the classes below). Anything used by only one component goes in that component's `.module.css`; play and system-prompt cards share `src/components/PlayCard.module.css`.

| Class | What it is | Variants |
| --- | --- | --- |
| `.btn` | Pill button: 2px ink border, lifts on hover | `.primary` (pink fill), `.ghost` (quiet border), `.small` |
| `.chip` | Filter toggle; uses `aria-pressed` | `.small`, `.incl` |
| `.seg` | Segmented control (Cards/Table) | |
| `.x` | Round close button, 38px (34px in the pop-up) | |
| `.info` | Small round "i" help button (24px) that shows a `data-tip` bubble | |
| `.label` | Uppercase display eyebrow, `--ink-soft` | |
| `.pv`, `.sdg`, `.flag`, `.eq` | Badges: privacy, SDG target, "Check" flag, equity score | `.pv.ok`, `.pv.warn`, `.eq.full` |
| `.term` | Dotted-underline glossary button | |
| `.empty` | Dashed "no results" box | |
| `.flash` | Brief pink ring on a linked-to item | |
| `.sr` | Visually hidden, for screen readers | |
| `.muted`, `.fine`, `.num` | Secondary text, small print, tabular numbers | |
| `.chips` | A wrapping row of chips | `.chips.sub` (indented sub-filter row) |
| `.controls`, `.search`, `.sel` | Filter bar, search box with icon, pill select | |
| `.goals`, `.goal` | Role cards (Roster and setup steps) | `aria-pressed` |
| `.mono`, `.cat` | Tool monogram and category pill (use `--c`) | |
| `.persona`, `.toppick`, `.yours` | Role tag, Top pick badge, "Works with yours" | `.persona.top` |
| `.aud`, `.subj`, `.status`, `.pill`, `.count`, `.pips` | Role and subject pills, review status, small pill, tab/tab-count bubble, ease pips | `.status.pending/.approved/.declined`, `.pill.strong`, `.count.hot` |
| `.guard`, `.safety`, `.review-box` | Pink callouts: student-info reminder, safety box, "Under review" | |
| `.panel` | Centered card for sign-in, setup and admin messages | |
| `.field`, `.hint`, `.form-err`, `.row-actions` | Form field (label + input), help text, error text, a row of buttons | |
| `.table-wrap` | Bordered, scrollable table container with header styles | |

Control sizes: `--btn-pad` 7px 14px, `--btn-pad-sm` 4px 10px, `--chip-pad` 4px 12px, `--chip-pad-sm` 2px 10px, `--field-pad` 10px 14px, `--icon-btn` 38px.

Everything else (cards, drawer, search dialog, plays, glossary cards) is styled in its component's `.module.css`.

## Layout
- Page width `--page-max` 1180px, side gutter `--gutter` 16px (plus safe-area insets).
- Card grids: `repeat(auto-fill, minmax(300px, 1fr))`, gap 18px. Plays use 340px.
- Reading width: 68–72ch for intro paragraphs.
- Breakpoints (CSS variables can't be used in media queries, so use these numbers): **420px** (small phone), **520px** (two-column lists collapse), **600px** (pop-ups dock to the bottom), **700px** (header stops sticking, search goes full width), **760px** (system-prompt hero stacks).

## Motion
- `--dur-fast` .12s (buttons, chips), `--dur` .15s (cards), `--dur-slow` .25s (card entrance).
- Hover lift is translate plus a bigger sticker shadow. Cards also tilt -0.3deg.
- `prefers-reduced-motion: reduce` turns off all transitions and animations.

## Layers
`--z-header` 5 · `--z-backbar` 8 · `--z-safe-area` 10 · `--z-tooltip` 50 · `--z-popover` 55 · `--z-toast` 60

## Writing
- Plain English, short sentences, second person ("Pick your role").
- Sports framing: The Roster, The Plays, Scouting report, Coach's tip, Game plan.
- Reasons and fine print go in tooltips (`data-tip`), not on the card.
- Unconfirmed facts get the "Check" flag and the "Under review" wording.
