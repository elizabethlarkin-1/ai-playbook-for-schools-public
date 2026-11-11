import type { ReactNode } from "react";

/** Content can mark glossary terms as [[term-id|label]]; this turns them into term pop-up buttons. */
export function rich(text: string): ReactNode[] {
  return text.split(/(\[\[[a-z0-9-]+\|[^\]]+\]\])/g).map((part, i) => {
    const m = part.match(/^\[\[([a-z0-9-]+)\|([^\]]+)\]\]$/);
    return m ? <button key={i} type="button" className="term" data-term={m[1]}>{m[2]}</button> : part;
  });
}

/** The same text with term markup removed, for search and filtering. */
export const plain = (text: string) => String(text || "").replace(/\[\[[a-z0-9-]+\|([^\]]+)\]\]/g, "$1");

export const initials = (name: string) =>
  name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const UNDER_REVIEW = "Under review: we couldn't confirm this on the vendor's site yet. Check before you rely on it.";
