"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabaseConfigured, useBrowserSupabase } from "@/lib/supabase/browser";
import { useAccount } from "./AccountProvider";
import { friendly } from "@/lib/errors";
import { sessionUserId } from "@/lib/session";

// Community data: each tool's rating numbers and ranking score, the reader's own star ratings,
// and the feedback reward setting. Everything here is public except "mine".

export type ToolStats = { avg: number | null; count: number; feedback: number; score: number };
type CommunityCtx = {
  available: boolean;
  stats: Record<string, ToolStats>;
  mine: Record<string, number>;
  rewardDays: number;
  rate: (toolId: string, stars: number) => Promise<void>;
  refresh: () => void;
};

const Ctx = createContext<CommunityCtx | null>(null);
export const useCommunity = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCommunity must be used inside CommunityProvider");
  return c;
};

type StatRow = { tool_id: string; avg_stars: number | null; rating_count: number; feedback_count: number; score: number };

export default function CommunityProvider({ children }: { children: ReactNode }) {
  const supabase = useBrowserSupabase();
  const { user } = useAccount();
  const userId = user?.id;
  const [stats, setStats] = useState<Record<string, ToolStats>>({});
  const [mine, setMine] = useState<Record<string, number>>({});
  const [rewardDays, setRewardDays] = useState(30);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const [s, setting, own] = await Promise.all([
        supabase.rpc("tool_stats"),
        supabase.from("app_settings").select("value").eq("key", "feedback_reward_days").maybeSingle(),
        userId ? supabase.from("ratings").select("tool_id, stars") : Promise.resolve({ data: [] as { tool_id: string; stars: number }[] }),
      ]);
      if (cancelled) return;
      if (s.data) {
        setStats(Object.fromEntries((s.data as StatRow[]).map((r) => [r.tool_id, {
          avg: r.avg_stars == null ? null : Number(r.avg_stars), count: r.rating_count, feedback: r.feedback_count, score: Number(r.score),
        }])));
      }
      if (setting.data) setRewardDays(Number(setting.data.value) || 0);
      setMine(Object.fromEntries((own.data ?? []).map((r) => [r.tool_id, r.stars])));
    })();
    return () => { cancelled = true; };
  }, [supabase, userId, version]);

  const rate = useCallback(async (toolId: string, stars: number) => {
    if (!supabase || !userId) return;
    const before = mine[toolId];
    setMine((m) => ({ ...m, [toolId]: stars }));
    const undo = () => setMine((m) => { const next = { ...m }; if (before) next[toolId] = before; else delete next[toolId]; return next; });
    const uid = await sessionUserId(supabase).catch((e) => { undo(); throw e; });
    const { error } = await supabase.from("ratings").upsert({ user_id: uid, tool_id: toolId, stars, updated_at: new Date().toISOString() });
    if (error) { undo(); throw new Error(friendly(error, "save your rating")); }
    refresh();
  }, [supabase, userId, mine, refresh]);

  const value = useMemo(() => ({ available: supabaseConfigured(), stats, mine, rewardDays, rate, refresh }), [stats, mine, rewardDays, rate, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
