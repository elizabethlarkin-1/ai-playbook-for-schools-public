"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Tool } from "@/lib/types";
import { fmtDate } from "@/lib/text";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { useAccount } from "./AccountProvider";
import { useCommunity } from "./CommunityProvider";
import { friendly } from "@/lib/errors";
import { sessionUserId } from "@/lib/session";
import styles from "./Feedback.module.css";

// Star ratings and feedback for one tool: the summary on cards, the rating control and the
// written/voice feedback form in the scouting report.

/** "★ 4.3 · 12 ratings" for a card. */
export function StarsSummary({ toolId }: { toolId: string }) {
  const { stats, available } = useCommunity();
  if (!available) return null;
  const s = stats[toolId];
  if (!s || !s.count) return <span className={`muted ${styles.summary}`}>No ratings yet</span>;
  return (
    <span className={styles.summary} tabIndex={0} data-tip={`Average of ${s.count} educator rating${s.count === 1 ? "" : "s"}${s.feedback ? ` · ${s.feedback} approved review${s.feedback === 1 ? "" : "s"}` : ""}. Rankings blend these with our editorial review.`}>
      <span className={styles.star} aria-hidden="true">★</span> <b className="num">{s.avg?.toFixed(1)}</b> · {s.count} rating{s.count === 1 ? "" : "s"}
    </span>
  );
}

/** Five star buttons for the signed-in reader's own rating. */
function RateStars({ tool }: { tool: Tool }) {
  const { mine, rate } = useCommunity();
  const [hover, setHover] = useState(0);
  const [error, setError] = useState("");
  const current = mine[tool.id] ?? 0;
  const shown = hover || current;
  const words = ["", "Not useful", "Some use", "Useful", "Very useful", "Game changer"];
  return (
    <div className={styles.rate}>
      <div className={styles.stars} role="radiogroup" aria-label={`Your rating for ${tool.name}`} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={current === n} aria-label={`${n} star${n === 1 ? "" : "s"}: ${words[n]}`}
            className={n <= shown ? styles.on : ""} onMouseEnter={() => setHover(n)}
            onClick={() => { setError(""); rate(tool.id, n).catch((e) => setError(e.message)); }}>★</button>
        ))}
      </div>
      <span className="muted">{shown ? words[shown] : "Tap a star to rate"}{current > 0 && !hover && " · saved"}</span>
      {error && <span className="form-err" role="alert">{error}</span>}
    </div>
  );
}

type Approved = { id: string; body: string; kind: string; role_label: string | null; created_at: string };
type Mine = { id: string; status: string; created_at: string; admin_note: string | null };

