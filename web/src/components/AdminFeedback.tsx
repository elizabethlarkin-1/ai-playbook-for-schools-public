"use client";

import { useEffect, useState } from "react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { fmtDate } from "@/lib/text";
import { useCommunity } from "./CommunityProvider";
import { usePlaybook } from "./PlaybookProvider";
import styles from "./AdminFeedback.module.css";

// Admin: review feedback (approve or decline with a note) and edit the reward settings.

type Item = {
  id: string; tool_id: string; kind: "text" | "voice"; body: string; audio_path: string | null; role_id: string | null;
  share_name: boolean; status: string; created_at: string; admin_note: string | null; original_body: string | null;
};

export function FeedbackQueue({ onCount }: { onCount: (n: number) => void }) {
  const supabase = useBrowserSupabase();
  const { toolById, roleById } = usePlaybook();
  const { refresh } = useCommunity();
  const [show, setShow] = useState<"pending" | "approved" | "declined">("pending");
  const [items, setItems] = useState<Item[]>([]);
  const [audio, setAudio] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, string>>({}); // corrected transcripts, by feedback id
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const [list, pending] = await Promise.all([
        supabase.from("feedback").select("*").eq("status", show).order("created_at", { ascending: show === "pending" }).limit(100),
        supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      if (cancelled) return;
      if (list.error) { setError(list.error.message); return; }
      const rows = list.data as Item[];
      setItems(rows);
      onCount(pending.count ?? 0);
      // Short-lived links so admins can listen to voice feedback in the private bucket.
      const paths = rows.map((r) => r.audio_path).filter((p): p is string => !!p);
      if (paths.length) {
        const { data } = await supabase.storage.from("voice-feedback").createSignedUrls(paths, 3600);
        if (!cancelled && data) setAudio(Object.fromEntries(data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : []))));
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, show, version, onCount]);

  const review = async (id: string, status: "approved" | "declined") => {
    if (!supabase) return;
    setError("");
    const corrected = edits[id]?.trim();
    const original = items.find((x) => x.id === id)?.body;
    if (corrected !== undefined && corrected.length < 20) { setError("The transcript needs at least a sentence (20 characters)."); return; }
    const change = { status, admin_note: notes[id]?.trim() || null, ...(corrected && corrected !== original ? { body: corrected } : {}) };
    const { error } = await supabase.from("feedback").update(change).eq("id", id);
    if (error) { setError(error.message); return; }
    setVersion((v) => v + 1);
    refresh();
  };

  return (
    <div className={styles.queue}>
      <div className="seg" role="group" aria-label="Which feedback">
        {(["pending", "approved", "declined"] as const).map((s) => (
          <button key={s} type="button" aria-pressed={show === s} onClick={() => setShow(s)}>{{ pending: "Waiting", approved: "Approved", declined: "Declined" }[s]}</button>
        ))}
      </div>
      {error && <p className="form-err" role="alert">{error}</p>}
      {!items.length && <div className="empty"><h3>{show === "pending" ? "All caught up" : "Nothing here yet"}</h3><p className="muted">{show === "pending" ? "New feedback shows up here for review." : "Reviewed feedback is listed here."}</p></div>}
      {items.map((f) => (
        <article key={f.id} className={styles.item}>
          <h3>{toolById[f.tool_id]?.name ?? f.tool_id}</h3>
          <div className={styles.meta}>
            {f.role_id ? roleById[f.role_id]?.label : "Role not set"} · {fmtDate(f.created_at.slice(0, 10))} · {f.kind === "voice" ? "Spoken" : "Written"}
            {f.share_name && <> · <b>OK to share name with the tool maker</b></>}
          </div>
          {show === "pending" && edits[f.id] !== undefined ? (
            <div className="field">
              <label htmlFor={`edit-${f.id}`}>Corrected transcript (listen and fix any mistakes; their original words are kept)</label>
              <textarea id={`edit-${f.id}`} rows={5} maxLength={4000} value={edits[f.id]} onChange={(e) => setEdits({ ...edits, [f.id]: e.target.value })} />
            </div>
          ) : <p className={styles.body}>{f.body}</p>}
          {f.original_body && f.original_body !== f.body && (
            <details className={styles.original}><summary>Original words (before an admin&apos;s correction)</summary><p>{f.original_body}</p></details>
          )}
          {f.audio_path && audio[f.audio_path] && <audio controls src={audio[f.audio_path]} />}
          {f.audio_path && !audio[f.audio_path] && f.kind === "voice" && <p className="fine">Recording no longer available (deleted after 30 days).</p>}
          {show === "pending" ? (
            <>
              <p className="fine">Approve only if it has no student or personal information and reflects real use. Approval gives the person their membership days.</p>
              <label className="sr" htmlFor={`note-${f.id}`}>Note to the person (optional)</label>
              <input id={`note-${f.id}`} className={styles.note} placeholder="Optional note, e.g. why it wasn't approved" value={notes[f.id] ?? ""} onChange={(e) => setNotes({ ...notes, [f.id]: e.target.value })} />
              <div className="row-actions">
                {edits[f.id] === undefined
                  ? <button type="button" className="btn small" onClick={() => setEdits({ ...edits, [f.id]: f.body })}>Edit transcript</button>
                  : <button type="button" className="btn small ghost" onClick={() => { const next = { ...edits }; delete next[f.id]; setEdits(next); }}>Cancel edit</button>}
              </div>
              <div className="row-actions">
                <button type="button" className="btn primary" onClick={() => review(f.id, "approved")}>{edits[f.id] !== undefined ? "Save and approve" : "Approve"}</button>
                <button type="button" className="btn ghost" onClick={() => review(f.id, "declined")}>Decline</button>
              </div>
            </>
          ) : f.admin_note && <p className="fine">Note: {f.admin_note}</p>}
        </article>
      ))}
    </div>
  );
}

