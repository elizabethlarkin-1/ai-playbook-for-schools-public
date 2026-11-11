"use client";

import type { Tool } from "@/lib/types";
import { UNDER_REVIEW } from "@/lib/text";
import { usePlaybook } from "./PlaybookProvider";
import { MIN_ROLE_RATINGS, type RoleBadge } from "@/lib/ranking";
import styles from "./ToolBits.module.css";

// Small pieces of a tool card, shared by the roster cards, the table and the scouting report.
// Reasons and details live in data-tip pop-ups so the cards stay uncluttered.

const FREE_LABEL = { yes: "Yes", limited: "Free plan, limits", no: "Paid / district", review: "Under review" };
const FREE_CLASS = { yes: "yes", limited: "part", no: "", review: "" };

export function FreeStatus({ tool }: { tool: Tool }) {
  return (
    <>
      <span className={FREE_CLASS[tool.free]}>{FREE_LABEL[tool.free]}</span>
      {tool.free === "review" && <span className="flag" tabIndex={0} data-tip={UNDER_REVIEW}>Check</span>}
    </>
  );
}

export function Ease({ n }: { n: number }) {
  const { content } = usePlaybook();
  return (
    <>
      <span className="pips" style={{ ["--pip" as string]: "var(--green)" }}>
        {[1, 2, 3].map((i) => <i key={i} className={i <= n ? "on" : ""} />)}
      </span>
      {content.ease[String(n)]}
    </>
  );
}

export function PersonaTags({ tool }: { tool: Tool }) {
  const { roleById } = usePlaybook();
  return (
    <>
      {tool.personas.map((p) => {
        const r = roleById[p.id];
        return (
          <span key={p.id} className={`persona${p.top ? " top" : ""}`} tabIndex={0}
            data-tip={(p.top ? `★ Top pick for ${r.label}. ` : "") + p.why}>
            {p.top ? "★ " : ""}{r.tag}
          </span>
        );
      })}
    </>
  );
}

/** A flush row of tags; the parent passes a className for its own spacing. */
export function TagRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={className ? `${styles.row} ${className}` : styles.row}>{children}</div>;
}

/** "Top rated by [role]": earned from 10+ ratings by that role, or a clearly labeled demo example. */
export function RoleRatedBadge({ role, badge }: { role: string; badge?: RoleBadge }) {
  const { roleById } = usePlaybook();
  if (!badge || !roleById[role]) return null;
  const who = roleById[role].label;
  const tip = badge.example
    ? `Example badge for the demo. Real badges appear after ${MIN_ROLE_RATINGS}+ ratings from ${who}, using a fair average.`
    : `Rated highly by ${badge.count} ${who.toLowerCase()}, using a fair average so a few ratings can't tip it.`;
  return (
    <span className={styles.roleRated} tabIndex={0} data-tip={tip}>
      ★ Top rated by {who}{badge.example && <span className={styles.example}>Example</span>}
    </span>
  );
}

export function TopPickBadge({ tool, role }: { tool: Tool; role: string }) {
  const { roleById } = usePlaybook();
  const p = role ? tool.personas.find((x) => x.id === role && x.top) : undefined;
  return p ? <span className="toppick" tabIndex={0} data-tip={p.why}>★ Top pick for {roleById[role].label}</span> : null;
}

const EQ = { free: "Free school-wide", device: "Any device", lang: "Languages", access: "Accessibility" } as const;
const EQ_MARK = { ok: "✓", warn: "!", unknown: "?" };
export const eqScore = (t: Tool) => (Object.keys(EQ) as (keyof typeof EQ)[]).filter((k) => t.equity?.[k]?.s === "ok").length;

export function PrivacyTags({ tool }: { tool: Tool }) {
  const p = tool.privacy;
  const dpaText = { yes: "Signs DPAs", district: "District contract", none: "No public DPA", review: "DPA: check" }[p.dpa];
  return (
    <>
      {p.ferpa
        ? <span className="pv ok" tabIndex={0} data-tip={p.ferpaNote || "Vendor states FERPA compliance."}>FERPA ✓</span>
        : <span className="pv warn" tabIndex={0} data-tip={p.ferpaNote || UNDER_REVIEW}>FERPA ?</span>}
      {p.coppa != null && (p.coppa
        ? <span className="pv ok" tabIndex={0} data-tip={p.coppaNote || "Vendor states COPPA compliance."}>COPPA ✓</span>
        : <span className="pv warn" tabIndex={0} data-tip={p.coppaNote || UNDER_REVIEW}>COPPA ?</span>)}
      <span className={`pv ${p.dpa === "review" || p.dpa === "none" ? "warn" : "ok"}`} tabIndex={0} data-tip={p.dpaNote}>{dpaText}</span>
      <span className="pv" tabIndex={0} data-tip={p.studentsNote}>{p.students ? "Student-facing" : "Staff only"}</span>
      {tool.equity && <EquityChip tool={tool} />}
    </>
  );
}

function EquityChip({ tool }: { tool: Tool }) {
  const n = eqScore(tool);
  const tip = "Equity check (SDG 4.5): " + (Object.keys(EQ) as (keyof typeof EQ)[]).map((k) => `${EQ_MARK[tool.equity![k].s]} ${EQ[k]}`).join(" · ") + ". Open the scouting report for details.";
  return <span className={`eq${n === 4 ? " full" : ""}`} tabIndex={0} data-tip={tip}>Equity <b>{n}/4</b></span>;
}

