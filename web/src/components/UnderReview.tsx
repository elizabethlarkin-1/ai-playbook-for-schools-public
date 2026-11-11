"use client";

import Link from "next/link";
import { useRef } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/lib/prefs";
import { underReview } from "@/lib/review";
import { usePlaybook } from "./PlaybookProvider";
import styles from "./UnderReview.module.css";

/** "Under review" link under the header date: opens a list of the facts we couldn't confirm, grouped by tool. */
export default function UnderReview() {
  const { content, openTool } = usePlaybook();
  const ref = useRef<HTMLDialogElement>(null);
  const mounted = useMounted();
  const list = content.tools
    .map((t) => ({ t, items: underReview(t) }))
    .filter((x) => x.items.length)
    .sort((a, b) => a.t.name.localeCompare(b.t.name));
  if (!list.length) return null;
  const close = () => ref.current?.close();

  return (
    <>
      <button type="button" className={styles.link} aria-haspopup="dialog" onClick={() => ref.current?.showModal()}>Under review</button>
      {mounted && createPortal(
      <dialog className={styles.dialog} ref={ref} aria-labelledby="reviewTitle" onClick={(e) => { if (e.target === ref.current) close(); }}>
        <div className={styles.inner}>
          <div className={styles.head}>
            <h2 id="reviewTitle" className={styles.title}>Under review</h2>
            <button type="button" className="x" aria-label="Close" autoFocus onClick={close}>×</button>
          </div>
          <p className={styles.intro}>We check every tool on the company&apos;s own website. These facts weren&apos;t published there, so we couldn&apos;t confirm them yet. It doesn&apos;t mean something is wrong. Ask the company or your district if you need to know.</p>
          <ul className={styles.tools}>
            {list.map(({ t, items }) => (
              <li key={t.id}>
                <button type="button" className={styles.tool} onClick={() => { close(); openTool(t.id); }}>{t.name}</button>
                <ul className={styles.items}>{items.map((i) => <li key={i}>{i}</li>)}</ul>
              </li>
            ))}
          </ul>
          <div className="row-actions">
            <Link href="/what-we-check" className="btn small" onClick={close}>How we check tools →</Link>
            <button type="button" className="btn small ghost" onClick={close}>Close</button>
          </div>
        </div>
      </dialog>,
      // The link sits in the header's small, no-wrap date line; the dialog lives on <body> so it doesn't inherit that.
      document.body)}
    </>
  );
}
