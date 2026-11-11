"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicKey, supabaseUrl } from "./env";

// The Supabase library is about a third of the app's JavaScript, so it isn't part of the first
// page load: it downloads right after the page is on screen. Components read it with
// useBrowserSupabase(), which is null until it's ready, the same as when Supabase isn't set up.

/** True once the team has set the project's keys (see web/README.md). Doesn't load the library. */
export const supabaseConfigured = () => !!(supabaseUrl() && supabasePublicKey());

let client: SupabaseClient | null = null;
let loading: Promise<SupabaseClient | null> | undefined;

/** The browser's Supabase connection, loading the library the first time; null if it isn't set up. */
export function loadBrowserSupabase(): Promise<SupabaseClient | null> {
  loading ??= (async () => {
    const url = supabaseUrl(), key = supabasePublicKey();
    if (!url || !key) return null;
    const { createBrowserClient } = await import("@supabase/ssr");
    client = createBrowserClient(url, key);
    return client;
  })();
  return loading;
}

/** The browser's Supabase connection once it has loaded, else null. Re-renders when it arrives. */
export function useBrowserSupabase(): SupabaseClient | null {
  const [c, setC] = useState(client);
  useEffect(() => {
    if (c || !supabaseConfigured()) return;
    let live = true;
    loadBrowserSupabase().then((x) => { if (live) setC(x); });
    return () => { live = false; };
  }, [c]);
  return c;
}