export function EquityList({ tool }: { tool: Tool }) {
  return (
    <ul className={styles.eqList}>
      {(Object.keys(EQ) as (keyof typeof EQ)[]).map((k) => {
        const e = tool.equity![k];
        return (
          <li key={k}>
            <span className={`${styles.eqMark} ${styles[e.s]}`} aria-label={e.s === "ok" ? "Yes" : e.s === "warn" ? "Partly" : "Not confirmed"}>{EQ_MARK[e.s]}</span>
            <b>{EQ[k]}</b><span>{e.t}</span>
          </li>
        );
      })}
    </ul>
  );
}

const CONN = { roster: "Class rosters & sign-in", lms: "Share to class / LMS", grades: "Sends grades" } as const;
const CONN_TERM = { roster: "rostering", lms: "lms", grades: "passback" };
type ConnKind = keyof typeof CONN;

/** Every system name a tool connects to, for the "Works with" filter and search. */
export const connAll = (t: Tool) =>
  t.connects ? [...new Set((Object.keys(CONN) as ConnKind[]).flatMap((k) => (t.connects![k] || []).map((x) => x.n)))] : [];

/**
 * Which of the reader's school systems this tool works with. "Google Workspace" and
 * "Microsoft 365" match that company's own tools and anything that connects to their LMS.
 */
export function systemsMatch(t: Tool, systems: string[]): string[] {
  const names = connAll(t);
  return systems.filter((s) =>
    s === "Google Workspace" ? t.company === "Google" || names.includes("Google Classroom")
      : s === "Microsoft 365" ? t.company === "Microsoft" || names.includes("Microsoft Teams")
        : names.includes(s));
}

export function ConnectChips({ tool, max = 4, bare = false, mine = [], className }: { tool: Tool; max?: number; bare?: boolean; mine?: string[]; className?: string }) {
  const c = tool.connects;
  if (!c) return null;
  const items: { n: string; v: boolean; via?: string; k: ConnKind }[] = [];
  for (const k of ["grades", "lms", "roster"] as ConnKind[]) for (const x of c[k] || []) if (!items.some((i) => i.n === x.n)) items.push({ ...x, k });
  const tipFor = (x: (typeof items)[number]) =>
    `${x.n}: ${CONN[x.k].toLowerCase()}${x.via ? ` (${x.via})` : ""}.${x.v ? "" : " Not confirmed on an official page."}${c.paid ? " " + c.paid : ""}`;
  // The reader's own systems go first so they're never hidden behind "+N".
  items.sort((a, b) => Number(mine.includes(b.n)) - Number(mine.includes(a.n)));
  const shown = items.slice(0, max), more = items.length - shown.length;
  const inner = !items.length
    ? <span className={styles.none} tabIndex={0} data-tip={c.note || "No school-system connections found. Use it on its own and copy results in by hand."}>Works on its own</span>
    : <>
        {shown.map((x) => <span key={x.n} className={[styles.sys, x.k === "grades" && styles.grade, !x.v && styles.unconfirmed, mine.includes(x.n) && styles.mine].filter(Boolean).join(" ")} tabIndex={0} data-tip={(mine.includes(x.n) ? "Your school uses this. " : "") + tipFor(x)}>{x.n}</span>)}
        {more > 0 && <span className={styles.sys} tabIndex={0} data-tip={items.slice(max).map(tipFor).join(" · ")}>+{more}</span>}
      </>;
  const cls = className ? `${styles.conn} ${className}` : styles.conn;
  if (bare) return <div className={cls}>{inner}</div>;
  return <div className={cls}><span className="label">Connects with</span>{inner}</div>;
}

export function ConnectDetail({ tool }: { tool: Tool }) {
  const c = tool.connects!;
  return (
    <>
      <div className={styles.connList}>
        {(Object.keys(CONN) as ConnKind[]).map((k) => {
          const xs = c[k] || [];
          return (
            <div key={k}>
              <b><button type="button" className="term" data-term={CONN_TERM[k]}>{CONN[k]}</button></b>
              <span>
                {xs.length ? xs.map((x, i) => (
                  <span key={x.n}>
                    {i > 0 && ", "}{x.n}{x.via && <span className="muted"> ({x.via})</span>}
                    {!x.v && <> <span className="flag" tabIndex={0} data-tip={UNDER_REVIEW}>Check</span></>}
                  </span>
                )) : <span className="muted">None found</span>}
              </span>
            </div>
          );
        })}
      </div>
      {c.paid && <p className={`muted ${styles.connNote}`}>{c.paid}</p>}
      {c.note && <p className={`muted ${styles.connNote}`}>{c.note}</p>}
    </>
  );
}

export function SdgBadges({ list }: { list: string[] }) {
  const { sdgById } = usePlaybook();
  return <>{list.map((t) => <span key={t} className="sdg" tabIndex={0} data-tip={`UN SDG 4, target ${t}: ${sdgById[t]}`}>SDG {t}</span>)}</>;
}
