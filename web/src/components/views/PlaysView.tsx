"use client";

import { useCallback, useState } from "react";
import type { Play } from "@/lib/types";
import { usePlaybook } from "../PlaybookProvider";
import { SdgBadges } from "../ToolBits";
import { useFocusFlash } from "../useFocusFlash";
import MembersOnly from "../MembersOnly";
import card from "../PlayCard.module.css";
import styles from "./PlaysView.module.css";

export function RoleChips({ value, onChange }: { value: string; onChange: (r: string) => void }) {
  const { content } = usePlaybook();
  return (
    <div className="chips">
      <span className="label">Role</span>
      <button type="button" className="chip" aria-pressed={!value} onClick={() => onChange("")}>Everyone</button>
      {content.roles.map((r) => <button key={r.id} type="button" className="chip" aria-pressed={value === r.id} onClick={() => onChange(r.id)}>{r.label}</button>)}
    </div>
  );
}

export const StudentGuard = () => (
  <div className="guard"><b>Student info</b><span>Remove names, ID numbers and other details that identify a student before you paste. Use only district-approved tools and follow your district AI policy.</span></div>
);

export default function PlaysView() {
  const { content, roleById, toolById, catOf, openTool, copyText } = usePlaybook();
  const [role, setRole] = useState("");
  const [subj, setSubj] = useState("");
  const [focusFilter, setFocusFilter] = useState("");
  const reset = useCallback(() => { setRole(""); setSubj(""); setFocusFilter(""); }, []);
  useFocusFlash("play", useCallback((id: string) => `play-${id}`, []), reset);

  const subjectLabel = Object.fromEntries(content.subjects.map((s) => [s.id, s.label]));
  const list = content.plays.filter((p) =>
    (!focusFilter || (focusFilter === "incl" ? p.incl : p.sdg.includes(focusFilter))) &&
    (!role || p.roles.includes(role)) &&
    (role !== "teacher" || !subj || !p.subjects.length || p.subjects.includes(subj)));

  return (
    <section aria-label="The Plays">
      <h2 className="sr">The Plays</h2>
      <p className={`muted ${styles.intro}`}>
        Copy-ready prompts for real school tasks. Swap the <b>[brackets]</b> for your details, then paste into one of the tools listed on the play. Plays marked <b>Student info</b> carry a reminder to strip names and IDs first. Red <b>SDG</b> badges show which target of <button type="button" className="term" data-term="sdg4">UN Sustainable Development Goal 4</button> a play supports; tap one to read the target.
      </p>
      <div className="chips">
        <span className="label">Focus</span>
        <button type="button" className="chip" aria-pressed={!focusFilter} onClick={() => setFocusFilter("")}>All plays</button>
        <button type="button" className="chip incl" aria-pressed={focusFilter === "incl"} onClick={() => setFocusFilter("incl")}>★ Inclusion</button>
        {content.sdgTargets.map((t) => <button key={t.id} type="button" className="chip small" title={t.text} aria-pressed={focusFilter === t.id} onClick={() => setFocusFilter(t.id)}>SDG {t.id}</button>)}
      </div>
      <RoleChips value={role} onChange={(r) => { setRole(r); setSubj(""); }} />
      {role === "teacher" && (
        <div className="chips sub">
          <span className="label">Subject</span>
          <button type="button" className="chip small" aria-pressed={!subj} onClick={() => setSubj("")}>All subjects</button>
          {content.subjects.map((s) => <button key={s.id} type="button" className="chip small" aria-pressed={subj === s.id} onClick={() => setSubj(s.id)}>{s.label}</button>)}
        </div>
      )}
      <div className={card.grid}>
        {!list.length && <div className="empty"><h3>No plays match</h3><p className="muted">Try another role or focus.</p></div>}
        {list.map((p: Play) => (
          <article key={p.id} className={card.card} id={`play-${p.id}`}>
            <div className={card.number}>Play {p.no}</div><h3>{p.title}</h3>
            <div className={card.row}>
              {p.roles.map((r) => <span key={r} className="aud">{roleById[r].tag}</span>)}
              {p.subjects.map((s) => <span key={s} className="subj">{subjectLabel[s]}</span>)}
            </div>
            <div className={card.row}><SdgBadges list={p.sdg} /></div>
            {p.student && <StudentGuard />}
            <pre id={`prompt-${p.id}`} className={card.prompt} tabIndex={0} role="region" aria-label={`Prompt: ${p.title}`}>{p.prompt}</pre>
            {p.locked ? <MembersOnly /> : (
              <>
                <div className={card.row}><button type="button" className="btn small primary" onClick={() => copyText(p.prompt, document.getElementById(`prompt-${p.id}`))}>Copy prompt</button></div>
                <p className={card.tip}><b>Coach&apos;s tip:</b> {p.tip}</p>
              </>
            )}
            <div className={card.row}>
              <span className="label">Run it in</span>
              {p.tools.map((id) => toolById[id] && (
                <button key={id} type="button" className={card.toolChip} style={{ ["--c" as string]: catOf(toolById[id]).color }} onClick={() => openTool(id)}>{toolById[id].name}</button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
