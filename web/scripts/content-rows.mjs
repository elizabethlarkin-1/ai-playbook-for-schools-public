// Maps src/data/content.json to database rows, table by table, in the order they must be loaded
// (lookup tables before the tables that reference them). Shared by seed-supabase.mjs (loads through
// the API) and build-seed-sql.mjs (writes supabase/seed.sql), so the two never drift apart.
import fs from "node:fs";

export const content = () => JSON.parse(fs.readFileSync(new URL("../src/data/content.json", import.meta.url), "utf8"));

/** Primary key column(s) per table, for upserts. */
export const keys = { top_five: ["role_id", "rank"], app_settings: ["key"] };
/** Columns stored as JSON (everything else that's an array is a text[] column). */
export const jsonColumns = { tools: ["personas", "privacy", "connects", "equity"], app_settings: ["value"] };

export function contentRows(c) {
  return [
    ["roles", c.roles],
    ["subjects", c.subjects],
    ["tool_categories", c.categories],
    ["sdg_targets", c.sdgTargets],
    ["tools", c.tools.map((t) => ({
      id: t.id, name: t.name, company: t.company, category_id: t.cat, ease: t.ease, verified: t.verified,
      subjects: t.subjects, description: t.desc, uses: t.uses, personas: t.personas, free_status: t.free,
      pricing: t.pricing, privacy: t.privacy, connects: t.connects ?? null, equity: t.equity ?? null,
      review_note: t.review ?? null, urls: t.urls, not_offered: t.notOffered ?? [],
    }))],
    ["terms", c.terms.map((t) => ({ id: t.id, abbr: t.abbr, full_name: t.full, kind: t.kind, definition: t.def }))],
    ["plays", c.plays.map((p) => ({
      id: p.id, no: p.no, title: p.title, roles: p.roles, subjects: p.subjects, sdg: p.sdg, inclusion: !!p.incl,
      touches_student_info: p.student, tools: p.tools, prompt: p.prompt, tip: p.tip,
    }))],
    ["system_prompts", c.systemPrompts.map((s) => ({
      id: s.id, title: s.title, roles: s.roles, where_key: s.where, where_text: s.whereText, prompt: s.prompt,
      example: s.example ?? null, try_it: s.tryIt,
    }))],
    ["top_five", c.topFive.map((x) => ({ role_id: x.role, rank: x.rank, kind: x.kind, ref_id: x.refId, why: x.why }))],
    ["app_settings", [{ key: "checked_on", value: c.checkedOn }, { key: "ease_labels", value: c.ease }, { key: "example_role_badges", value: c.exampleRoleBadges ?? [] }]],
  ];
}
