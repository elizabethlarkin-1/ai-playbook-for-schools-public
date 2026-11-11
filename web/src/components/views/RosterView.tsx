"use client";

import { useMemo, useState } from "react";
import type { Tool } from "@/lib/types";
import Link from "next/link";
import { usePref } from "@/lib/prefs";
import { initials, plain, rich } from "@/lib/text";
import { useAccount } from "../AccountProvider";
import { useCommunity } from "../CommunityProvider";
import { StarsSummary } from "../Feedback";
import { usePlaybook } from "../PlaybookProvider";
import { ConnectChips, Ease, FreeStatus, PersonaTags, PrivacyTags, RoleRatedBadge, TagRow, TopPickBadge, connAll, systemsMatch } from "../ToolBits";
import { useRoleStats } from "../useRoleStats";
import { roleBadges } from "@/lib/ranking";
import styles from "./RosterView.module.css";

const LAYOUT_KEY = "aipbs:layout";
// Connection names a workspace choice stands for, so those chips light up as "yours" too.
const ALSO_MINE: Record<string, string> = { "Google Workspace": "Google Classroom", "Microsoft 365": "Microsoft Teams" };

/** "Your playbook: Teacher · Science · Schoology" with an edit link, or an invitation to set it up. */
function YourPlaybookBar() {
  const { prefs } = useAccount();
  const { roleById, content } = usePlaybook();
  if (!prefs) {
    return (
      <div className={styles.yourBar}>
        <span className="label">Make it yours</span>
        <span className={styles.yourBarText}>Answer 3 quick questions and the roster puts the tools that fit your role and your school&apos;s systems first.</span>
        <Link href="/welcome" className="btn small primary">Personalize</Link>
      </div>
    );
  }
  const subjects = Object.fromEntries(content.subjects.map((s) => [s.id, s.label]));
  return (
    <div className={styles.yourBar}>
      <span className="label">Your playbook</span>
      <span className={styles.yourBarText}><b>{roleById[prefs.role]?.label}</b>{prefs.subjects.length > 0 && ` · ${prefs.subjects.map((s) => subjects[s]).join(", ")}`}{prefs.systems.length > 0 && ` · ${prefs.systems.join(", ")}`}</span>
      <Link href="/welcome" className="btn small ghost">Edit</Link>
    </div>
  );
}

/** Help bubble for the "Filter this list" box. Keep it in step with the filter in `list` below. */
const FILTER_HELP = "Type a word to narrow the list. It looks in tool names, companies, descriptions, categories, \u201cGood for\u201d tags and school systems. It matches your words exactly, in order: \u201clesson plan\u201d finds \u201cLesson planning,\u201d but \u201cplan lessons\u201d doesn\u2019t. Example: type Canvas to see tools that connect with Canvas. To search plays, prompts and terms too, use Search at the top.";

