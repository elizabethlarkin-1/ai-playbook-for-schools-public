"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadBrowserSupabase } from "@/lib/supabase/browser";
import { fmtDate } from "@/lib/text";
import { useAccount } from "../AccountProvider";
import styles from "./MembershipView.module.css";

type Prices = { monthly: string; yearly: string; rewardDays: number };
const day = (iso: string | null) => (iso ? fmtDate(iso.slice(0, 10)) : "");
const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

/** Membership: your status, and the two ways in (pay, or earn days with approved feedback). */
export default function MembershipView() {
  const { configured, ready, user, membership, isAdmin } = useAccount();
  const [prices, setPrices] = useState<Prices | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = await loadBrowserSupabase();
      if (!supabase) return;
      const { data } = await supabase.from("app_settings").select("key, value").in("key", ["price_monthly", "price_yearly", "feedback_reward_days"]);
      const v = (k: string) => data?.find((s) => s.key === k)?.value;
      setPrices({ monthly: String(v("price_monthly") ?? "Under review"), yearly: String(v("price_yearly") ?? "Under review"), rewardDays: Number(v("feedback_reward_days") ?? 30) });
    })();
  }, []);

  const until = later(membership?.paid_through ?? null, membership?.earned_until ?? null);
  return (
    <section className={`panel ${styles.wrap}`} aria-labelledby="memberTitle">
      <h2 id="memberTitle">Membership</h2>
      <p>Members get every play, system prompt and Top 5 list in full, plus the advanced filters. Everything you create stays yours, even if your membership ends.</p>

      {!configured ? (
        <p className="muted">Memberships switch on once Stone Arch connects the database.</p>
      ) : !ready ? null : !user ? (
        <div className="row-actions"><Link className="btn primary" href="/sign-in">Sign in to become a member</Link></div>
      ) : (
        <div className={styles.status} role="status">
          {membership?.member ? (
            <>
              <b>You&apos;re a member until {day(until)}</b>
              {membership.paid_through && <span>Paid {membership.plan ?? ""} plan{membership.cancel_at_period_end ? `, ends ${day(membership.paid_through)}` : `, renews ${day(membership.paid_through)}`}.</span>}
              {membership.earned_until && <span>Earned with feedback: through {day(membership.earned_until)}.</span>}
            </>
          ) : isAdmin ? (
            <b>You&apos;re an admin, so you see everything.</b>
          ) : (
            <b>You&apos;re on a free account</b>
          )}
        </div>
      )}

      <div className={styles.ways}>
        <div className={styles.way}>
          <h3>Pay</h3>
          <p className="muted">Monthly: <b>{prices?.monthly ?? "Under review"}</b> · Yearly: <b>{prices?.yearly ?? "Under review"}</b></p>
          <p className="fine">Prices are placeholders while we research. Checkout opens soon, in test mode (no real charges).</p>
        </div>
        <div className={styles.way}>
          <h3>Earn it free</h3>
          <p className="muted">Each review of a tool that an admin approves adds <b>{prices?.rewardDays ?? 30} days</b>. Earned days start after any time you already have.</p>
          <div className="row-actions"><Link className="btn small" href="/">Review a tool</Link></div>
        </div>
      </div>
    </section>
  );
}