/** The scouting report's "Ratings & feedback" section. */
export function FeedbackSection({ tool }: { tool: Tool }) {
  const { configured, user } = useAccount();
  const { stats, rewardDays, refresh } = useCommunity();
  const supabase = useBrowserSupabase();
  const [approved, setApproved] = useState<Approved[]>([]);
  const [mine, setMine] = useState<Mine[]>([]);
  const [writing, setWriting] = useState(false);
  const [version, setVersion] = useState(0);

  const userId = user?.id;
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const [a, m] = await Promise.all([
        supabase.rpc("approved_feedback", { p_tool: tool.id }),
        userId ? supabase.from("feedback").select("id, status, created_at, admin_note").eq("tool_id", tool.id).eq("user_id", userId).order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as Mine[] }),
      ]);
      if (cancelled) return;
      setApproved((a.data as Approved[]) ?? []);
      setMine((m.data as Mine[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [supabase, userId, tool.id, version]);

  if (!configured) return null;
  const s = stats[tool.id];
  return (
    <div className={styles.section}>
      <span className="label">Ratings &amp; feedback</span>
      <p>{s?.count ? <><span className={styles.star}>★</span> <b>{s.avg?.toFixed(1)}</b> average from {s.count} educator{s.count === 1 ? "" : "s"}</> : "No ratings yet. Be the first."}</p>
      {user ? <RateStars tool={tool} /> : <p><Link href="/sign-in">Sign in</Link> (free) to rate this tool and share feedback.</p>}

      {user && mine.length > 0 && (
        <ul className={styles.mine}>
          {mine.map((f) => (
            <li key={f.id}>
              <span className={`status ${f.status}`}>{{ pending: "Waiting for review", approved: "Approved", declined: "Not approved" }[f.status]}</span>
              {" "}Your feedback from {fmtDate(f.created_at.slice(0, 10))}{f.admin_note && f.status === "declined" ? `: ${f.admin_note}` : ""}
            </li>
          ))}
        </ul>
      )}
      {user && !writing && (
        <button type="button" className="btn small primary" onClick={() => setWriting(true)}>Give feedback{rewardDays > 0 ? `, earn ${rewardDays} days` : ""}</button>
      )}
      {user && writing && (
        <FeedbackForm tool={tool} onDone={() => { setWriting(false); setVersion((v) => v + 1); refresh(); }} onCancel={() => setWriting(false)} />
      )}

      {approved.length > 0 && (
        <div className={styles.quotes}>
          <span className="label">What educators say</span>
          {approved.map((q) => (
            <blockquote key={q.id}>
              <p>{q.body}</p>
              <footer>{q.role_label ?? "Educator"} · {fmtDate(q.created_at.slice(0, 10))}{q.kind === "voice" ? " · spoken feedback" : ""}</footer>
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}

type SpeechRec = { continuous: boolean; interimResults: boolean; lang: string; start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null };
const speechApi = (): (new () => SpeechRec) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Write or say your feedback. Speaking records audio and, where the browser supports it, types what you say. */
function FeedbackForm({ tool, onDone, onCancel }: { tool: Tool; onDone: () => void; onCancel: () => void }) {
  const { user, profile } = useAccount();
  const { rewardDays } = useCommunity();
  const supabase = useBrowserSupabase();
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [body, setBody] = useState("");
  const [shareName, setShareName] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const speech = useRef<SpeechRec | null>(null);
  const canTranscribe = !!speechApi();
  const audioUrl = useMemo(() => (audio ? URL.createObjectURL(audio) : ""), [audio]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); setAudio(new Blob(chunks, { type: rec.mimeType || "audio/webm" })); };
      rec.start(); recorder.current = rec;
      const Speech = speechApi();
      if (Speech) {
        const s = new Speech(); s.continuous = true; s.interimResults = false; s.lang = "en-US";
        s.onresult = (e) => {
          let text = "";
          for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
          if (text) setBody((b) => (b ? b.trimEnd() + " " : "") + text.trim());
        };
        s.start(); speech.current = s;
      }
      setRecording(true);
    } catch {
      setError("We couldn't use your microphone. Check your browser's microphone permission, or write your feedback instead.");
    }
  };
  const stop = () => { recorder.current?.stop(); speech.current?.stop(); setRecording(false); };
  // Stop the microphone if the form closes mid-recording.
  useEffect(() => () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    speech.current?.stop();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user) return;
    const text = body.trim();
    if (text.length < 20) { setError(mode === "voice" ? "Add at least a sentence of text (type what you said if it wasn't transcribed)." : "Write at least a sentence or two (20 characters)."); return; }
    setBusy(true); setError("");
    let uid: string;
    try { uid = await sessionUserId(supabase); } catch (e) { setError((e as Error).message); setBusy(false); return; }
    let audioPath: string | null = null;
    if (mode === "voice" && audio) {
      const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
      audioPath = `${uid}/${tool.id}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("voice-feedback").upload(audioPath, audio, { contentType: audio.type.split(";")[0] });
      if (up.error) { setError(friendly(up.error, "upload your recording")); setBusy(false); return; }
    }
    const { error } = await supabase.from("feedback").insert({
      user_id: uid, tool_id: tool.id, kind: audioPath ? "voice" : "text", body: text, audio_path: audioPath, role_id: profile?.role_id ?? null, share_name: shareName,
    });
    setBusy(false);
    if (error) setError(friendly(error, "send your feedback")); else onDone();
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className="seg" role="group" aria-label="How do you want to give feedback?">
        <button type="button" aria-pressed={mode === "text"} onClick={() => setMode("text")}>Write it</button>
        <button type="button" aria-pressed={mode === "voice"} onClick={() => setMode("voice")}>Say it</button>
      </div>
      <div className="guard"><b>No student info</b><span>Leave out student names, ID numbers, grades and anything that could identify a student or colleague.</span></div>
      {mode === "voice" && (
        <div className={styles.recorder}>
          {!recording
            ? <button type="button" className="btn" onClick={start}><span className={styles.recDot} aria-hidden="true" />{audio ? "Record again" : "Start recording"}</button>
            : <button type="button" className="btn primary" onClick={stop}><span className={`${styles.recDot} ${styles.live}`} aria-hidden="true" />Stop recording</button>}
          {audioUrl && !recording && <audio controls src={audioUrl} />}
          <p className="fine">{canTranscribe ? "What you say is typed below so you can check it." : "Your browser can't type what you say, so add a short written version below."} Only the written version is ever posted. Your recording lets our team check it before approving, then it&apos;s deleted after 30 days (or sooner, from My ratings &amp; feedback).{canTranscribe && " Your browser's speech-to-text may send audio to its maker (in Chrome, Google) to type it."}</p>
        </div>
      )}
      <label className="sr" htmlFor={`fb-${tool.id}`}>Your feedback</label>
      <textarea id={`fb-${tool.id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={4000}
        placeholder={`How has ${tool.name} worked for you? What do you use it for, and what would you tell a colleague?`} />
      <label className={styles.check}><input type="checkbox" checked={shareName} onChange={(e) => setShareName(e.target.checked)} /> OK to share my name and role with {tool.company} (otherwise they only see it without your name)</label>
      {error && <p className="form-err" role="alert">{error}</p>}
      <div className="row-actions">
        <button type="submit" className="btn primary" disabled={busy || recording}>{busy ? "Sending…" : "Send feedback"}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
      <p className="fine">An admin reviews feedback before it appears{rewardDays > 0 ? `; approved feedback earns ${rewardDays} days of membership` : ""}.</p>
    </form>
  );
}
