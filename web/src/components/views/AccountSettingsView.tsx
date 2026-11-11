"use client";

import Link from "next/link";
import { useState } from "react";
import { loadBrowserSupabase } from "@/lib/supabase/browser";
import { friendly } from "@/lib/errors";
import { useAccount } from "../AccountProvider";
import styles from "./AccountSettingsView.module.css";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Account settings: change your sign-in email (confirmed from both the old and new address). */
export default function AccountSettingsView() {
  const { configured, ready, user } = useAccount();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");

  const pending = sentTo || user?.new_email || "";

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const next = email.trim().toLowerCase();
    if (!EMAIL.test(next)) { setError("Enter a full email address, like name@school.org."); return; }
    if (next === user?.email?.toLowerCase()) { setError("That's already your email."); return; }
    setBusy(true);
    const supabase = await loadBrowserSupabase();
    if (!supabase) { setBusy(false); return; }
    const { error: err } = await supabase.auth.updateUser(
      { email: next },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=/account` },
    );
    setBusy(false);
    if (err) { setError(friendly(err, "change your email")); return; }
    setSentTo(next);
    setEmail("");
  };

  return (
    <section className={`panel ${styles.wrap}`} aria-labelledby="accountTitle">
      <h2 id="accountTitle">Account settings</h2>
      {!configured ? (
        <p className="muted">Accounts switch on once Stone Arch connects the database.</p>
      ) : !ready ? null : !user ? (
        <div className="row-actions"><Link className="btn primary" href="/sign-in">Sign in to see your account</Link></div>
      ) : (
        <>
          <div className={styles.current}>
            <span className="label">Your email</span>
            <b>{user.email}</b>
          </div>

          {pending && (
            <div className={styles.notice} role="status">
              <b>Check both inboxes.</b> We sent a confirmation link to <b>{user.email}</b> and to <b>{pending}</b>. Your email changes after you click both links.
            </div>
          )}

          <form className={styles.form} onSubmit={change} noValidate>
            <h3>Change your email</h3>
            <div className="field">
              <label htmlFor="newEmail">New email address</label>
              <input id="newEmail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby="emailHint emailErr" />
              <span id="emailHint" className="hint">For your safety, we&apos;ll email a link to your current address and the new one. Nothing changes until you confirm both.</span>
            </div>
            <p id="emailErr" className="form-err" role="alert">{error}</p>
            <div className="row-actions"><button type="submit" className="btn primary" disabled={busy}>{busy ? "Sending…" : "Send confirmation links"}</button></div>
          </form>
        </>
      )}
    </section>
  );
}
