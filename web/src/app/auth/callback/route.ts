import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";

// Where the email sign-in link and Google/Microsoft sign-in return to. Swaps the one-time code
// for a session cookie, then sends people on (new accounts go to the onboarding steps).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const url = supabaseUrl(), key = supabasePublicKey();
  // The second email-change link can arrive without a code (Supabase already applied it).
  if (!code && safeNext === "/account") return NextResponse.redirect(`${origin}/account`);
  if (!code || !url || !key) return NextResponse.redirect(`${origin}/sign-in?error=link`);

  const store = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  // Changing your email sends two confirmation links (old and new address). The second link's
  // one-time code can't be exchanged again, but Supabase has already confirmed it, so send
  // people back to Account settings (still signed in) instead of showing a sign-in error.
  if ((error || !data.user) && safeNext === "/account") return NextResponse.redirect(`${origin}/account`);
  if (error || !data.user) return NextResponse.redirect(`${origin}/sign-in?error=link`);

  const { data: profile } = await supabase.from("profiles").select("onboarded_at").eq("id", data.user.id).maybeSingle();
  return NextResponse.redirect(`${origin}${profile?.onboarded_at ? safeNext : "/welcome"}`);
}
