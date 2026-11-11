"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { fmtDate } from "@/lib/text";
import { useAccount, type Profile } from "../AccountProvider";
import { usePlaybook } from "../PlaybookProvider";
import { FeedbackQueue, RewardSettings } from "../AdminFeedback";
import styles from "./AdminView.module.css";

// Admin home. The database only returns everyone's profiles to admins, so this page can't leak
// data even if someone opens it directly. Phase 3 adds feedback approvals; Phase 4 adds settings.

export default function AdminView() {
  const { configured, ready, user, isAdmin } = useAccount();
  const { roleById } = usePlaybook();
  const supabase = useBrowserSupabase();
  const [people, setPeople] = useState<Profile[]>([]);
  const [admins, setAdmins] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"feedback" | "people" | "settings">("feedback");
  const [pending, setPending] = useState(0);
  const onCount = useCallback((n: number) => setPending(n), []);

  // Bumped after an admin change to re-fetch the lists.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!isAdmin || !supabase) return;
    let cancelled = false;
    (async () => {
      const [p, a] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("admins").select("user_id"),
      ]);
      if (cancelled) return;
      if (p.error || a.error) { setError((p.error ?? a.error)!.message); return; }
      setPeople(p.data as Profile[]);
      setAdmins((a.data as { user_id: string }[]).map((x) => x.user_id));
    })();
    return () => { cancelled = true; };
  }, [isAdmin, supabase, version]);

  const setAdmin = async (id: string, make: boolean) => {
    if (!supabase) return;
    setError("");
    const { error } = await supabase.rpc("set_admin", { target: id, make });
    if (error) setError(error.message); else setVersion((v) => v + 1);
  };

  if (!configured) return <section className="panel"><h2>Admin</h2><p className="muted">The admin area turns on once Stone Arch connects the Supabase database.</p></section>;
  if (!ready) return <section className="panel"><p className="muted">Checking your account…</p></section>;
  if (!user) return <section className="panel"><h2>Admin</h2><p>Please <Link href="/sign-in">sign in</Link> with an admin account.</p></section>;
  if (!isAdmin) return <section className="panel"><h2>Admins only</h2><p className="muted">Your account isn&apos;t an admin. Ask a current admin to add you.</p></section>;

  const onboarded = people.filter((p) => p.onboarded_at);
  const byRole = Object.values(roleById).map((r) => ({ r, n: onboarded.filter((p) => p.role_id === r.id).length }));

  return (
    <section aria-labelledby="adminTitle" className={styles.admin}>
      <h2 id="adminTitle">Coach&apos;s office</h2>
      <p className="muted">Review feedback, see who&apos;s signed up, and set rewards. Membership prices arrive in Phase 4.</p>
      <div className={`seg ${styles.tabs}`} role="group" aria-label="Admin sections">
        <button type="button" aria-pressed={tab === "feedback"} onClick={() => setTab("feedback")}>Feedback{pending > 0 && <span className="count hot">{pending}</span>}</button>
        <button type="button" aria-pressed={tab === "people"} onClick={() => setTab("people")}>People</button>
        <button type="button" aria-pressed={tab === "settings"} onClick={() => setTab("settings")}>Settings</button>
      </div>
      {tab === "feedback" && <FeedbackQueue onCount={onCount} />}
      {tab === "settings" && <RewardSettings />}
      {tab === "people" && <>
      <div className={styles.stats}>
        <div><b className={styles.num}>{people.length}</b>accounts</div>
        <div><b className={styles.num}>{onboarded.length}</b>finished setup</div>
        {byRole.map(({ r, n }) => <div key={r.id}><b className={styles.num}>{n}</b>{r.label}</div>)}
      </div>
      {error && <p className="form-err" role="alert">{error}</p>}
      <div className="table-wrap">
        <table className={styles.people}>
          <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">School systems</th><th scope="col">Joined</th><th scope="col">Admin</th></tr></thead>
          <tbody>
            {people.map((p) => {
              const admin = admins.includes(p.id);
              return (
                <tr key={p.id}>
                  <td className={styles.name}>{p.display_name || "—"}</td>
                  <td>{p.email}</td>
                  <td>{p.role_id ? roleById[p.role_id]?.label : <span className="muted">Not set up</span>}</td>
                  <td>{p.systems.length ? p.systems.join(", ") : <span className="muted">—</span>}</td>
                  <td className={styles.num}>{fmtDate(p.created_at.slice(0, 10))}</td>
                  <td>
                    {admin && <span className="pill strong">Admin</span>}{" "}
                    {p.id !== user.id && (
                      <button type="button" className="btn small ghost" onClick={() => setAdmin(p.id, !admin)}>{admin ? "Remove admin" : "Make admin"}</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>}
    </section>
  );
}
