// Role-based ranking (blueprint 4a · 4). The database only reports a tool's ratings from a role
// once there are at least 10 (tool_role_stats()). A tool earns a "Top rated by [role]" badge and
// moves up in that role's "Best fit" order (after hand-chosen top picks) when its fair score is
// strong. Example badges are demo-only, clearly labeled, and come from the
// `example_role_badges` setting; they are never mixed with real ratings.

export const MIN_ROLE_RATINGS = 10; // enforced in the database too
export const STRONG_SCORE = 4.0;
export const MAX_BADGES_PER_ROLE = 3;

export type RoleStat = { count: number; score: number };
export type RoleStats = Record<string, Record<string, RoleStat>>; // role → tool → totals
export type ExampleBadge = { tool: string; role: string };
export type RoleBadge = { example: boolean; score: number; count: number };

/** Badges for one role: real ones (strongest first, up to 3); example badges only fill in when a role has no real ones. */
export function roleBadges(stats: RoleStats, role: string, examples: ExampleBadge[] = []): Record<string, RoleBadge> {
  if (!role) return {};
  const real = Object.entries(stats[role] ?? {})
    .filter(([, s]) => s.count >= MIN_ROLE_RATINGS && s.score >= STRONG_SCORE)
    .sort((a, b) => b[1].score - a[1].score || b[1].count - a[1].count)
    .slice(0, MAX_BADGES_PER_ROLE);
  if (real.length) return Object.fromEntries(real.map(([tool, s]) => [tool, { example: false, ...s }]));
  // Example scores only order the examples among themselves (listed first = higher).
  return Object.fromEntries(examples.filter((e) => e.role === role).slice(0, MAX_BADGES_PER_ROLE)
    .map((e, i) => [e.tool, { example: true, score: 5 - i / 10, count: 0 }]));
}
