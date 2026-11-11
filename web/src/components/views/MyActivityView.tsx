"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadBrowserSupabase } from "@/lib/supabase/browser";
import { fmtDate } from "@/lib/text";
import { friendly } from "@/lib/errors";
import { useAccount } from "../AccountProvider";
import { useCommunity } from "../CommunityProvider";
import { usePlaybook } from "../PlaybookProvider";
import styles from "./MyActivityView.module.css";

// The signed-in person's own history: every star rating, every piece of feedback (with its review
// status) and the membership days it earned. Row-level security returns only their own rows.

type Rating = { tool_id: string; stars: number; updated_at: string };
type Sent = { id: string; tool_id: string; kind: "text" | "voice"; body: string; status: "pending" | "approved" | "declined"; admin_note: string | null; created_at: string; audio_path: string | null };
type Credit = { feedback_id: string | null; days: number };
type History = { ratings: Rating[]; feedback: Sent[]; credits: Credit[] };

const STATUS = { pending: "Waiting for review", approved: "Approved", declined: "Not approved" };
const day = (iso: string) => fmtDate(iso.slice(0, 10));

export default function MyActivityView() {
  const { configured, ready, user } = useAccount();
  const { toolById, openTool } = usePlaybook();
  const { mine } = useCommunity(); // live stars, so a rating changed in the scouting report shows here right away
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState("");

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = await loadBrowserSupabase();
      if (!supabase || cancelled) return;
      const [r, f, c] = await Promise.all([
        supabase.from("ratings").select("tool_id, stars, updated_at").eq("user_id", userId).order("updated_at", { ascending: false }),
        supabase.from("feedback").select("id, tool_id, kind, body, status, admin_note, created_at, audio_path").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("membership_credits").select("feedback_id, days").eq("user_id", userId),
      ]);
      if (cancelled) return;
      if (r.error || f.error || c.error) { console.warn("Loading history:", (r.error ?? f.error ?? c.error)?.message); setError("We couldn't load your history. Please refresh the page to try again."); return; }
      setHistory({ ratings: r.data as Rating[], feedback: f.data as Sent[], credits: c.data as Credit[] });
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Delete your own recording early; the written text stays.
  const removeRecording = async (id: string) => {
    if (!window.confirm("Delete this recording? Your written feedback stays. This can't be undone.")) return;
    const supabase = await loadBrowserSupabase();
    if (!supabase) return;
    const { data: path, error: err } = await supabase.rpc("remove_my_recording", { p_feedback: id });
    if (err) { setError(friendly(err, "delete your recording")); return; }
    if (path) await supabase.storage.from("voice-feedback").remove([path as string]);
    setHistory((h) => h && { ...h, feedback: h.feedback.map((f) => (f.id === id ? { ...f, audio_path: null } : f)) });
  };

  const toolName = (id: string) => toolById[id]?.name ?? id;
  const earned = (id: string) => history?.credits.find((c) => c.feedback_id === id)?.days ?? 0;
  const totalDays = history?.credits.reduce((n, c) => n + c.days, 0) ?? 0;

  if (!configured) return <section className="panel"><h2>My ratings &amp; feedback</h2><p className="muted">This switches on once Stone Arch connects the database.</p></section>;
  if (!ready) return <section className="panel"><p className="muted">Checking your account…</p></section>;
  if (!user) return <section className="panel"><h2>My ratings &amp; feedback</h2><p>Please <Link href="/sign-in">sign in</Link> to see the ratings and feedback you&apos;ve given.</p></section>;

  return (
    <section aria-labelledby="historyTitle" className={styles.wrap}>
      <h2 id="historyTitle" className={styles.title}>My ratings &amp; feedback</h2>
      <p className="muted">Everything you&apos;ve rated and sent. Only you (and, for feedback, the admins who review it) can see this.</p>
      {error && <p className="form-err" role="alert">{error}</p>}
      {!history && !error && <p className="muted">Loading…</p>}
      {history && (
        <>
          <div className={styles.stats}>
            <div><b>{history.ratings.length}</b>tools rated</div>
            <div><b>{history.feedback.length}</b>feedback sent</div>
            <div><b>{history.feedback.filter((f) => f.status === "approved").length}</b>approved</div>
            <div><b>{totalDays}</b>membership days earned</div>
          </div>

          <h3 className={styles.heading}>Ratings</h3>
          {history.ratings.length ? (
            <ul className={styles.list}>
              {history.ratings.map(({ tool_id, updated_at, stars: saved }) => ({ tool_id, updated_at, stars: mine[tool_id] ?? saved })).map((r) => (
                <li key={r.tool_id} className={styles.item}>
                  <button type="button" className={styles.tool} onClick={() => openTool(r.tool_id)}>{toolName(r.tool_id)}</button>
                  <span className={styles.stars} aria-label={`${r.stars} of 5 stars`}>{"★".repeat(r.stars)}<span className={styles.off}>{"★".repeat(5 - r.stars)}</span></span>
                  <span className={styles.date}>{day(r.updated_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty"><h3>No ratings yet</h3><p className="muted">Open any tool&apos;s scouting report on <Link href="/">The Roster</Link> and tap a star.</p></div>
          )}

          <h3 className={styles.heading}>Feedback</h3>
          {history.feedback.length ? (
            <ul className={styles.list}>
              {history.feedback.map((f) => (
                <li key={f.id} className={`${styles.item} ${styles.feedback}`}>
                  <div className={styles.row}>
                    <button type="button" className={styles.tool} onClick={() => openTool(f.tool_id)}>{toolName(f.tool_id)}</button>
                    <span className={`status ${f.status}`}>{STATUS[f.status]}</span>
                    {f.kind === "voice" && <span className="pill">Voice</span>}
                    {earned(f.id) > 0 && <span className="pill strong">+{earned(f.id)} days</span>}
                    <span className={styles.date}>{day(f.created_at)}</span>
                  </div>
                  <p className={styles.body}>{f.body}</p>
                  {f.status === "declined" && f.admin_note && <p className={styles.note}><b>Note from the reviewer:</b> {f.admin_note}</p>}
                  {f.audio_path && (
                    <div className="row-actions"><button type="button" className="btn small ghost" onClick={() => removeRecording(f.id)}>Delete my recording</button><span className="fine">Deleted automatically after 30 days.</span></div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty"><h3>No feedback yet</h3><p className="muted">Share how a tool worked for you from its scouting report. Approved feedback earns membership days.</p></div>
          )}
        </>
      )}
    </section>
  );
}
