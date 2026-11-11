"use client";

import { useEffect, useMemo, useState } from "react";
import type { Content } from "@/lib/types";
import { loadBrowserSupabase } from "@/lib/supabase/browser";
import { playTextFields, sysTextFields, type PlayText, type SysText } from "@/lib/prompt-texts";
import { useAccount } from "./AccountProvider";

/**
 * The cached content has previews of members-only prompts (the server reads as a guest). For members
 * and admins, fetch the full text with their own session and swap it in; the database decides what
 * they're allowed to see.
 */
export function useMemberContent(content: Content): Content {
  const { fullAccess, user } = useAccount();
  const [texts, setTexts] = useState<{ uid: string; plays: PlayText[]; sys: SysText[] } | null>(null);

  const userId = user?.id;
  useEffect(() => {
    if (!fullAccess || !userId) return;
    let cancelled = false;
    (async () => {
      const supabase = await loadBrowserSupabase();
      if (!supabase || cancelled) return;
      const [{ data: plays }, { data: sys }] = await Promise.all([supabase.rpc("play_texts"), supabase.rpc("system_prompt_texts")]);
      if (!cancelled && plays && sys) setTexts({ uid: userId, plays: plays as PlayText[], sys: sys as SysText[] });
    })();
    return () => { cancelled = true; };
  }, [fullAccess, userId]);

  return useMemo(() => {
    // Only use texts fetched for the person who's signed in now, while they still have access.
    if (!texts || !fullAccess || texts.uid !== userId) return content;
    const play = new Map(texts.plays.map((t) => [t.id, t])), sys = new Map(texts.sys.map((t) => [t.id, t]));
    return {
      ...content,
      plays: content.plays.map((p) => (play.has(p.id) ? { ...p, ...playTextFields(play.get(p.id)) } : p)),
      systemPrompts: content.systemPrompts.map((s) => (sys.has(s.id) ? { ...s, ...sysTextFields(sys.get(s.id)) } : s)),
    };
  }, [content, texts, fullAccess, userId]);
}