export function RewardSettings() {
  const supabase = useBrowserSupabase();
  const { refresh } = useCommunity();
  const [days, setDays] = useState("");
  const [limit, setLimit] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("app_settings").select("key, value").in("key", ["feedback_reward_days", "feedback_reward_monthly_limit"]);
      if (cancelled || !data) return;
      const get = (k: string) => data.find((d) => d.key === k)?.value;
      setDays(String(get("feedback_reward_days") ?? 30));
      const l = get("feedback_reward_monthly_limit");
      setLimit(l == null || l === "null" ? "" : String(l));
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const d = Math.max(0, Math.round(Number(days) || 0));
    const l = limit.trim() === "" ? null : Math.max(0, Math.round(Number(limit) || 0));
    const { error } = await supabase.from("app_settings").upsert([
      { key: "feedback_reward_days", value: d },
      // The column can't hold SQL null, so "no limit" is stored as the JSON string "null".
      { key: "feedback_reward_monthly_limit", value: l ?? "null" },
    ]);
    setSaved(error ? `Couldn't save: ${error.message}` : "Saved. New approvals use these settings.");
    if (!error) refresh();
  };

  return (
    <form className={styles.settings} onSubmit={save}>
      <div className="field">
        <label htmlFor="rewardDays">Membership days earned per approved feedback</label>
        <input id="rewardDays" type="number" min="0" max="365" value={days} onChange={(e) => { setDays(e.target.value); setSaved(""); }} />
        <span className="hint">Set to 0 to stop rewarding feedback. Applies to feedback approved after you save.</span>
      </div>
      <div className="field">
        <label htmlFor="rewardLimit">Most rewarded feedback per person per month</label>
        <input id="rewardLimit" type="number" min="0" max="31" value={limit} placeholder="No limit" onChange={(e) => { setLimit(e.target.value); setSaved(""); }} />
        <span className="hint">Leave empty for no limit.</span>
      </div>
      <div className="row-actions"><button type="submit" className="btn primary">Save settings</button>{saved && <span role="status" className="muted">{saved}</span>}</div>
      <p className="fine">Membership prices arrive with Phase 4.</p>
    </form>
  );
}
