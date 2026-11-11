"use client";

import { useEffect, useRef } from "react";
import { LOCATION_HELP, LOCATION_LABEL } from "@/lib/review";
import { UNDER_REVIEW, fmtDate, initials, rich } from "@/lib/text";
import { usePlaybook } from "./PlaybookProvider";
import { FeedbackSection } from "./Feedback";
import { ConnectDetail, Ease, EquityList, FreeStatus, PersonaTags, PrivacyTags, SdgBadges, TagRow, eqScore } from "./ToolBits";
import styles from "./ToolDrawer.module.css";

/** The "scouting report": a side drawer with everything about one tool. */
export default function ToolDrawer({ toolId, onClose }: { toolId: string | null; onClose: () => void }) {
  const { content, toolById, catOf, goTo, sdgById } = usePlaybook();
  const ref = useRef<HTMLDialogElement>(null);
  const t = toolId ? toolById[toolId] : null;

  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (t && !d.open) d.showModal();
    if (!t && d.open) d.close();
    if (t) d.scrollTop = 0;
  }, [t]);

  const plays = t ? content.plays.filter((p) => p.tools.includes(t.id)) : [];
  const targets = [...new Set(plays.flatMap((p) => p.sdg))].sort();
  const subjects = Object.fromEntries(content.subjects.map((s) => [s.id, s.label]));

  return (
    <dialog className={styles.drawer} id="drawer" ref={ref} aria-labelledby="drawerTitle"
      onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {t && (
        <div className={styles.inner}>
          <div className={styles.top} style={{ ["--c" as string]: catOf(t).color }}>
            <div className="mono" aria-hidden="true">{initials(t.name)}</div>
            <div className={styles.topText}><h2 id="drawerTitle" className={styles.name}>{t.name}</h2><div className="muted">{t.company}</div><span className="cat">{catOf(t).label}</span></div>
            <button type="button" className="x" aria-label="Close" autoFocus onClick={onClose}>×</button>
          </div>
          <div className={styles.section}><span className="label">What it is</span><p>{rich(t.desc)}</p></div>
          <div className={styles.section}><span className="label">Best for (tap a tag for why)</span><TagRow><PersonaTags tool={t} /></TagRow></div>
          {t.subjects.length > 0 && (
            <div className={styles.section}><span className="label">Subjects</span>
              <div className={styles.uses}>{t.subjects.includes("all") ? <span>All subjects</span> : t.subjects.map((s) => <span key={s}>{subjects[s]}</span>)}</div>
            </div>
          )}
          <FeedbackSection tool={t} />
          <div className={styles.section}><span className="label">Good for</span><div className={styles.uses}>{t.uses.map((u) => <span key={u}>{u}</span>)}</div></div>
          <div className={styles.section}><span className="label">Pricing</span><p><b>Free for teachers?</b> <FreeStatus tool={t} /></p><p>{t.pricing}</p></div>
          <div className={styles.section}><span className="label">Student data &amp; privacy</span>
            <TagRow><PrivacyTags tool={t} /></TagRow>
            <ul>{[t.privacy.ferpaNote, t.privacy.coppaNote, t.privacy.dpaNote, t.privacy.studentsNote, t.privacy.dataNote].filter(Boolean).map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
          {t.privacy.location && (
            <div className={styles.section}><span className="label">Where your data goes</span>
              <dl className={styles.where}>
                {(Object.keys(LOCATION_LABEL) as (keyof typeof LOCATION_LABEL)[]).map((k) => {
                  const part = t.privacy.location![k];
                  return (
                    <div key={k}>
                      <dt>{LOCATION_LABEL[k]}{LOCATION_HELP[k] && <> <button type="button" className="info" aria-label={`What \u201c${LOCATION_LABEL[k]}\u201d means`} data-tip={LOCATION_HELP[k]}>i</button></>}</dt>
                      <dd>{part.t}{part.check && <> <span className="flag" tabIndex={0} data-tip={UNDER_REVIEW}>Check</span></>}</dd>
                    </div>
                  );
                })}
              </dl>
              <p className={`muted ${styles.smaller}`}>From the company&apos;s own pages. Different countries have different privacy laws, so check with your district if this matters to you. <button type="button" className="term" data-term="data-location">Stored vs. processed: what&apos;s the difference?</button></p>
            </div>
          )}
          {t.connects && (
            <div className={styles.section}><span className="label">Connects with your school systems</span>
              <ConnectDetail tool={t} />
              <p className={`muted ${styles.smaller}`}>Most SIS connections run through a rostering service like Clever or ClassLink. Any connection that moves student data needs a signed <button type="button" className="term" data-term="dpa">DPA</button> first.</p>
            </div>
          )}
          {t.equity && (
            <div className={styles.section}><span className="label">Equity check · {eqScore(t)} of 4</span>
              <p className={`muted ${styles.small}`}>Can every student and family use it? Ties to <span className="sdg" tabIndex={0} data-tip={`UN SDG 4, target 4.5: ${sdgById["4.5"]}`}>SDG 4.5</span></p>
              <EquityList tool={t} />
            </div>
          )}
          {t.notOffered && (
            <div className={styles.section}><span className="label">Confirmed: not offered</span>
              <ul>{t.notOffered.map((n) => <li key={n}>{n}</li>)}</ul>
              <p className={`muted ${styles.smaller}`}>We checked the company&apos;s own site on {fmtDate(content.checkedOn)}.</p>
            </div>
          )}
          {targets.length > 0 && <div className={styles.section}><span className="label">SDG 4 targets its plays support</span><TagRow><SdgBadges list={targets} /></TagRow></div>}
          {t.review && <div className="review-box"><b>Under review</b>{t.review}</div>}
          <div className={styles.section}><span className="label">Ease of use</span><p><Ease n={t.ease} /></p></div>
          {plays.length > 0 && (
            <div className={styles.section}><span className="label">Plays that use it</span>
              <div className={styles.uses}>{plays.map((p) => <button key={p.id} type="button" className={styles.playLink} onClick={() => goTo("play", p.id, t.id)}>Play {p.no}: {p.title} →</button>)}</div>
            </div>
          )}
          <div className={styles.section}><span className="label">Official site</span>
            <p>{t.urls.map((u, i) => <span key={u}>{i > 0 && <br />}<a href={u} target="_blank" rel="noopener">{u.replace(/^https?:\/\//, "")}</a></span>)}</p>
            <p className={`muted ${styles.smaller}`}>Checked on the official site {fmtDate(content.checkedOn)}. Prices and terms change; confirm before buying.</p>
          </div>
        </div>
      )}
    </dialog>
  );
}
