"use client";

import { useEffect, useState } from "react";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";
import type { RoleStats } from "@/lib/ranking";

type Row = { tool_id: string; role_id: string; rating_count: number; score: number };

/**
 * Rating totals per role (only tools with 10+ ratings from that role), for role-based ranking.
 * A plain request to the public tool_role_stats() function, so it doesn't need the Supabase
 * library loaded first. The public key is safe here: the function returns totals only.
 */
export function useRoleStats(): RoleStats {
  const [stats, setStats] = useState<RoleStats>({});
  useEffect(() => {
    const url = supabaseUrl(), key = supabasePublicKey();
    if (!url || !key) return;
    const ctrl = new AbortController();
    fetch(`${url}/rest/v1/rpc/tool_role_stats`, {
      method: "POST", signal: ctrl.signal,
      headers: { apikey: key, "Content-Type": "application/json" }, body: "{}",
    })
      .then((r) => (r.ok ? r.json() : [])) // before migration 0008 runs, this just stays empty
      .then((rows: Row[]) => {
        const out: RoleStats = {};
        for (const r of rows) (out[r.role_id] ??= {})[r.tool_id] = { count: r.rating_count, score: Number(r.score) };
        setStats(out);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  return stats;
}
