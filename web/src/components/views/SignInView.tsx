"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { loadBrowserSupabase } from "@/lib/supabase/browser";
import { useAccount } from "../AccountProvider";
import styles from "./SignInView.module.css";

/** Shown when an expired or broken sign-in link sends people back here with ?error=link.
 *  Reading the address is kept in this small piece so the rest of the page can be prerendered. */
function LinkError() {
  if (useSearchParams().get("error") !== "link") return null;
  return <p className="form-err" role="alert">That sign-in link didn&apos;t work or has expired. Request a new one below.</p>;
}

/** Sign in or create an account: a one-time email link, or Google / Microsoft. */
export default function SignInView() {
  const { configured, user, profile, signOut } = useAccount();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const callback = () => `${location.origin}/auth/callback`;

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    const supabase = await loadBrowserSupabase();
    if (!supabase) { setBusy(false); return; }
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callback() } });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  };
  const withProvider = async (provider: "google" | "azure") => {
    setError("");
    const supabase = await loadBrowserSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callback(), scopes: provider === "azure" ? "email" : undefined } });
    if (error) setError(error.message);
  };

  return (
    <section className="panel" aria-labelledby="signInTitle">
      <h2 id="signInTitle">Join the team</h2>
      {!configured ? (
        <p className="muted">Sign-in isn&apos;t switched on yet. Once Stone Arch connects the Supabase database, you&apos;ll be able to create an account here. You can still <Link href="/welcome">personalize your playbook</Link> on this device.</p>
      ) : user ? (
        <>
          <p>You&apos;re signed in as <b>{profile?.email ?? user.email}</b>.</p>
          <div className="row-actions">
            <Link className="btn primary" href={profile?.onboarded_at ? "/" : "/welcome"}>{profile?.onboarded_at ? "Go to your playbook" : "Set up your playbook"}</Link>
            <button type="button" className="btn ghost" onClick={signOut}>Sign out</button>
          </div>
        </>
      ) : sent ? (
        <div className="review-box" role="status"><b>Check your email</b>We sent a sign-in link to {email.trim()}. Open it on this device to finish signing in. It expires in one hour.</div>
      ) : (
        <>
          <p className="muted">Create a free account or sign in. Free accounts can rate tools and save their playbook. No password needed. We&apos;ll email you a new sign-in link whenever you need one.</p>
          <div className={styles.oauth}>
            <button type="button" className="btn" onClick={() => withProvider("google")}>Continue with Google</button>
            <button type="button" className="btn" onClick={() => withProvider("azure")}>Continue with Microsoft</button>
          </div>
          <div className={styles.or}><span>or use your email</span></div>
          <form onSubmit={sendLink} className={`field ${styles.form}`}>
            <label htmlFor="email">School or work email</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.org" />
            <button type="submit" className="btn primary" disabled={busy}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
          </form>
          <p className="fine">For school staff 18 and older. Never include student information in your account or feedback.</p>
        </>
      )}
      {configured && !user && !sent && <Suspense fallback={null}><LinkError /></Suspense>}
      {error && <p className="form-err" role="alert">{error}</p>}
    </section>
  );
}
