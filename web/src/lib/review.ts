import type { Tool } from "./types";

/** How each unconfirmed fact reads in the Under review list: always a full phrase, never a bare label. */
const EQ_GAP = { free: "Whether it's free for a whole school isn't confirmed", device: "Which devices it works on isn't confirmed", lang: "Which languages it supports isn't confirmed", access: "Its accessibility support isn't confirmed" } as const;
/** The three parts of "Where your data goes", as shown in the Scouting report and the Under review list. */
export const LOCATION_LABEL = { hq: "Company based in", stored: "Data stored in", processed: "Data may be processed in" } as const;
/** One-sentence explanations in the "i" bubbles next to these rows. The full version is the "Data location" glossary term. */
export const LOCATION_HELP: Partial<Record<keyof typeof LOCATION_LABEL, string>> = {
  stored: "Where the company keeps your data over time, like the file cabinet a student's file sits in.",
  processed: "Anywhere your data is sent to be used, like the computers that write AI answers, or a support team. It can be a different country from where it's stored.",
};
const LOCATION_GAP = { hq: "Where the company is based isn't clearly stated", stored: "Where data is stored isn't clearly stated", processed: "Where data may be processed isn't clearly stated" } as const;

/**
 * Facts about a tool we couldn't confirm on the vendor's own pages: everything that shows a
 * "Check" flag or "?" in the app. Feeds the "Under review" list under the date in the header,
 * so it never needs updating by hand. Confirmed answers (even "no") are not listed here.
 */
export function underReview(t: Tool): string[] {
  const out: string[] = [];
  if (t.free === "review") out.push("Its price for teachers isn't confirmed");
  if (!t.privacy.ferpa) out.push("FERPA compliance isn't confirmed");
  if (t.privacy.coppa === false) out.push("COPPA compliance isn't confirmed");
  if (t.privacy.dpa === "review") out.push("Whether it signs a data privacy agreement isn't confirmed");
  for (const k of Object.keys(LOCATION_LABEL) as (keyof typeof LOCATION_LABEL)[]) {
    if (t.privacy.location?.[k].check) out.push(LOCATION_GAP[k]);
  }
  for (const g of ["roster", "lms", "grades"] as const) {
    for (const c of t.connects?.[g] ?? []) if (!c.v) out.push(`Whether it connects with ${c.n} isn't confirmed`);
  }
  for (const k of Object.keys(EQ_GAP) as (keyof typeof EQ_GAP)[]) {
    if (t.equity?.[k]?.s === "unknown") out.push(EQ_GAP[k]);
  }
  if (t.review) out.push(t.review);
  return out;
}