export default function RosterView() {
  const { content, role, setRole, roleById, catOf, openTool } = usePlaybook();
  const { prefs } = useAccount();
  const { stats, available: ratingsOn } = useCommunity();
  const roleStats = useRoleStats();
  const [sort, setSort] = usePref<"fit" | "rated" | "name">("aipbs:sort", "fit");
  const mySystems = useMemo(() => prefs?.systems ?? [], [prefs?.systems]);
  const mineNames = [...mySystems, ...mySystems.map((s) => ALSO_MINE[s]).filter(Boolean)];
  const [onlyMine, setOnlyMine] = useState(false);
  const [subjPick, setSubj] = useState<string | null>(null);
  // A teacher with one subject starts filtered to it; picking a chip overrides.
  const subj = subjPick ?? (role === "teacher" && prefs?.role === "teacher" && prefs.subjects.length === 1 ? prefs.subjects[0] : "");
  const [q, setQ] = useState("");
  const [free, setFree] = useState(false);
  const [dpa, setDpa] = useState(false);
  const [school, setSchool] = useState(false);
  const [works, setWorks] = useState("");
  const [cat, setCat] = useState("");
  const [layout, setLayout] = usePref<"cards" | "table">(LAYOUT_KEY, "cards");

  const systems = useMemo(() => [...new Set(content.tools.flatMap(connAll))].sort(), [content.tools]);
  const subjectLabel = Object.fromEntries(content.subjects.map((s) => [s.id, s.label]));
  const isTop = (t: Tool, r: string) => t.personas.some((p) => p.id === r && p.top);
  // Role-based ranking: tools rated highly by this role rise after the hand-chosen top picks.
  const badges = useMemo(() => roleBadges(roleStats, role, content.exampleRoleBadges), [roleStats, role, content.exampleRoleBadges]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return content.tools.filter((t) => {
      if (role && !t.personas.some((p) => p.id === role)) return false;
      if (role === "teacher" && subj && !(t.subjects.includes("all") || t.subjects.includes(subj))) return false;
      if (free && !(t.free === "yes" || t.free === "limited")) return false;
      if (dpa && (t.privacy.dpa === "review" || t.privacy.dpa === "none")) return false;
      if (school && t.equity?.free.s !== "ok") return false;
      if (works && !connAll(t).includes(works)) return false;
      if (cat && t.cat !== cat) return false;
      if (onlyMine && !systemsMatch(t, mySystems).length) return false;
      if (s && ![t.name, t.company, plain(t.desc), catOf(t).label, ...t.uses, ...connAll(t)].join(" ").toLowerCase().includes(s)) return false;
      return true;
    }).sort((a, b) => {
      const fit = (t: Tool) => Number(systemsMatch(t, mySystems).length > 0);
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "rated") return ((stats[b.id]?.score ?? 0) - (stats[a.id]?.score ?? 0)) || ((stats[b.id]?.count ?? 0) - (stats[a.id]?.count ?? 0)) || a.name.localeCompare(b.name);
      return role
        ? (Number(isTop(b, role)) - Number(isTop(a, role))) || ((badges[b.id]?.score ?? 0) - (badges[a.id]?.score ?? 0)) || (fit(b) - fit(a)) || (a.ease - b.ease) || a.name.localeCompare(b.name)
        : (fit(b) - fit(a)) || a.name.localeCompare(b.name);
    });
  }, [content.tools, role, subj, free, dpa, school, works, cat, q, catOf, onlyMine, mySystems, sort, stats, badges]);

  // Every filter that's on, in the order the controls appear, for the line above the results.
  const catLabel = content.categories.find((c) => c.id === cat)?.label;
  const filtersOn = [
    q.trim() && `Search: “${q.trim()}”`,
    free && "Free for teachers",
    dpa && "Signs district DPAs",
    school && "Free for whole school",
    onlyMine && "Works with my systems",
    works && `Works with ${works}`,
    catLabel && `Category: ${catLabel}`,
  ].filter(Boolean) as string[];
  // The button disappears once nothing is on, so keyboard focus moves to the filter box rather than being lost.
  const clearFilters = () => { setQ(""); setFree(false); setDpa(false); setSchool(false); setOnlyMine(false); setWorks(""); setCat(""); document.getElementById("q")?.focus(); };

  return (
    <section aria-label="The Roster">
      <YourPlaybookBar />
      <div>
        <h2 className={styles.heading}>Who&apos;s on the field?<small>Pick your role to see your best-fit tools, easiest first. Hover or tap a tag to see why it fits.</small></h2>
        <div className="goals">
          {content.roles.map((r) => (
            <button key={r.id} type="button" className="goal" aria-pressed={role === r.id} onClick={() => { setRole(role === r.id ? "" : r.id); setSubj(null); }}>
              <b>{r.label}</b><span>{r.hint}</span>
            </button>
          ))}
        </div>
        {role === "teacher" && (
          <div className="chips sub">
            <span className="label">Subject</span>
            <button type="button" className="chip small" aria-pressed={!subj} onClick={() => setSubj("")}>All subjects</button>
            {content.subjects.map((s) => <button key={s.id} type="button" className="chip small" aria-pressed={subj === s.id} onClick={() => setSubj(s.id)}>{s.label}</button>)}
          </div>
        )}
      </div>

      <div className="controls">
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12l-4.5 5.5V13l-3 1.5V8.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
          <label className="sr" htmlFor="q">Filter the roster</label>
          <input id="q" type="search" placeholder="Filter this list…" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} className={styles.filterInput} />
          <button type="button" className={`info ${styles.filterHelp}`} aria-label="How Filter this list works" data-tip={FILTER_HELP}>i</button>
        </div>
        <button type="button" className="chip" aria-pressed={free} onClick={() => setFree(!free)}>Free for teachers</button>
        <button type="button" className="chip" aria-pressed={dpa} onClick={() => setDpa(!dpa)}>Signs district DPAs</button>
        <button type="button" className="chip" aria-pressed={school} onClick={() => setSchool(!school)}>Free for whole school</button>
        {mySystems.length > 0 && <button type="button" className="chip" aria-pressed={onlyMine} onClick={() => setOnlyMine(!onlyMine)}>Works with my systems</button>}
        <label className="sr" htmlFor="worksWith">Works with</label>
        <select id="worksWith" className="sel" value={works} onChange={(e) => setWorks(e.target.value)}>
          <option value="">Works with: any system</option>
          {systems.map((n) => <option key={n} value={n}>Works with: {n}</option>)}
        </select>
        <label className="sr" htmlFor="category">Category</label>
        <select id="category" className="sel" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Category: all</option>
          {content.categories.map((c) => <option key={c.id} value={c.id}>Category: {c.label}</option>)}
        </select>
        <label className="sr" htmlFor="sort">Sort by</label>
        <select id="sort" className="sel" value={sort} onChange={(e) => setSort(e.target.value as "fit" | "rated" | "name")}>
          <option value="fit">Sort: Best fit for you</option>
          {ratingsOn && <option value="rated">Sort: Top rated by educators</option>}
          <option value="name">Sort: Name A–Z</option>
        </select>
        <div className="seg" role="group" aria-label="Layout">
          <button type="button" aria-pressed={layout === "cards"} onClick={() => setLayout("cards")}>Cards</button>
          <button type="button" aria-pressed={layout === "table"} onClick={() => setLayout("table")}>Table</button>
        </div>
      </div>
      <div className={styles.resultLine} role="status">
        <p>
          Showing {list.length} of {content.tools.length} tools{role && ` for ${roleById[role].label}`}{role === "teacher" && subj && ` · ${subjectLabel[subj]}`}
          {sort === "name" ? ", A–Z" : sort === "rated" ? ", top rated first" : role ? `, top pick first, then ${Object.keys(badges).length ? `top rated by ${roleById[role].label.toLowerCase()}, then ` : ""}${mySystems.length ? "tools that work with your systems, then " : ""}easiest` : mySystems.length ? ", tools that work with your systems first" : ", A–Z"}.
        </p>
        {filtersOn.length > 0 && (
          <p className={styles.filtersOn}>
            <b>Filters on:</b> {filtersOn.join(" · ")}
            <button type="button" className="btn ghost small" onClick={clearFilters}>Clear filters</button>
          </p>
        )}
      </div>

      {!list.length ? (
        <div className="empty"><h3>No tools match</h3><p className="muted">Try a different search or clear the filters.</p></div>
      ) : layout === "table" ? (
        <div className="table-wrap"><table className={styles.table}>
          <thead><tr><th scope="col">Tool</th><th scope="col">Type</th><th scope="col">Free for teachers?</th><th scope="col">Pricing</th><th scope="col">Ease</th><th scope="col">Student data &amp; equity</th><th scope="col">Connects with</th><th scope="col">Best for</th></tr></thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id} tabIndex={0} onClick={() => openTool(t.id)} onKeyDown={(e) => { if (e.key === "Enter") openTool(t.id); }}>
                <td><span className={styles.toolName}>{t.name}</span><br /><span className="muted">{t.company}</span></td>
                <td>{catOf(t).label}</td><td><FreeStatus tool={t} /></td><td>{t.pricing}</td><td><Ease n={t.ease} /></td>
                <td><TagRow><PrivacyTags tool={t} /></TagRow></td>
                <td><ConnectChips tool={t} max={6} bare mine={mineNames} /></td>
                <td><TagRow><PersonaTags tool={t} /></TagRow></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : (
        <div className={styles.grid}>
          {list.map((t) => (
            <article key={t.id} className={styles.card} id={`tool-${t.id}`} style={{ ["--c" as string]: catOf(t).color }}>
              <div className={styles.cardHead}>
                <div className="mono" aria-hidden="true">{initials(t.name)}</div>
                <div className={styles.cardTitle}>
                  <h3>{t.name}</h3><div className={styles.company}>{t.company}</div><span className="cat">{catOf(t).label}</span>
                  <div><TopPickBadge tool={t} role={role} /> <RoleRatedBadge role={role} badge={badges[t.id]} /></div>
                  {systemsMatch(t, mySystems).length > 0 && (
                    <div><span className="yours" tabIndex={0} data-tip={`Works with ${systemsMatch(t, mySystems).join(", ")}, which your school uses.`}>✓ Works with yours</span></div>
                  )}
                </div>
              </div>
              <p className={styles.desc}>{rich(t.desc)}</p>
              <TagRow className={`${styles.cardRow} ${styles.tight}`}><span className="label">Best for</span><PersonaTags tool={t} /></TagRow>
              <TagRow className={styles.cardRow}><PrivacyTags tool={t} /></TagRow>
              <ConnectChips tool={t} mine={mineNames} className={styles.cardRow} />
              <div className={styles.stats}>
                <div><div className="label">Free for teachers?</div><div className={styles.statValue}><FreeStatus tool={t} /></div></div>
                <div><div className="label">Ease of use</div><div className={styles.statValue}><Ease n={t.ease} /></div></div>
              </div>
              <div className={styles.foot}>
                <button type="button" className="btn small primary" onClick={() => openTool(t.id)}>Scouting report</button>
                <StarsSummary toolId={t.id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
