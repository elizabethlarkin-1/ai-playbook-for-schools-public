"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount } from "../AccountProvider";
import { usePlaybook } from "../PlaybookProvider";
import styles from "./WelcomeView.module.css";

// The step-through setup: role → subjects (teachers only) → the school systems you use.
// The answers personalize the roster; every other filter stays available.

export const SYSTEM_GROUPS: { label: string; hint: string; items: string[] }[] = [
  { label: "Email & documents", hint: "Your school's main accounts", items: ["Google Workspace", "Microsoft 365"] },
  { label: "Learning platform (LMS)", hint: "Where classes and assignments live", items: ["Google Classroom", "Canvas", "Schoology", "Microsoft Teams", "Brightspace", "Blackboard", "Moodle"] },
  { label: "Student information system (SIS)", hint: "Attendance, schedules and report cards", items: ["Infinite Campus", "PowerSchool", "Skyward", "Aeries", "Synergy", "Aspen"] },
  { label: "Sign-in & rostering", hint: "How students and staff log in to apps", items: ["Clever", "ClassLink"] },
];

// Waits for the account to load so saved answers pre-fill the steps.
export default function WelcomeView() {
  const { ready, prefs } = useAccount();
  if (!ready) return <section className={`panel ${styles.wizard}`}><p className="muted">Loading your playbook…</p></section>;
  return <WelcomeSteps key={prefs ? "saved" : "new"} />;
}

function WelcomeSteps() {
  const router = useRouter();
  const { content } = usePlaybook();
  const { prefs, savePrefs, user, configured } = useAccount();
  const [role, setRole] = useState(prefs?.role ?? "");
  const [subjects, setSubjects] = useState<string[]>(prefs?.subjects ?? []);
  const [systems, setSystems] = useState<string[]>(prefs?.systems ?? []);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const steps = role === "teacher" ? ["role", "subjects", "systems"] : ["role", "systems"];
  const current = steps[step];
  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, v: string) =>
    set((list) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]));

  const finish = async () => {
    setSaving(true); setError("");
    try {
      await savePrefs({ role, subjects: role === "teacher" ? subjects : [], systems });
      router.push("/");
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <section className={`panel ${styles.wizard}`} aria-labelledby="wizTitle">
      <ol className={styles.steps} aria-label="Setup progress">
        {steps.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={i < step ? styles.done : ""}>
            {{ role: "Your role", subjects: "Subjects", systems: "School systems" }[s]}
          </li>
        ))}
      </ol>

      {current === "role" && (
        <>
          <h2 id="wizTitle">What&apos;s your position on the team?</h2>
          <p className="muted">We&apos;ll put the tools and plays that fit your role first. You can still see everything.</p>
          <div className="goals">
            {content.roles.map((r) => (
              <button key={r.id} type="button" className="goal" aria-pressed={role === r.id} onClick={() => setRole(r.id)}>
                <b>{r.label}</b><span>{r.hint}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {current === "subjects" && (
        <>
          <h2 id="wizTitle">What do you teach?</h2>
          <p className="muted">Pick all that apply.</p>
          <div className="chips">
            {content.subjects.map((s) => (
              <button key={s.id} type="button" className="chip" aria-pressed={subjects.includes(s.id)} onClick={() => toggle(setSubjects, s.id)}>{s.label}</button>
            ))}
          </div>
        </>
      )}

      {current === "systems" && (
        <>
          <h2 id="wizTitle">Which systems does your school use?</h2>
          <p className="muted">Tools that connect to these show first, with a &ldquo;works with yours&rdquo; tag. Not sure? Skip it; you can change this anytime.</p>
          <div className={styles.groups}>
            {SYSTEM_GROUPS.map((g) => (
              <fieldset key={g.label}>
                <legend><b>{g.label}</b> <span className="muted">{g.hint}</span></legend>
                <div className="chips">
                  {g.items.map((n) => <button key={n} type="button" className="chip" aria-pressed={systems.includes(n)} onClick={() => toggle(setSystems, n)}>{n}</button>)}
                </div>
              </fieldset>
            ))}
          </div>
        </>
      )}

      <div className={styles.actions}>
        {step > 0 && <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>Back</button>}
        <span className={styles.spacer} />
        {step < steps.length - 1
          ? <button type="button" className="btn primary" disabled={!role} onClick={() => setStep(step + 1)}>Next</button>
          : <button type="button" className="btn primary" disabled={saving || !role} onClick={finish}>{saving ? "Saving…" : "Show my playbook"}</button>}
      </div>
      {error && <p className="form-err" role="alert">{error}</p>}
      {configured && !user && (
        <p className="fine">Your answers are saved on this device. <Link href="/sign-in">Create a free account</Link> to keep them everywhere and rate tools.</p>
      )}
    </section>
  );
}
