"use client";

import { useState } from "react";
import { usePlaybook } from "../PlaybookProvider";
import { SdgBadges } from "../ToolBits";
import MembersOnly from "../MembersOnly";
import styles from "./TopFiveView.module.css";

export default function TopFiveView() {
  const { content, role, goTo, copyText } = usePlaybook();
  // Starts on the role picked on the Roster (or Teachers); a chip here overrides it.
  const [picked, setTopRole] = useState<string | null>(null);
  const topRole = picked ?? (role || "teacher");
  const items = content.topFive.filter((x) => x.role === topRole).sort((a, b) => a.rank - b.rank);

  return (
    <section aria-label="Top 5 by Role">
      <div className={styles.hero}>
        <h2>Top 5 by Role</h2>
        <p className="muted">The five prompts each role should try first. Each one is either a <b>Play</b> (a prompt for one task) or a <b>System prompt</b> (instructions you set up once).</p>
      </div>
      <div className="chips">
        {content.roles.map((r) => <button key={r.id} type="button" className="chip" aria-pressed={topRole === r.id} onClick={() => setTopRole(r.id)}>{r.label}</button>)}
      </div>
      <div className={styles.list}>
        {items.map((it) => {
          const play = it.kind === "play" ? content.plays.find((p) => p.id === it.refId) : undefined;
          const x = play ?? (it.kind === "sys" ? content.systemPrompts.find((s) => s.id === it.refId) : undefined);
          if (!x) return null;
          return (
            <article key={it.rank} className={styles.item}>
              <div className={styles.rank}>{it.rank}</div>
              <h3>
                {x.title} <span className={`pill ${it.kind === "play" ? styles.kindPlay : styles.kindSys}`}>{it.kind === "play" ? "Play" : "System prompt"}</span>
                {play?.student && <span className="pv warn" tabIndex={0} data-tip="Remove names and IDs first; use district-approved tools only.">Student info</span>}
              </h3>
              <p className="muted">{it.why}</p>
              {play && <div className={`${styles.row} ${styles.tight}`}><SdgBadges list={play.sdg} /></div>}
              <div className={styles.row}>
                {x.locked ? <MembersOnly compact /> : <button type="button" className="btn small primary" onClick={() => copyText(x.prompt)}>Copy prompt</button>}
                <button type="button" className="btn small ghost" onClick={() => goTo(it.kind, x.id)}>See full {it.kind === "play" ? "play" : "prompt"}</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
