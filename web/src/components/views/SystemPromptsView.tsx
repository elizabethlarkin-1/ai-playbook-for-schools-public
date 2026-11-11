"use client";

import { useCallback, useState } from "react";
import { usePlaybook } from "../PlaybookProvider";
import { useFocusFlash } from "../useFocusFlash";
import { RoleChips } from "./PlaysView";
import MembersOnly from "../MembersOnly";
import card from "../PlayCard.module.css";
import styles from "./SystemPromptsView.module.css";

export default function SystemPromptsView() {
  const { content, roleById, copyText } = usePlaybook();
  const [role, setRole] = useState("");
  useFocusFlash("sys", useCallback((id: string) => `sys-${id}`, []), useCallback(() => setRole(""), []));
  const list = content.systemPrompts.filter((x) => !role || x.roles.includes(role));

  return (
    <section aria-label="System Prompts">
      <div className={styles.hero}>
        <div>
          <h2>Set your AI&apos;s game plan once</h2>
          <p>A <button type="button" className="term" data-term="system-prompt">system prompt</button> is a standing set of instructions you paste into an AI tool one time. After that, every chat follows it, so the AI already knows your grade level, your subject and your school&apos;s voice. Plays are for one task; system prompts coach the whole season.</p>
        </div>
        <div className="safety"><b>Student data stays home</b>Never put student names, ID numbers, grades, IEP details or health information in a system prompt. Use only district-approved tools, and follow your district AI policy.</div>
      </div>
      <RoleChips value={role} onChange={setRole} />
      <div className={card.grid}>
        {list.map((x) => (
          <article key={x.id} className={`${card.card} ${card.template}`} id={`sys-${x.id}`}>
            <div className={card.number}>System prompt</div><h3>{x.title}</h3>
            <div className={card.row}>{x.roles.map((r) => <span key={r} className="aud">{roleById[r].tag}</span>)}</div>
            <pre id={`sysp-${x.id}`} className={card.prompt} tabIndex={0} role="region" aria-label={`System prompt: ${x.title}`}>{x.prompt}</pre>
            {x.locked ? <MembersOnly what="the full system prompt and an example" /> : (
              <>
                <div className={card.row}><button type="button" className="btn small primary" onClick={() => copyText(x.prompt, document.getElementById(`sysp-${x.id}`))}>Copy system prompt</button></div>
                {x.example && <p className={card.tip}>{x.example}</p>}
                <p className={card.tip}><b>Then try:</b> “{x.tryIt}”</p>
              </>
            )}
            <details className={card.details}><summary>Where to paste it</summary><p>{x.whereText}</p></details>
          </article>
        ))}
      </div>
    </section>
  );
}
