import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import seed from "@/data/content.json";
import { supabasePublicKey, supabaseUrl } from "./supabase/env";
import type { Content, Tool, Term, Play, SystemPrompt, TopFiveItem, Role, Subject, Category, SdgTarget } from "./types";
import { playTextFields, sysTextFields, type PlayText, type SysText } from "./prompt-texts";

/**
 * All playbook content, cached for an hour (tag "content", so admin edits can refresh it).
 * Reads from Supabase when it's configured; otherwise uses the seed file, so the app runs
 * before the database exists.
 */
export async function getContent(): Promise<Content> {
  "use cache";
  cacheLife("hours");
  cacheTag("content");
  const url = supabaseUrl(), key = supabasePublicKey();
  if (!url || !key) return seed as Content;
  return loadFromSupabase(url, key);
}

async function loadFromSupabase(url: string, key: string): Promise<Content> {
  const db = createClient(url, key, { auth: { persistSession: false } });
  const all = async <T,>(table: string, order?: string, columns = "*"): Promise<T[]> => {
    const q = db.from(table).select(columns);
    const { data, error } = await (order ? q.order(order) : q);
    if (error) throw new Error(`Loading ${table}: ${error.message}`);
    return data as T[];
  };
  // Prompt text comes from play_texts() / system_prompt_texts(): this server reads as a guest, so
  // members-only items arrive as previews. Members' browsers fetch the full text (useMemberContent).
  // Until migration 0005 runs, those functions don't exist and the text is still in the tables.
  const texts = async <T,>(fn: string, table: string, columns: string): Promise<T[]> => {
    const { data, error } = await db.rpc(fn);
    if (!error) return data as T[];
    if (error.code !== "PGRST202") throw new Error(`Loading ${fn}: ${error.message}`);
    return all<T>(table, undefined, columns);
  };
  const [roles, subjects, categories, sdg, tools, terms, plays, sys, top, settings, playText, sysText] = await Promise.all([
    all<Role>("roles", "sort"),
    all<Subject>("subjects", "sort"),
    all<Category>("tool_categories"),
    all<SdgTarget>("sdg_targets", "id"),
    all<ToolRow>("tools", "name"),
    all<TermRow>("terms", "abbr"),
    all<PlayRow>("plays", "no", "id, no, title, roles, subjects, sdg, inclusion, touches_student_info, tools"),
    all<SysRow>("system_prompts", undefined, "id, title, roles, where_key, where_text"),
    all<TopRow>("top_five", "rank"),
    all<{ key: string; value: unknown }>("app_settings"),
    texts<PlayText>("play_texts", "plays", "id, prompt, tip"),
    texts<SysText>("system_prompt_texts", "system_prompts", "id, prompt, example, try_it"),
  ]);
  const playById = new Map(playText.map((t) => [t.id, t])), sysById = new Map(sysText.map((t) => [t.id, t]));
  const setting = (k: string) => settings.find((s) => s.key === k)?.value;
  return {
    checkedOn: (setting("checked_on") as string) ?? seed.checkedOn,
    ease: (setting("ease_labels") as Record<string, string>) ?? seed.ease,
    exampleRoleBadges: (setting("example_role_badges") as Content["exampleRoleBadges"]) ?? seed.exampleRoleBadges ?? [],
    roles,
    subjects,
    categories,
    sdgTargets: sdg,
    tools: tools.map(toTool),
    terms: terms.map((t): Term => ({ id: t.id, abbr: t.abbr, full: t.full_name, kind: t.kind, def: t.definition })),
    plays: plays.map((p): Play => ({
      id: p.id, no: p.no, title: p.title, roles: p.roles, subjects: p.subjects, sdg: p.sdg, incl: p.inclusion,
      student: p.touches_student_info, tools: p.tools, ...playTextFields(playById.get(p.id)),
    })),
    systemPrompts: sys.map((s): SystemPrompt => ({
      id: s.id, title: s.title, roles: s.roles, where: s.where_key, whereText: s.where_text, ...sysTextFields(sysById.get(s.id)),
    })),
    topFive: top.map((x): TopFiveItem => ({ role: x.role_id, rank: x.rank, kind: x.kind, refId: x.ref_id, why: x.why })),
  };
}

type ToolRow = {
  id: string; name: string; company: string; category_id: string; ease: number; verified: boolean; subjects: string[];
  description: string; uses: string[]; personas: Tool["personas"]; free_status: Tool["free"]; pricing: string;
  privacy: Tool["privacy"]; connects: Tool["connects"] | null; equity: Tool["equity"] | null; review_note: string | null; urls: string[]; not_offered?: string[];
};
type TermRow = { id: string; abbr: string; full_name: string; kind: Term["kind"]; definition: string };
type PlayRow = {
  id: string; no: number; title: string; roles: string[]; subjects: string[]; sdg: string[]; inclusion: boolean;
  touches_student_info: boolean; tools: string[];
};
type SysRow = { id: string; title: string; roles: string[]; where_key: string; where_text: string };

type TopRow = { role_id: string; rank: number; kind: "play" | "sys"; ref_id: string; why: string };

const toTool = (t: ToolRow): Tool => ({
  id: t.id, name: t.name, company: t.company, cat: t.category_id, ease: t.ease, verified: t.verified, subjects: t.subjects,
  desc: t.description, uses: t.uses, personas: t.personas, free: t.free_status, pricing: t.pricing, privacy: t.privacy,
  connects: t.connects ?? undefined, equity: t.equity ?? undefined, review: t.review_note ?? undefined, urls: t.urls,
  notOffered: t.not_offered?.length ? t.not_offered : undefined,
});
