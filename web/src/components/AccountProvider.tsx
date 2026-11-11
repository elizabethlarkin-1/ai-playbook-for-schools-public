"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabaseConfigured, useBrowserSupabase } from "@/lib/supabase/browser";
import { usePref } from "@/lib/prefs";
import { friendly } from "@/lib/errors";
import { sessionUserId } from "@/lib/session";

// Who's signed in, their profile, whether they're an admin, and their playbook answers
// (role, subjects, school systems). Guests can answer too: answers are kept on the device
// and copied into the account the first time they sign in.

export type PlaybookPrefs = { role: string; subjects: string[]; systems: string[] };
export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role_id: string | null;
  subjects: string[];
  systems: string[];
  onboarded_at: string | null;
  vendor_opt_in: boolean;
  created_at: string;
};
/** From my_membership(): paid time (Stripe) and earned time (approved feedback). */
export type Membership = {
  member: boolean;
  paid_through: string | null;
  earned_until: string | null;
  plan: "monthly" | "yearly" | null;
  status: string | null;
  cancel_at_period_end: boolean;
};
type AccountCtx = {
  /** False until the team connects Supabase; sign-in is hidden until then. */
  configured: boolean;
  ready: boolean;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  /** Null for guests, and until it loads. */
  membership: Membership | null;
  /** True for members and admins: they see members-only prompt text. */
  fullAccess: boolean;
  refreshMembership: () => Promise<void>;
  /** The answers the playbook is personalized with, or null if they haven't done the steps. */
  prefs: PlaybookPrefs | null;
  savePrefs: (p: PlaybookPrefs) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AccountCtx | null>(null);
export const useAccount = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAccount must be used inside AccountProvider");
  return c;
};

const PREFS_KEY = "aipbs:prefs";
const ROLE_KEY = "aipbs:role";
const parse = (s: string): PlaybookPrefs | null => { try { const p = JSON.parse(s); return p && p.role ? p : null; } catch { return null; } };

export default function AccountProvider({ children }: { children: ReactNode }) {
  const supabase = useBrowserSupabase();
  const configured = supabaseConfigured();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [ready, setReady] = useState(!configured);
  const [localRaw, setLocalRaw] = usePref<string>(PREFS_KEY, "");
  const [, setRosterRole] = usePref<string>(ROLE_KEY, "");
  const local = useMemo(() => parse(localRaw), [localRaw]);

  // The latest guest answers, for copying into an account on its first sign-in.
  const localRef = useRef(local);
  useEffect(() => { localRef.current = local; }, [local]);

  // Whose saved role has been copied to this device, so a token refresh doesn't undo a role picked since.
  const roleSyncedFor = useRef<string | null>(null);
  // Whose profile was last loaded (null for a guest), so a token refresh doesn't re-fetch it.
  const loadedFor = useRef<string | null | undefined>(undefined);

  const load = useCallback(async (u: User | null) => {
    if (!supabase || !u) { setProfile(null); setIsAdmin(false); setMembership(null); setReady(true); return; }
    const [{ data: p }, { data: a }, { data: m }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", u.id).maybeSingle(),
      supabase.from("admins").select("user_id").eq("user_id", u.id).maybeSingle(),
      supabase.rpc("my_membership").maybeSingle(),
    ]);
    let prof = (p as Profile) ?? null;
    const guest = localRef.current;
    if (prof && !prof.onboarded_at && guest) {
      // First sign-in after answering as a guest: copy those answers into the account.
      const { data } = await supabase.from("profiles")
        .update({ role_id: guest.role, subjects: guest.subjects, systems: guest.systems, onboarded_at: new Date().toISOString() })
        .eq("id", u.id).select("*").maybeSingle();
      if (data) prof = data as Profile;
    }
    // On sign-in, the role saved in the account becomes this device's role (Roster and Top 5).
    if (prof?.role_id && roleSyncedFor.current !== u.id) setRosterRole(prof.role_id);
    roleSyncedFor.current = u.id;
    setProfile(prof);
    setIsAdmin(!!a);
    setMembership((m as Membership) ?? null);
    setReady(true);
  }, [supabase, setRosterRole]);

  useEffect(() => {
    if (!supabase) return;
    // onAuthStateChange fires right away with the current session, then on every sign-in/out.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      // Signing out always lands on the homepage, so no one is left on an account or admin page.
      if (event === "SIGNED_OUT") router.replace("/");
      setUser(u);
      // A token refresh (or the same person signed in again) needs no reload.
      if ((u?.id ?? null) === loadedFor.current && event !== "USER_UPDATED") return;
      loadedFor.current = u?.id ?? null;
      // Run outside the callback: Supabase recommends not awaiting other calls inside it.
      setTimeout(() => load(u), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase, load, router]);

  // Signing in or out in another tab doesn't always reach this one. When the tab comes back into
  // view, check who the browser is signed in as and catch up if it changed.
  const userId = user?.id;
  useEffect(() => {
    if (!supabase) return;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const { data: { session } } = await supabase.auth.getSession();
      const u = session?.user ?? null;
      if ((u?.id ?? undefined) !== userId) { setUser(u); loadedFor.current = u?.id ?? null; load(u); }
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => { document.removeEventListener("visibilitychange", check); window.removeEventListener("focus", check); };
  }, [supabase, load, userId]);

  const signedIn = !!user;
  const writeProfile = useCallback(async (p: PlaybookPrefs) => {
    if (!supabase || !signedIn) return;
    const update = { role_id: p.role, subjects: p.subjects, systems: p.systems, onboarded_at: new Date().toISOString() };
    const uid = await sessionUserId(supabase);
    const { data, error } = await supabase.from("profiles").update(update).eq("id", uid).select("*").maybeSingle();
    if (error) throw new Error(friendly(error, "save your answers"));
    if (data) setProfile(data as Profile);
  }, [supabase, signedIn]);

  const savePrefs = useCallback(async (p: PlaybookPrefs) => {
    setLocalRaw(JSON.stringify(p));
    setRosterRole(p.role);
    await writeProfile(p);
  }, [setLocalRaw, setRosterRole, writeProfile]);

  const refreshMembership = useCallback(async () => {
    if (!supabase || !signedIn) return;
    const { data } = await supabase.rpc("my_membership").maybeSingle();
    setMembership((data as Membership) ?? null);
  }, [supabase, signedIn]);

  const signOut = useCallback(async () => { await supabase?.auth.signOut(); }, [supabase]);

  const prefs = useMemo((): PlaybookPrefs | null => profile?.onboarded_at && profile.role_id
    ? { role: profile.role_id, subjects: profile.subjects, systems: profile.systems }
    : local, [profile, local]);

  // Memoized: every component that reads the account re-renders when this object changes.
  const value = useMemo(() => ({
    configured, ready, user, profile, isAdmin, membership, fullAccess: isAdmin || !!membership?.member,
    refreshMembership, prefs, savePrefs, signOut,
  }), [configured, ready, user, profile, isAdmin, membership, refreshMembership, prefs, savePrefs, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
