import type { SupabaseClient } from "@supabase/supabase-js";
import { SIGNED_OUT } from "./errors";

/**
 * The account the browser is signed in as right now, checked with Supabase. Writes use this rather
 * than the account the page remembers, which can be stale if someone signed in or out in another tab.
 * A sign-in that's no longer valid (expired, or the account was removed) is cleared, so the page
 * shows "Sign in" again.
 */
export async function sessionUserId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    await supabase.auth.signOut({ scope: "local" });
    throw new Error(SIGNED_OUT);
  }
  return data.user.id;
}
