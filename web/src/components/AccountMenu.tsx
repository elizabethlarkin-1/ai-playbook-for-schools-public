"use client";

import Link from "next/link";
import { useRef } from "react";
import { initials } from "@/lib/text";
import { useAccount } from "./AccountProvider";
import styles from "./AccountMenu.module.css";

/** Header control: "Sign in", or the signed-in person's menu (edit playbook, admin, sign out). */
export default function AccountMenu() {
  const { configured, ready, user, profile, isAdmin, signOut } = useAccount();
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => { if (menu.current) menu.current.open = false; };
  if (!configured) return null;
  // Hold the button's space while the session loads, so the header doesn't shift when it appears.
  if (!ready) return <span className={`btn small primary ${styles.signIn} ${styles.pending}`} aria-hidden="true">Sign in</span>;
  if (!user) return <Link href="/sign-in" className={`btn small primary ${styles.signIn}`}>Sign in</Link>;
  const name = profile?.display_name || user.email || "Account";
  return (
    <details className={styles.account} ref={menu}>
      <summary className={styles.summary} aria-label={`Account menu for ${name}`}>
        <span className={styles.avatar} aria-hidden="true">{initials(name) || "?"}</span>
        <span className={styles.who}>{name}</span>
      </summary>
      <div className={styles.menu} role="menu">
        <div className={styles.email}>{user.email}</div>
        <Link role="menuitem" href="/my-activity" onClick={close}>My ratings &amp; feedback</Link>
        <Link role="menuitem" href="/welcome" onClick={close}>Edit my playbook</Link>
        <Link role="menuitem" href="/membership" onClick={close}>Membership</Link>
        <Link role="menuitem" href="/account" onClick={close}>Account settings</Link>
        {isAdmin && <Link role="menuitem" href="/admin" onClick={close}>Coach&apos;s office (admin)</Link>}
        <button role="menuitem" type="button" onClick={() => { close(); signOut(); }}>Sign out</button>
      </div>
    </details>
  );
}
