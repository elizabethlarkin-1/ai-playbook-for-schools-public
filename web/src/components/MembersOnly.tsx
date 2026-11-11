import Link from "next/link";
import styles from "./MembersOnly.module.css";

/** Shown in place of the copy button on a members-only prompt the viewer can only preview. */
export default function MembersOnly({ what = "the full prompt and coach's tip", compact = false }: { what?: string; compact?: boolean }) {
  return (
    <div className={`${styles.lock} ${compact ? styles.compact : ""}`}>
      <span className={styles.badge}>Members only</span>
      {!compact && <span className={styles.text}>Members see {what}. Pay, or earn it free with feedback.</span>}
      <Link href="/membership" className="btn small primary">Become a member</Link>
    </div>
  );
}
