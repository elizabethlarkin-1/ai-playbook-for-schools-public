"use client";

import { useCallback, useState } from "react";
import type { Term } from "@/lib/types";
import { usePlaybook } from "../PlaybookProvider";
import { useFocusFlash } from "../useFocusFlash";
import styles from "./LingoView.module.css";

const KINDS: [Term["kind"] | "", string][] = [["", "All"], ["school", "School"], ["privacy", "Privacy"], ["ai", "AI"]];
const KIND_NAME = { school: "School", privacy: "Privacy", ai: "AI" };
const letterOf = (t: Term) => (/[A-Z]/i.test(t.abbr[0]) ? t.abbr[0].toUpperCase() : "#");

export default function LingoView() {
  const { content } = usePlaybook();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Term["kind"] | "">("");
  useFocusFlash("term", useCallback((id: string) => `term-${id}`, []), useCallback(() => { setQ(""); setKind(""); }, []));

  const s = q.trim().toLowerCase();
  const list = content.terms
    .filter((t) => (!kind || t.kind === kind) && (!s || [t.abbr, t.full, t.def].join(" ").toLowerCase().includes(s)))
    .sort((a, b) => a.abbr.localeCompare(b.abbr, "en", { sensitivity: "base", numeric: true }));
  const letters = new Set(list.map(letterOf));

  const jump = (l: string) => {
    const t = list.find((x) => letterOf(x) === l); if (!t) return;
    const el = document.getElementById(`term-${t.id}`); if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 2200);
  };

  return (
    <section aria-label="Lingo and Acronyms">
      <div className="controls">
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12l-4.5 5.5V13l-3 1.5V8.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
          <label className="sr" htmlFor="gq">Filter the glossary</label>
          <input id="gq" type="search" placeholder="Filter this list…" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="seg" role="group" aria-label="Which terms">
          {KINDS.map(([k, label]) => <button key={label} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{label}</button>)}
        </div>
      </div>
      <nav className={styles.az} aria-label="Jump to letter">
        {["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((l) => (
          <a key={l} href="#" className={letters.has(l) ? "" : styles.off} onClick={(e) => { e.preventDefault(); jump(l); }}>{l}</a>
        ))}
      </nav>
      <div className={styles.terms}>
        {!list.length && <div className="empty"><h3>No terms match</h3><p className="muted">Try another word.</p></div>}
        {list.map((t) => (
          <article key={t.id} className={styles.card} id={`term-${t.id}`}>
            <span className={styles.kind}>{KIND_NAME[t.kind]}</span>
            <div className={styles.abbr}>{t.abbr}</div><div className={styles.full}>{t.full}</div><p>{t.def}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
