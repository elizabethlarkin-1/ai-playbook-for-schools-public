"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { initials, plain } from "@/lib/text";
import { usePlaybook } from "./PlaybookProvider";
import { connAll } from "./ToolBits";
import styles from "./SearchDialog.module.css";

type Item = { ic: string; c: string; title: string; sub: string; go: () => void };

/** Search across tools, plays, system prompts and terms (opened with the header button or "/"). */
export default function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { content, catOf, roleById, openTool, goTo } = usePlaybook();
  const ref = useRef<HTMLDialogElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { setQ(""); setSel(0); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    const hit = (text: string) => !s || text.toLowerCase().includes(s);
    const tags = (roles: string[]) => roles.map((r) => roleById[r].tag).join(" · ");
    const g: [string, Item[]][] = [
      ["Tools", content.tools.filter((t) => hit([t.name, t.company, plain(t.desc), ...t.uses, ...connAll(t)].join(" ")))
        .map((t) => ({ ic: initials(t.name), c: catOf(t).color, title: t.name, sub: catOf(t).label, go: () => openTool(t.id) }))],
      ["Plays", content.plays.filter((p) => hit(p.title + " " + p.prompt))
        .map((p) => ({ ic: "P" + p.no, c: "var(--pop)", title: p.title, sub: tags(p.roles), go: () => goTo("play", p.id) }))],
      ["System prompts", content.systemPrompts.filter((x) => hit(x.title + " " + x.prompt))
        .map((x) => ({ ic: "SP", c: "var(--blue)", title: x.title, sub: tags(x.roles), go: () => goTo("sys", x.id) }))],
      ["Lingo", content.terms.filter((t) => hit(t.abbr + " " + t.full + " " + t.def))
        .map((t) => ({ ic: t.abbr.slice(0, 3).toUpperCase(), c: "var(--green)", title: t.abbr, sub: t.full, go: () => goTo("term", t.id) }))],
    ];
    return g.map(([name, items]) => [name, s ? items : items.slice(0, 4)] as [string, Item[]]).filter(([, items]) => items.length);
  }, [q, content, catOf, roleById, openTool, goTo]);
  const flat = groups.flatMap(([, items]) => items);

  // Keep the highlighted result in view as the arrow keys move it.
  useEffect(() => {
    resultsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [sel, groups]);

  const pick = (i: number) => { const it = flat[i]; if (it) { onClose(); it.go(); } };

  return (
    <dialog className={styles.dialog} id="searchDlg" ref={ref} aria-label="Search the playbook"
      onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className={styles.top}>
        <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M11 11l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        <label className="sr" htmlFor="sq">Search tools, plays and terms</label>
        <input id="sq" type="text" enterKeyHint="search" placeholder="Try “IEP”, “rubric” or “MagicSchool”" autoComplete="off" spellCheck={false} autoFocus
          value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setSel((n) => Math.max(0, Math.min(flat.length - 1, n + (e.key === "ArrowDown" ? 1 : -1)))); }
            if (e.key === "Enter") { e.preventDefault(); pick(sel); }
          }} />
        <button type="button" className={styles.close} aria-label="Close search" onClick={onClose}>Close</button>
      </div>
      <div className={styles.results} role="listbox" aria-label="Search results" ref={resultsRef}>
        {flat.length === 0 && <div className={styles.empty}><b>No matches</b><p className="muted">Try “IEP”, “rubric”, “translate” or a tool name.</p></div>}
        {(() => {
          let i = -1;
          return groups.map(([name, items]) => (
            <div key={name} className={styles.groupWrap}>
              <div className={styles.group}>{name}</div>
              {items.map((it) => {
                i += 1; const idx = i;
                return (
                  <button key={name + it.title} type="button" className={styles.item} role="option" aria-selected={idx === sel}
                    style={{ ["--c" as string]: it.c }} onClick={() => pick(idx)}>
                    <span className={styles.icon} aria-hidden="true">{it.ic}</span><b>{it.title}</b><span className={styles.sub}>{it.sub}</span>
                  </button>
                );
              })}
            </div>
          ));
        })()}
      </div>
      <div className={styles.foot}><kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close</div>
    </dialog>
  );
}
